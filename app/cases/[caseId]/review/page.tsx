"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AkteStatusBanner } from "@/components/custom/CC-06-AkteStatusBanner";
import { ConfidenceScrollbar } from "@/components/custom/CC-01-ConfidenceScrollbar";
import { CollapsibleFormSection } from "@/components/custom/CC-02-CollapsibleFormSection";
import { DocumentPreviewModal, type PreviewFile } from "@/components/custom/CC-08-DocumentPreview";
import { Button } from "@/components/ui/button";
import type { CaseFile, CaseField } from "@/lib/extraction/types";
import { VINSO_FIELD_GROUPS } from "@/lib/extraction/vinso-field-groups";
import { FileDown, FolderInput, FolderOutput, RefreshCw, Eye } from "lucide-react";

const START_PAGE_MAP: Record<string, number> = Object.fromEntries(
  VINSO_FIELD_GROUPS.filter((g) => g.startPage).map((g) => [g.groupId, g.startPage!])
);

function getAllFields(caseData: CaseFile): CaseField[] {
  const fields: CaseField[] = [];
  for (const group of caseData.fieldGroups) {
    if (group.isArray && group.instances) {
      for (const instance of group.instances) fields.push(...instance);
    } else if (group.fields) {
      fields.push(...group.fields);
    }
  }
  return fields;
}

export default function ReviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseFile | null>(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string[] | null>(null);
  const [documents, setDocuments] = useState<{
    eingehend: string[];
    ausgehend: string[];
  } | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/documents`);
      if (res.ok) setDocuments(await res.json());
    } finally {
      setDocsLoading(false);
    }
  }, [caseId]);

  const handleSectionOpen = useCallback(
    (groupId: string) => {
      const page = START_PAGE_MAP[groupId];
      if (page) setPdfPage(page);
    },
    []
  );

  // Initiale Hinweis-Stats aus Query-Params (für sofortiges Feedback)
  const initialFieldCount = Number(searchParams.get("fields") ?? 0);
  const initialLowCount = Number(searchParams.get("low") ?? 0);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCaseData(data);
        setHasPdf(!!data.hasPdf);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    loadDocuments();
  }, [caseId, loadDocuments]);

  const handleFieldUpdate = useCallback(
    async (
      groupId: string,
      fieldId: string,
      instanceIndex: number | null,
      status: CaseField["status"],
      correctedValue?: string
    ) => {
      const res = await fetch(`/api/cases/${caseId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, fieldId, instanceIndex, status, correctedValue }),
      });

      if (!res.ok) return;
      window.dispatchEvent(new Event("stats-updated"));

      // Lokalen State optimistisch updaten
      setCaseData((prev) => {
        if (!prev) return prev;
        const next = JSON.parse(JSON.stringify(prev)) as CaseFile;
        for (const group of next.fieldGroups) {
          if (group.groupId !== groupId) continue;
          if (group.isArray && group.instances && instanceIndex !== null) {
            const field = group.instances[instanceIndex]?.find(
              (f) => f.fieldId === fieldId
            );
            if (field) {
              field.status = status;
              if (correctedValue !== undefined) field.correctedValue = correctedValue;
            }
          } else if (group.fields) {
            const field = group.fields.find((f) => f.fieldId === fieldId);
            if (field) {
              field.status = status;
              if (correctedValue !== undefined) field.correctedValue = correctedValue;
            }
          }
        }
        // Gesamtstatus neu berechnen
        const allFields = getAllFields(next);
        next.status = allFields.every((f) => f.status !== "extracted_unreviewed")
          ? "review_complete"
          : "review_in_progress";
        return next;
      });
    },
    [caseId]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl animate-spin mb-3">⚙</div>
          <p className="text-neutral-500">Lade Falldaten…</p>
          {initialFieldCount > 0 && (
            <p className="text-sm text-neutral-400 mt-1">
              {initialFieldCount} Felder extrahiert · {initialLowCount} zur Prüfung
            </p>
          )}
        </div>
      </main>
    );
  }

  if (error || !caseData) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-error font-medium">⚠ {error ?? "Fall nicht gefunden."}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
            Zurück zur Startseite
          </Button>
        </div>
      </main>
    );
  }

  const allFields = getAllFields(caseData);
  const confirmedCount = allFields.filter((f) => f.status !== "extracted_unreviewed").length;
  const isComplete = caseData.status === "review_complete";

  const openPreview = (folder: string, filename: string) => {
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    const url = `/api/cases/${caseId}/documents/${folder}/${encodeURIComponent(filename)}?inline=1`;
    setPreviewFile({ folder, filename, url, ext });
  };

  return (
    <>
    {previewFile && (
      <DocumentPreviewModal
        file={previewFile}
        caseId={caseId}
        onClose={() => setPreviewFile(null)}
      />
    )}
    <main className="min-h-screen bg-neutral-50 pb-20">
      {/* Top-Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-none px-4 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 shrink-0"
          >
            ← Neuer Upload
          </button>
          <span className="text-sm font-medium text-neutral-700 truncate">
            {caseData.filename}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-neutral-400">
              {Math.round(caseData.processingTimeMs / 1000)}s Extraktionszeit
            </span>
            {hasPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPdf((v) => !v)}
                className="text-xs"
              >
                {showPdf ? "PDF ausblenden" : "PDF einblenden"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Split-Screen-Layout */}
      <div className={showPdf ? "flex h-[calc(100vh-49px)]" : ""}>

        {/* Linke Spalte: Formularfelder */}
        <div className={showPdf ? "flex-1 overflow-y-auto px-4 py-6 pr-10" : "max-w-3xl mx-auto px-4 py-6 pr-10"}>
          {/* Status-Banner */}
          <div className="mb-6">
            <AkteStatusBanner
              confirmedCount={confirmedCount}
              totalCount={allFields.length}
              filename={caseData.filename}
            />
          </div>

          {/* Extraktions-Statistik */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3 text-center flex-1 min-w-[120px]">
              <p className="text-2xl font-bold text-neutral-900">{allFields.length}</p>
              <p className="text-xs text-neutral-500">Felder total</p>
            </div>
            <div className="bg-white rounded-lg border border-orange-200 px-4 py-3 text-center flex-1 min-w-[120px]">
              <p className="text-2xl font-bold text-warning">
                {allFields.filter((f) => f.confidence < 0.85).length}
              </p>
              <p className="text-xs text-neutral-500">Zur Prüfung</p>
            </div>
            <div className="bg-white rounded-lg border border-success-border px-4 py-3 text-center flex-1 min-w-[120px]">
              <p className="text-2xl font-bold text-success">{confirmedCount}</p>
              <p className="text-xs text-neutral-500">Bestätigt</p>
            </div>
          </div>

          {/* Formular-Sektionen */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm divide-y divide-gray-100 px-6">
            {caseData.fieldGroups.map((group) => (
              <CollapsibleFormSection
                key={group.groupId}
                group={group}
                onFieldUpdate={handleFieldUpdate}
                onSectionOpen={handleSectionOpen}
              />
            ))}
          </div>

          {/* Abschluss-Action */}
          {isComplete && (
            <div className="mt-6 bg-success-subtle border border-success-border rounded-xl p-6 text-center">
              <p className="text-success-text font-semibold text-lg mb-1">
                ✓ Extraktion vollständig geprüft
              </p>
              <p className="text-success text-sm mb-4">
                Alle {allFields.length} Felder wurden bestätigt oder korrigiert.
              </p>
              {generateSuccess ? (
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <p className="text-success-text text-sm font-medium">
                    ✓ {generateSuccess.length} Brief(e) in <span className="font-mono">ausgehend/</span> gespeichert.
                  </p>
                  <Link href={`/akten/${caseId}`}>
                    <Button size="sm" variant="outline">Zur Akte →</Button>
                  </Link>
                </div>
              ) : (
                <Button
                  className="bg-success hover:bg-green-700 text-white"
                  disabled={generating}
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const res = await fetch(`/api/cases/${caseId}/generate`, { method: "POST" });
                      const data = await res.json();
                      if (!res.ok) {
                        alert(data.error ?? "Generierung fehlgeschlagen.");
                        return;
                      }
                      setGenerateSuccess(data.files ?? []);
                      loadDocuments();
                    } finally {
                      setGenerating(false);
                    }
                  }}
                >
                  {generating ? "Generiere Briefe…" : "Pflichtschreiben generieren →"}
                </Button>
              )}
            </div>
          )}

          {/* Dokument-Browser */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">Dokumente</h2>
              <button
                onClick={loadDocuments}
                disabled={docsLoading}
                className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${docsLoading ? "animate-spin" : ""}`} />
                Aktualisieren
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Eingehend */}
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-neutral-50">
                  <FolderInput className="h-4 w-4 text-brand-muted" />
                  <span className="text-sm font-medium text-neutral-700">Eingehend</span>
                  {documents && (
                    <span className="ml-auto text-xs text-neutral-400">{documents.eingehend.length}</span>
                  )}
                </div>
                <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {!documents || documents.eingehend.length === 0 ? (
                    <li className="px-4 py-4 text-xs text-neutral-400 text-center">Keine Dokumente</li>
                  ) : (
                    documents.eingehend.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 px-4 py-2.5 hover:bg-neutral-50">
                        <span className="flex-1 text-xs text-neutral-700 truncate font-mono" title={f}>{f}</span>
                        <button
                          onClick={() => openPreview("eingehend", f)}
                          className="text-neutral-400 hover:text-brand flex-shrink-0 p-0.5"
                          title="Vorschau"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={`/api/cases/${caseId}/documents/eingehend/${encodeURIComponent(f)}`}
                          download={f}
                          className="text-neutral-400 hover:text-brand flex-shrink-0 p-0.5"
                          title="Herunterladen"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* Ausgehend */}
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-neutral-50">
                  <FolderOutput className="h-4 w-4 text-success-muted" />
                  <span className="text-sm font-medium text-neutral-700">Ausgehend</span>
                  {documents && (
                    <span className="ml-auto text-xs text-neutral-400">{documents.ausgehend.length}</span>
                  )}
                </div>
                <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {!documents || documents.ausgehend.length === 0 ? (
                    <li className="px-4 py-4 text-xs text-neutral-400 text-center">Keine Dokumente</li>
                  ) : (
                    documents.ausgehend.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 px-4 py-2.5 hover:bg-neutral-50">
                        <span className="flex-1 text-xs text-neutral-700 truncate font-mono" title={f}>{f}</span>
                        <button
                          onClick={() => openPreview("ausgehend", f)}
                          className="text-neutral-400 hover:text-success flex-shrink-0 p-0.5"
                          title="Vorschau"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={`/api/cases/${caseId}/documents/ausgehend/${encodeURIComponent(f)}`}
                          download={f}
                          className="text-neutral-400 hover:text-success flex-shrink-0 p-0.5"
                          title="Herunterladen"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: Original-PDF */}
        {showPdf && (
          <div className="w-[55%] shrink-0 border-l border-neutral-200 bg-neutral-100">
            <iframe
              key={pdfPage}
              src={`/api/cases/${caseId}/pdf#page=${pdfPage}`}
              className="w-full h-full"
              title="Original-PDF"
            />
          </div>
        )}
      </div>

      {/* Confidence-Scrollbar rechts (nur ohne Split-Screen) */}
      {!showPdf && <ConfidenceScrollbar allFields={allFields} totalCount={allFields.length} />}
    </main>
    </>
  );
}
