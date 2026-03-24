"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  FileText,
  ChevronRight,
  RefreshCw,
  FileQuestion,
  FolderInput,
  ChevronDown,
  Trash2,
  Eye,
  X,
} from "lucide-react";

interface Proposal {
  id: string;
  sourceDocument: { folder: string; filename: string };
  status: string;
}

interface TodoGroup {
  caseId: string;
  schuldnerName: string;
  aktenzeichenDisplay: string;
  proposals: Proposal[];
}

// ─── Unzugeordnete Dokumente ──────────────────────────────────────────────────

interface UnassignedDoc {
  filename: string;
  size: number;
  uploadedAt: string;
}

interface CaseOption {
  caseId: string;
  schuldnerName?: string;
  aktenzeichenDisplay?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UnassignedPreviewModal({ filename, onClose }: { filename: string; onClose: () => void }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const url = `/api/unassigned/${encodeURIComponent(filename)}/file`;

  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || ext !== "docx") return;
      import("docx-preview").then(({ renderAsync }) =>
        fetch(url).then(r => r.arrayBuffer()).then(buf =>
          renderAsync(buf, el, undefined, { className: "docx-preview", inWrapper: false, ignoreWidth: true, ignoreHeight: true })
        )
      ).catch(() => { el.textContent = "Vorschau konnte nicht geladen werden."; });
    },
    [url, ext]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <span className="text-sm font-medium text-neutral-700 font-mono truncate">{filename}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <a href={url} download={filename}
              className="text-xs text-neutral-500 hover:text-brand flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-subtle">
              Herunterladen
            </a>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {ext === "pdf" ? (
            <iframe src={url} className="w-full h-full min-h-[70vh]" title={filename} />
          ) : ext === "docx" ? (
            <div ref={containerRef} className="px-8 py-6 text-sm [&_.docx-preview]:max-w-none" />
          ) : (
            <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
              Keine Vorschau für diesen Dateityp verfügbar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UnassignedDocRow({
  doc,
  cases,
  onDelete,
  onAssign,
}: {
  doc: UnassignedDoc;
  cases: CaseOption[];
  onDelete: (filename: string) => Promise<void>;
  onAssign: (filename: string, caseId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    try { await onAssign(doc.filename, selectedCaseId); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`"${doc.filename}" wirklich löschen?`)) return;
    setLoading(true);
    try { await onDelete(doc.filename); }
    finally { setLoading(false); }
  };

  return (
    <>
      {preview && <UnassignedPreviewModal filename={doc.filename} onClose={() => setPreview(false)} />}
      <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 p-1.5 rounded-lg bg-warning-subtle shrink-0">
            <FileQuestion className="h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 text-sm truncate">{doc.filename}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPreview(true)}
            className="p-1.5 text-neutral-400 hover:text-brand hover:bg-brand-subtle rounded-lg transition-colors"
            title="Vorschau"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-brand-subtle hover:bg-brand-light text-brand-text rounded-lg font-medium transition-colors"
          >
            <FolderInput className="h-3.5 w-3.5" />
            In Akte
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-error hover:bg-error-subtle rounded-lg transition-colors"
            title="Löschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t flex gap-2 items-center">
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="flex-1 text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand text-neutral-700"
          >
            <option value="">Akte auswählen…</option>
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.aktenzeichenDisplay
                  ? `${c.aktenzeichenDisplay} – ${c.schuldnerName ?? c.caseId}`
                  : c.schuldnerName ?? c.caseId}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedCaseId || loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand hover:bg-brand-hover disabled:bg-neutral-200 text-white rounded-lg font-medium transition-colors"
          >
            {loading
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <FolderInput className="h-3.5 w-3.5" />}
            Verschieben & analysieren
          </button>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoGroup[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedDoc[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [todosRes, unassignedRes, casesRes] = await Promise.all([
        fetch("/api/todos"),
        fetch("/api/unassigned"),
        fetch("/api/cases"),
      ]);
      if (todosRes.ok) setTodos(await todosRes.json());
      if (unassignedRes.ok) setUnassigned(await unassignedRes.json());
      if (casesRes.ok) setCases(await casesRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const groupByDoc = (proposals: Proposal[]) => {
    const map = new Map<string, number>();
    for (const p of proposals) {
      const key = `${p.sourceDocument.folder}/${p.sourceDocument.filename}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  };

  const handleDeleteUnassigned = async (filename: string) => {
    await fetch(`/api/unassigned/${encodeURIComponent(filename)}`, { method: "DELETE" });
    setUnassigned((prev) => prev.filter((d) => d.filename !== filename));
    window.dispatchEvent(new Event("stats-updated"));
  };

  const handleAssignUnassigned = async (filename: string, caseId: string) => {
    const res = await fetch(`/api/unassigned/${encodeURIComponent(filename)}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    if (res.ok) {
      setUnassigned((prev) => prev.filter((d) => d.filename !== filename));
      window.dispatchEvent(new Event("stats-updated"));
    }
  };

  const totalDocs = todos.reduce((sum, t) => sum + groupByDoc(t.proposals).size, 0);
  const isEmpty = totalDocs === 0 && unassigned.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">TODOs</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Offene KI-Vorschläge & unzugeordnete Dokumente
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-neutral-400">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-30" />
          <p>Lade TODOs…</p>
        </div>
      ) : isEmpty ? (
        <div className="p-16 text-center text-neutral-400 border-2 border-dashed rounded-2xl">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-neutral-500">Alles erledigt</p>
          <p className="text-sm mt-1">Keine offenen Vorschläge oder unzugeordneten Dokumente.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Unzugeordnete Dokumente */}
          {unassigned.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileQuestion className="h-5 w-5 text-warning-muted" />
                <h2 className="text-base font-semibold text-neutral-900">Unzugeordnete Dokumente</h2>
                <span className="text-xs bg-warning-light text-warning-text px-2 py-0.5 rounded-full font-medium">
                  {unassigned.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mb-3">
                Diese Dokumente konnten keiner Akte automatisch zugeordnet werden.
                Verschiebe sie manuell in eine Akte – der Inhalt wird danach per KI analysiert.
              </p>
              <div className="space-y-2">
                {unassigned.map((doc) => (
                  <UnassignedDocRow
                    key={doc.filename}
                    doc={doc}
                    cases={cases}
                    onDelete={handleDeleteUnassigned}
                    onAssign={handleAssignUnassigned}
                  />
                ))}
              </div>
            </div>
          )}

          {/* KI-Vorschläge */}
          {totalDocs > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-brand-muted" />
                <h2 className="text-base font-semibold text-neutral-900">KI-Vorschläge</h2>
                <span className="text-xs bg-brand-light text-brand-text px-2 py-0.5 rounded-full font-medium">
                  {totalDocs}
                </span>
              </div>
              <div className="bg-white rounded-xl border divide-y overflow-hidden">
                {todos.flatMap((todo) =>
                  Array.from(groupByDoc(todo.proposals).entries()).map(([docKey, count]) => {
                    const [, ...parts] = docKey.split("/");
                    const filename = parts.join("/");
                    const href = `/akten/${todo.caseId}/dokument-review?doc=${encodeURIComponent(docKey)}`;
                    return (
                      <Link
                        key={`${todo.caseId}-${docKey}`}
                        href={href}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-neutral-400 shrink-0" />
                        <span className="text-sm font-medium text-neutral-700 w-32 shrink-0 truncate" title={todo.aktenzeichenDisplay}>
                          {todo.aktenzeichenDisplay}
                        </span>
                        <span className="flex-1 text-sm text-neutral-600 truncate font-mono" title={filename}>
                          {filename}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-light text-warning-text shrink-0">
                          {count} Vorschlag{count !== 1 ? "e" : ""}
                        </span>
                        <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
