"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  FileDown,
  Eye,
  FileQuestion,
  FolderInput,
  FolderOutput,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CaseFile, CaseField, CaseFieldGroup, FieldStatus } from "@/lib/extraction/types";
import {
  extractBeteiligte,
  type Beteiligter,
  type BeteiligterDetail,
  type BeteiligterRolle,
} from "@/lib/beteiligte/extract-beteiligte";
import { DocumentPreviewModal } from "@/components/custom/CC-08-DocumentPreview";
import { useUser } from "@/lib/user-context";
import { lookupTag, isExclusiveNamespace, namespaceLabel, TAG_COLORS, TAG_SWATCHES, getTagsByNamespace } from "@/lib/tags";
import type { Tag as TagType } from "@/lib/tags";
import type { Task, TaskStatus } from "@/lib/storage/task-store";
import { DokumentKategorienTree } from "@/components/custom/CC-12-DokumentKategorienTree";
import { DokumentKategorieEditor } from "@/components/custom/CC-13-DokumentKategorieEditor";
import {
  buildDokumentKategorienTree,
  findNodeByRef,
  getDescendantTagRefs,
} from "@/lib/dokument-kategorien";
import { TaskEditModal } from "@/components/custom/CC-14-TaskEditModal";
import { AUFGABE_CREATE_EVENT, DRAG_KEY } from "@/lib/drag-types";
import type { AufgabeCreateDetail, DragSource, DropTarget } from "@/lib/drag-types";


// ─── Drag & Drop Helpers ───────────────────────────────────────────────────────

function fireDragCreateEvent(draggedSource: DragSource, dropTarget: DropTarget) {
  const detail: AufgabeCreateDetail = { draggedSource, dropTarget };
  window.dispatchEvent(new CustomEvent(AUFGABE_CREATE_EVENT, { detail }));
}

function parseDragSource(e: React.DragEvent): DragSource | null {
  try {
    const raw = e.dataTransfer.getData(DRAG_KEY);
    if (!raw) return null;
    const { source } = JSON.parse(raw);
    return source as DragSource;
  } catch {
    return null;
  }
}

// ─── Rolle-Styles ──────────────────────────────────────────────────────────────

const ROLLE_STYLE: Record<string, string> = {
  Schuldner: "bg-brand-light text-brand-text",
  Gläubiger: "bg-error-light text-error-text",
  Arbeitgeber: "bg-success-light text-success-text",
  Vermieter: "bg-warning-light text-warning-text",
  "Verfahrensbevollmächtigte(r)": "bg-sec-light text-sec-text",
};

function RolleBadge({ rolle }: { rolle: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${ROLLE_STYLE[rolle] ?? "bg-neutral-100 text-neutral-700"}`}>
      {rolle}
    </span>
  );
}

// ─── Beteiligter-Karte ─────────────────────────────────────────────────────────

function BeteiligterCard({
  b,
  caseId,
  onUpdate,
}: {
  b: Beteiligter;
  caseId: string;
  onUpdate: () => void;
}) {
  const eurFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const mySource: DragSource = {
    kind: "beteiligter",
    caseId,
    groupId: b.details[0]?.groupId ?? b.id,
    beteiligterId: b.id,
    label: b.name,
  };

  const startEdit = (d: BeteiligterDetail) => {
    setEditingLabel(d.label);
    setEditValue(d.value);
  };

  const cancelEdit = () => setEditingLabel(null);

  const saveEdit = async (d: BeteiligterDetail) => {
    if (!d.groupId || !d.fieldId) return;
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: d.groupId,
          fieldId: d.fieldId,
          instanceIndex: d.instanceIndex ?? null,
          status: "manually_corrected",
          correctedValue: editValue,
        }),
      });
      setEditingLabel(null);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: mySource }));
        e.dataTransfer.effectAllowed = "link";
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "link"; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const dragged = parseDragSource(e);
        if (dragged) fireDragCreateEvent(dragged, mySource);
      }}
      className={`bg-white rounded-xl border p-4 flex flex-col gap-2 cursor-grab transition-colors ${isDragOver ? "border-brand-muted bg-brand-subtle ring-2 ring-brand/30" : "border-neutral-200"}`}
    >
      <div className="flex flex-wrap gap-1.5 mb-1">
        <RolleBadge rolle={b.rolle} />
        {b.isVermieter && <RolleBadge rolle="Vermieter" />}
      </div>
      <p className="font-semibold text-neutral-900 text-sm leading-tight">{b.name}</p>
      {b.forderungEur !== undefined && (
        <p className="text-lg font-bold text-error-text">{eurFmt.format(b.forderungEur)}</p>
      )}
      <dl className="space-y-0.5">
        {b.details.map((d) => {
          const canEdit = !!(d.groupId && d.fieldId);
          const isEditing = editingLabel === d.label;
          return (
            <div key={d.label} className={`flex items-start gap-1.5 text-xs ${canEdit ? "group/row" : ""}`}>
              <dt className="text-neutral-400 flex-shrink-0 min-w-[70px] pt-0.5">{d.label}</dt>
              <dd className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(d);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 px-1.5 py-0.5 text-xs border border-brand-muted rounded focus:outline-none min-w-0"
                    />
                    <button
                      onClick={() => saveEdit(d)}
                      disabled={saving}
                      className="text-success hover:text-success-text p-0.5 flex-shrink-0"
                      title="Speichern (Enter)"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={cancelEdit} className="text-neutral-400 hover:text-neutral-600 p-0.5 flex-shrink-0" title="Abbrechen (Esc)">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-neutral-700 break-words">{d.value}</span>
                    {canEdit && (
                      <button
                        onClick={() => startEdit(d)}
                        className="opacity-0 group-hover/row:opacity-100 text-neutral-400 hover:text-brand p-0.5 ml-auto flex-shrink-0 transition-opacity"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// ─── Beteiligte-Sektion ────────────────────────────────────────────────────────

function BeteiligteSection({
  label,
  rolle,
  beteiligte,
  caseId,
  onUpdate,
}: {
  label: string;
  rolle: BeteiligterRolle;
  beteiligte: Beteiligter[];
  caseId: string;
  onUpdate: () => void;
}) {
  const filtered = beteiligte.filter((b) => b.rolle === rolle);
  if (filtered.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
        {label} ({filtered.length})
      </h2>
      <div className={`grid gap-3 ${filtered.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
        {filtered.map((b) => (
          <BeteiligterCard key={b.id} b={b} caseId={caseId} onUpdate={onUpdate} />
        ))}
      </div>
    </section>
  );
}

// ─── Dokument-Browser ──────────────────────────────────────────────────────────

interface PreviewFile {
  folder: string;
  filename: string;
  url: string;
  ext: string;
}

interface ProposalSummary {
  id: string;
  sourceDocument: { folder: string; filename: string };
  status: string;
}

function DokumenteTab({ caseId }: { caseId: string }) {
  const [documents, setDocuments] = useState<{ eingehend: string[]; ausgehend: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pendingByDoc, setPendingByDoc] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [dokTagMap, setDokTagMap] = useState<Record<string, string[]>>({});
  const [selectedTagRef, setSelectedTagRef] = useState<string | null>(null);
  const inputRefs = {
    eingehend: useRef<HTMLInputElement>(null),
    ausgehend: useRef<HTMLInputElement>(null),
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, propRes, tagsRes, katRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/documents`),
        fetch(`/api/cases/${caseId}/proposals`),
        fetch(`/api/tags`),
        fetch(`/api/cases/${caseId}/documents/kategorien`),
      ]);
      if (docsRes.ok) setDocuments(await docsRes.json());
      if (tagsRes.ok) setAllTags(await tagsRes.json());
      if (katRes.ok) setDokTagMap(await katRes.json());
      if (propRes.ok) {
        const proposals: ProposalSummary[] = await propRes.json();
        const counts: Record<string, number> = {};
        for (const p of proposals) {
          if (p.status !== "pending") continue;
          const key = `${p.sourceDocument.folder}/${p.sourceDocument.filename}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        setPendingByDoc(counts);
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const openPreview = (folder: string, filename: string) => {
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    setPreview({ folder, filename, ext, url: `/api/cases/${caseId}/documents/${folder}/${encodeURIComponent(filename)}?inline=1` });
  };

  const deleteFile = useCallback(async (folder: string, filename: string) => {
    if (!window.confirm(`„${filename}" wirklich löschen?\n\nDokument, Metadaten und alle zugehörigen KI-Vorschläge werden entfernt.`)) return;
    const key = `${folder}/${filename}`;
    setDeleting(key);
    try {
      await fetch(`/api/cases/${caseId}/documents/${folder}/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setDeleting(null);
    }
  }, [caseId, load]);

  const uploadFiles = useCallback(async (folder: string, files: FileList | File[]) => {
    setUploading((u) => ({ ...u, [folder]: true }));
    try {
      const fd = new FormData();
      for (const file of Array.from(files)) fd.append("file", file);
      await fetch(`/api/cases/${caseId}/documents/${folder}`, { method: "POST", body: fd });
      await load();
    } finally {
      setUploading((u) => ({ ...u, [folder]: false }));
    }
  }, [caseId, load]);

  function filterByTag(folder: string, files: string[]): string[] {
    if (!selectedTagRef) return files;
    const tree = buildDokumentKategorienTree(allTags);
    const node = findNodeByRef(tree, selectedTagRef);
    const refs = node ? new Set(getDescendantTagRefs(node)) : new Set([selectedTagRef]);
    return files.filter((f) =>
      (dokTagMap[`${folder}/${f}`] ?? []).some((r) => refs.has(r))
    );
  }

  function FolderSection({
    folder,
    label,
    icon,
    iconColor,
    files,
  }: {
    folder: "eingehend" | "ausgehend";
    label: string;
    icon: React.ReactNode;
    iconColor: string;
    files: string[];
  }) {
    const isUploading = uploading[folder];
    const isDragOver = dragOver === folder;

    return (
      <div
        className={`bg-white rounded-xl border overflow-hidden transition-colors ${isDragOver ? "border-brand-muted bg-brand-subtle" : "border-neutral-200"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(folder); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(null);
          if (e.dataTransfer.files.length > 0) uploadFiles(folder, e.dataTransfer.files);
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-neutral-50">
          <span className={iconColor}>{icon}</span>
          <span className="text-sm font-medium text-neutral-700">{label}</span>
          <span className="ml-auto text-xs text-neutral-400">{files.length}</span>
          {isUploading ? (
            <RefreshCw className="h-3.5 w-3.5 text-brand-muted animate-spin" />
          ) : (
            <>
              <input
                ref={inputRefs[folder]}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(folder, e.target.files)}
              />
              <button
                onClick={() => inputRefs[folder].current?.click()}
                className="text-neutral-400 hover:text-brand p-0.5"
                title="Dokument hinzufügen"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {files.length === 0 ? (
            <li className="px-4 py-8 text-xs text-neutral-400 text-center flex flex-col items-center gap-2">
              <Upload className="h-5 w-5 text-neutral-300" />
              <span>Dateien hier ablegen oder</span>
              <button
                onClick={() => inputRefs[folder].current?.click()}
                className="text-brand-muted hover:underline"
              >
                Datei auswählen
              </button>
            </li>
          ) : (
            files.map((f) => {
              const docKey = `${folder}/${f}`;
              const pendingCount = pendingByDoc[docKey] ?? 0;
              const dokSource: DragSource = { kind: "dokument", caseId, folder, filename: f };
              return (
                <li
                  key={f}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: dokSource }));
                    e.dataTransfer.effectAllowed = "link";
                  }}
                  onDragOver={(e) => {
                    // only accept user drops, not file uploads (check for our key)
                    if (e.dataTransfer.types.includes(DRAG_KEY)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "link";
                    }
                  }}
                  onDrop={(e) => {
                    const dragged = parseDragSource(e);
                    if (dragged) { e.preventDefault(); fireDragCreateEvent(dragged, dokSource); }
                  }}
                  className="flex flex-col gap-1 px-4 py-2.5 hover:bg-neutral-50 cursor-grab"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-xs text-neutral-700 truncate font-mono" title={f}>{f}</span>
                    {pendingCount > 0 && (
                      <Link
                        href={`/akten/${caseId}/dokument-review?doc=${encodeURIComponent(docKey)}`}
                        className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-warning-light text-warning-text hover:bg-amber-200 shrink-0"
                        title={`${pendingCount} offene KI-Vorschläge prüfen`}
                      >
                        <span>{pendingCount}</span>
                        <span>Vorschlag{pendingCount !== 1 ? "e" : ""}</span>
                      </Link>
                    )}
                    <DokumentKategorieEditor
                      caseId={caseId}
                      folder={folder}
                      filename={f}
                      allTags={allTags}
                      currentTagRefs={dokTagMap[docKey] ?? []}
                      onSaved={(newRefs) => setDokTagMap((prev) => ({ ...prev, [docKey]: newRefs }))}
                    />
                    <button onClick={() => openPreview(folder, f)} className="text-neutral-400 hover:text-brand p-0.5" title="Vorschau">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={`/api/cases/${caseId}/documents/${folder}/${encodeURIComponent(f)}`}
                      download={f}
                      className="text-neutral-400 hover:text-brand p-0.5"
                      title="Herunterladen"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deleteFile(folder, f)}
                      disabled={deleting === docKey}
                      className="text-neutral-300 hover:text-error-muted p-0.5 disabled:opacity-50 transition-colors"
                      title="Löschen"
                    >
                      {deleting === docKey
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                  {(dokTagMap[docKey] ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(dokTagMap[docKey] ?? []).map((ref) => {
                        const tag = lookupTag(allTags, ref);
                        if (!tag) return null;
                        const colors = TAG_COLORS[tag.color] ?? TAG_COLORS["gray"];
                        return (
                          <span
                            key={ref}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {tag.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
        {files.length > 0 && (
          <div className="px-4 py-2 border-t bg-neutral-50 flex justify-center">
            <button
              onClick={() => inputRefs[folder].current?.click()}
              className="text-xs text-neutral-400 hover:text-brand flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Weitere Dateien hinzufügen
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-neutral-400"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade…</div>;
  }

  return (
    <>
      {preview && (
        <DocumentPreviewModal file={preview} caseId={caseId} onClose={() => setPreview(null)} />
      )}
      <div className="flex items-center justify-end mb-3">
        <button onClick={load} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </button>
      </div>
      <div className="flex gap-4 min-h-0">
        <div className="w-52 flex-shrink-0 overflow-y-auto bg-white rounded-xl border border-neutral-200 p-2">
          <DokumentKategorienTree
            allTags={allTags}
            dokTagMap={dokTagMap}
            onSelectTagRef={setSelectedTagRef}
            selectedTagRef={selectedTagRef}
          />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <FolderSection
            folder="eingehend"
            label="Eingehend"
            icon={<FolderInput className="h-4 w-4" />}
            iconColor="text-brand-muted"
            files={filterByTag("eingehend", documents?.eingehend ?? [])}
          />
          <FolderSection
            folder="ausgehend"
            label="Ausgehend"
            icon={<FolderOutput className="h-4 w-4" />}
            iconColor="text-success-muted"
            files={filterByTag("ausgehend", documents?.ausgehend ?? [])}
          />
        </div>
      </div>
    </>
  );
}

// ─── Daten-Tab ─────────────────────────────────────────────────────────────────

const FIELD_STATUS_DOT: Record<string, string> = {
  extracted_confirmed: "bg-success-muted",
  manually_corrected: "bg-brand-muted",
  extracted_unreviewed: "bg-warning-muted",
};

const FIELD_STATUS_LABEL: Record<FieldStatus, string> = {
  extracted_confirmed: "Bestätigt",
  manually_corrected: "Korrigiert",
  extracted_unreviewed: "Ungeprüft",
};

function ConfidenceDot({ field }: { field: CaseField }) {
  const pct = Math.round(field.confidence * 100);
  const label = FIELD_STATUS_LABEL[field.status] ?? field.status;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full cursor-help ${FIELD_STATUS_DOT[field.status] ?? "bg-neutral-300"}`}
        />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[220px] space-y-1">
        <p className="font-semibold">{label} · {pct}% Konfidenz</p>
        {field.confidenceReason && (
          <p className="text-neutral-300 font-normal">{field.confidenceReason}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function fieldEffectiveValue(f: CaseField): string {
  return (f.correctedValue ?? f.extractedValue ?? "").trim();
}

function GroupCard({
  group,
  instanceIndex,
  fields,
  caseId,
  onUpdate,
}: {
  group: CaseFieldGroup;
  instanceIndex?: number;
  fields: CaseField[];
  caseId: string;
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const title = instanceIndex !== undefined
    ? `${group.label} ${instanceIndex + 1}`
    : group.label;

  const mySource: DragSource = {
    kind: "feldgruppe",
    caseId,
    groupId: group.groupId,
    instanceIndex,
    label: title,
  };

  const startEdit = (f: CaseField) => {
    setEditingId(f.fieldId);
    setEditValue(fieldEffectiveValue(f));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (f: CaseField) => {
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.groupId,
          fieldId: f.fieldId,
          instanceIndex: instanceIndex ?? null,
          status: "manually_corrected",
          correctedValue: editValue,
        }),
      });
      setEditingId(null);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: mySource }));
        e.dataTransfer.effectAllowed = "link";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_KEY)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "link";
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        const dragged = parseDragSource(e);
        if (dragged) { e.preventDefault(); fireDragCreateEvent(dragged, mySource); }
      }}
      className={`rounded-xl border p-4 cursor-grab transition-colors ${isDragOver ? "border-brand-muted bg-brand-subtle ring-2 ring-brand/30" : "bg-white border-neutral-200"}`}
    >
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{title}</h3>
      <dl className="space-y-0">
        {fields.map((f) => {
          const value = fieldEffectiveValue(f);
          const isEditing = editingId === f.fieldId;
          return (
            <div key={f.fieldId} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0 group/row">
              <ConfidenceDot field={f} />
              <dt className="text-xs text-neutral-400 min-w-[160px] flex-shrink-0 pt-0.5">{f.label}</dt>
              <dd className="flex-1 text-xs min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(f);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 px-1.5 py-0.5 text-xs border border-brand-muted rounded focus:outline-none min-w-0"
                    />
                    <button
                      onClick={() => saveEdit(f)}
                      disabled={saving}
                      className="text-success hover:text-success-text p-0.5 flex-shrink-0"
                      title="Speichern (Enter)"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="text-neutral-400 hover:text-neutral-600 p-0.5 flex-shrink-0" title="Abbrechen (Esc)">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className={`break-words ${value ? "text-neutral-800" : "text-neutral-300 italic"}`}>{value || "–"}</span>
                    <button
                      onClick={() => startEdit(f)}
                      className="opacity-0 group-hover/row:opacity-100 text-neutral-400 hover:text-brand p-0.5 ml-auto flex-shrink-0 transition-opacity"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </dd>
            </div>
          );
        })}
        {fields.length === 0 && (
          <p className="text-xs text-neutral-300 italic">Keine Felder</p>
        )}
      </dl>
    </div>
  );
}

const STATUS_FILTER_OPTIONS: { status: FieldStatus; label: string; dot: string; activeBg: string; activeText: string }[] = [
  { status: "extracted_confirmed",  label: "Bestätigt", dot: "bg-success-muted",  activeBg: "bg-success-subtle border-success-border", activeText: "text-success-text" },
  { status: "manually_corrected",   label: "Korrigiert", dot: "bg-brand-muted",   activeBg: "bg-brand-subtle border-brand-border",     activeText: "text-brand-text"   },
  { status: "extracted_unreviewed", label: "Ungeprüft",  dot: "bg-warning-muted", activeBg: "bg-warning-light border-warning-border",  activeText: "text-warning-dark" },
];

function DatenTab({ caseData, caseId, onUpdate, search, onSearchChange }: {
  caseData: CaseFile;
  caseId: string;
  onUpdate: () => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [selectedAnlage, setSelectedAnlage] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<Set<FieldStatus>>(new Set());

  const toggleStatus = (s: FieldStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  // Anlage names
  const anlageNames = useMemo(() => {
    const names = new Set<string>();
    for (const g of caseData.fieldGroups) names.add(g.anlageName ?? g.groupId);
    return Array.from(names);
  }, [caseData.fieldGroups]);

  // Apply status + search filter to a field list
  const searchLower = search.toLowerCase();
  const applyFilters = (fields: CaseField[]): CaseField[] => {
    let result = statusFilter.size > 0 ? fields.filter((f) => statusFilter.has(f.status)) : fields;
    if (search) result = result.filter((f) =>
      f.label.toLowerCase().includes(searchLower) ||
      fieldEffectiveValue(f).toLowerCase().includes(searchLower)
    );
    return result;
  };

  // Groups after Anlage filter
  const anlageGroups = useMemo(() =>
    caseData.fieldGroups.filter((g) =>
      selectedAnlage === "alle" || (g.anlageName ?? g.groupId) === selectedAnlage
    ), [caseData.fieldGroups, selectedAnlage]);

  // Count fields per status (respects Anlage filter, ignores status filter)
  const statusCounts = useMemo(() => {
    const counts: Record<FieldStatus, number> = {
      extracted_confirmed: 0,
      manually_corrected: 0,
      extracted_unreviewed: 0,
    };
    for (const g of anlageGroups) {
      const allFields = g.isArray && g.instances
        ? g.instances.flat()
        : (g.fields ?? []);
      for (const f of allFields) {
        if (f.status in counts) counts[f.status as FieldStatus]++;
      }
    }
    return counts;
  }, [anlageGroups]);

  // Count total fields with values (unfiltered)
  const totalFields = caseData.fieldGroups.reduce((acc, g) => {
    if (g.isArray && g.instances)
      return acc + g.instances.reduce((a, inst) => a + inst.filter((f) => fieldEffectiveValue(f)).length, 0);
    return acc + (g.fields ?? []).filter((f) => fieldEffectiveValue(f)).length;
  }, 0);

  return (
    <div>
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 pt-0 pb-4 mb-2 border-b border-neutral-100">
        {/* Search + stats */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Feld oder Wert suchen…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {search && (
              <button onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-400 self-center">{totalFields} Felder mit Wert</p>
        </div>

        {/* Anlage filter chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["alle", ...anlageNames].map((a) => (
            <button
              key={a}
              onClick={() => setSelectedAnlage(a)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                selectedAnlage === a ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {a === "alle" ? "Alle" : a}
            </button>
          ))}
        </div>

        {/* Status-Filter (klickbare Legende) */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[11px] text-neutral-400">Status:</span>
          {STATUS_FILTER_OPTIONS.map(({ status, label, dot, activeBg, activeText }) => {
            const active = statusFilter.has(status);
            const count = statusCounts[status];
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? `${activeBg} ${activeText}`
                    : "bg-neutral-100 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                {label}
                <span className={`font-mono ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button
              onClick={() => setStatusFilter(new Set())}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 ml-1"
            >
              Alle anzeigen
            </button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-5 mt-5">
        {anlageGroups.map((group) => {
          if (group.isArray && group.instances) {
            const visibleInstances = group.instances
              .map((inst) => applyFilters(inst))
              .filter((inst) => inst.length > 0);
            if (visibleInstances.length === 0) return null;
            return (
              <section key={group.groupId}>
                {group.anlageName && <p className="text-xs text-neutral-400 font-medium mb-2">{group.anlageName}</p>}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleInstances.map((inst, i) => (
                    <GroupCard key={i} group={group} instanceIndex={i} fields={inst} caseId={caseId} onUpdate={onUpdate} />
                  ))}
                </div>
              </section>
            );
          }

          const filtered = applyFilters(group.fields ?? []);
          if (filtered.length === 0) return null;
          return (
            <section key={group.groupId}>
              {group.anlageName && <p className="text-xs text-neutral-400 font-medium mb-2">{group.anlageName}</p>}
              <GroupCard group={group} fields={filtered} caseId={caseId} onUpdate={onUpdate} />
            </section>
          );
        })}
        {anlageGroups.every((g) => {
          if (g.isArray && g.instances) return g.instances.every((inst) => applyFilters(inst).length === 0);
          return applyFilters(g.fields ?? []).length === 0;
        }) && (
          <p className="text-sm text-neutral-400 text-center py-12">Keine Felder gefunden.</p>
        )}
      </div>
    </div>
  );
}

// ─── Status-Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CaseFile["status"] }) {
  const cfg = {
    extracting: { label: "Wird erfasst", cls: "bg-brand-light text-brand-text" },
    review_in_progress: { label: "Zu klären", cls: "bg-warning-light text-warning-text" },
    review_complete: { label: "Geklärt", cls: "bg-success-light text-success-text" },
  }[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-700" };

  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Hauptseite ────────────────────────────────────────────────────────────────

// ─── Todos-Tab ─────────────────────────────────────────────────────────────────

interface TodoProposal {
  id: string;
  sourceDocument: { folder: string; filename: string };
  status: string;
}

interface TodoGroup {
  caseId: string;
  schuldnerName: string;
  aktenzeichenDisplay: string;
  proposals: TodoProposal[];
}

function TodosTab({ caseId }: { caseId: string }) {
  const [groups, setGroups] = useState<TodoGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then((all: TodoGroup[]) => setGroups(all.filter((g) => g.caseId === caseId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade Todos…
      </div>
    );
  }

  const totalProposals = groups.reduce((s, g) => s + g.proposals.length, 0);

  if (totalProposals === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
        <FileQuestion className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium text-neutral-500">Keine offenen KI-Vorschläge</p>
        <p className="text-xs">Alle Felder dieser Akte wurden bereits geprüft.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        <span className="font-medium text-neutral-900">{totalProposals}</span> offene KI-Vorschläge
      </p>
      {groups.map((group) => {
        // Group by document
        const byDoc: Record<string, TodoProposal[]> = {};
        for (const p of group.proposals) {
          const key = `${p.sourceDocument.folder}/${p.sourceDocument.filename}`;
          if (!byDoc[key]) byDoc[key] = [];
          byDoc[key].push(p);
        }

        return Object.entries(byDoc).map(([key, proposals]) => {
          const { folder, filename } = proposals[0].sourceDocument;
          const dokSource: DragSource = { kind: "dokument", caseId, folder, filename };
          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: dokSource }));
                e.dataTransfer.effectAllowed = "link";
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_KEY)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "link";
                }
              }}
              onDrop={(e) => {
                const dragged = parseDragSource(e);
                if (dragged) { e.preventDefault(); fireDragCreateEvent(dragged, dokSource); }
              }}
              className="group cursor-grab"
            >
              <a
                href={`/akten/${caseId}/dokument-review?doc=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`}
                className="flex items-center gap-3 bg-white rounded-xl border hover:border-brand-border hover:shadow-sm transition-all p-4"
                onClick={(e) => { if (e.currentTarget.closest("[data-dragging]")) e.preventDefault(); }}
              >
                <Search className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{filename}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{folder}</p>
                </div>
                <span className="bg-warning text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                  {proposals.length}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-brand transition-colors" />
              </a>
            </div>
          );
        });
      })}
    </div>
  );
}

// ─── Inline Tag-Editor ─────────────────────────────────────────────────────────

const COLOR_PICKER_OPTIONS = [
  "sky", "sky-dark", "blue", "blue-dark", "cyan", "cyan-dark",
  "teal", "teal-dark", "emerald", "emerald-dark", "green", "green-dark", "lime",
  "yellow", "amber", "orange", "orange-dark",
  "red", "red-dark", "rose", "pink", "pink-dark",
  "fuchsia", "purple", "purple-dark", "violet", "indigo", "indigo-dark",
  "gray", "slate", "zinc", "stone",
] as const;

const COLOR_LABELS: Record<string, string> = {
  sky: "Himmelblau", "sky-dark": "Himmelblau (dunkel)",
  blue: "Blau", "blue-dark": "Blau (dunkel)",
  cyan: "Cyan", "cyan-dark": "Cyan (dunkel)",
  teal: "Türkis", "teal-dark": "Türkis (dunkel)",
  emerald: "Smaragd", "emerald-dark": "Smaragd (dunkel)",
  green: "Grün", "green-dark": "Grün (dunkel)",
  lime: "Limette",
  yellow: "Gelb", amber: "Bernstein",
  orange: "Orange", "orange-dark": "Orange (dunkel)",
  red: "Rot", "red-dark": "Rot (dunkel)",
  rose: "Rosa", pink: "Pink", "pink-dark": "Pink (dunkel)",
  fuchsia: "Fuchsia",
  purple: "Lila", "purple-dark": "Lila (dunkel)",
  violet: "Violett",
  indigo: "Indigo", "indigo-dark": "Indigo (dunkel)",
  gray: "Grau", slate: "Schiefer", zinc: "Zink", stone: "Stein",
};

function toTagSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function InlineTagEditor({
  currentTags,
  allTags,
  onSave,
}: {
  currentTags: import("@/lib/tags").TagRef[];
  allTags: import("@/lib/tags").Tag[];
  onSave: (tags: import("@/lib/tags").TagRef[]) => Promise<void>;
}) {
  const { refreshTags } = useUser();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTagColor, setNewTagColor] = useState("gray");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // All tags assignable to akten: global (""), akten, akten/*
  const aktenTags = allTags.filter(
    (t) => t.namespace === "" || t.namespace === "akten" || t.namespace.startsWith("akten/")
  );

  // Build a TagRef from a tag — empty namespace → just the name (e.g. "dringend")
  const tagToRef = (tag: import("@/lib/tags").Tag): import("@/lib/tags").TagRef =>
    tag.namespace ? `${tag.namespace}/${tag.name}` : tag.name;

  // Toggle: sub-namespace tags are exclusive (replace sibling); top-level akten tags toggle freely
  const toggle = async (ref: import("@/lib/tags").TagRef, tag: import("@/lib/tags").Tag) => {
    let next: import("@/lib/tags").TagRef[];
    if (currentTags.includes(ref)) {
      next = currentTags.filter((r) => r !== ref);
    } else if (isExclusiveNamespace(tag.namespace)) {
      // Remove all other tags in the same sub-namespace, then add this one
      next = [
        ...currentTags.filter((r) => {
          const t = lookupTag(allTags, r);
          return !t || t.namespace !== tag.namespace;
        }),
        ref,
      ];
    } else {
      next = [...currentTags, ref];
    }
    await onSave(next);
  };

  const createAndAdd = async () => {
    if (!query.trim() || creating) return;
    setCreating(true);
    const label = query.trim();
    const name = toTagSlug(label);
    const color = newTagColor;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace: "akten", name, label, color }),
    });
    if (res.ok) {
      await refreshTags();
      await onSave([...currentTags, `akten/${name}` as import("@/lib/tags").TagRef]);
    }
    setQuery("");
    setNewTagColor("gray");
    setCreating(false);
    setAddOpen(false);
  };

  useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAddOpen(false);
        setQuery("");
        setNewTagColor("gray");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addOpen]);

  useEffect(() => {
    if (addOpen) setTimeout(() => inputRef.current?.focus(), 40);
  }, [addOpen]);

  // Build sectioned list for dropdown
  const q = query.trim().toLowerCase();
  const matchedTags = q ? aktenTags.filter((t) => t.label.toLowerCase().includes(q)) : aktenTags;

  // Exclusive sub-namespace sections (e.g. akten/status)
  const exclusiveNamespaces = Array.from(
    new Set(matchedTags.filter((t) => isExclusiveNamespace(t.namespace)).map((t) => t.namespace))
  );
  const groupedSections = exclusiveNamespaces.map((ns) => ({
    namespace: ns,
    label: namespaceLabel(ns),
    tags: matchedTags.filter((t) => t.namespace === ns),
  }));
  // Non-exclusive: split into akten-specific and global
  const aktenGeneralTags = matchedTags.filter((t) => t.namespace === "akten");
  const globalTags = matchedTags.filter((t) => t.namespace === "");

  const exactMatch = aktenTags.some((t) => t.label.toLowerCase() === q);
  const showCreate = q.length > 0 && !exactMatch;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5" ref={containerRef}>
      {/* Current tag chips */}
      {currentTags.map((ref) => {
        const tag = lookupTag(allTags, ref);
        if (!tag) return null;
        const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
        return (
          <span
            key={ref}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}
          >
            {isExclusiveNamespace(tag.namespace) && (
              <span className="opacity-50 text-[10px] font-normal mr-0.5">{namespaceLabel(tag.namespace)}:</span>
            )}
            {tag.label}
            <button
              onClick={() => toggle(ref, tag)}
              className="hover:opacity-60 transition-opacity ml-0.5"
              title="Tag entfernen"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {/* Add-button / Combobox */}
      <div className="relative">
        {!addOpen ? (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-neutral-300 text-neutral-400 hover:border-brand hover:text-brand transition-colors"
          >
            <Tag className="h-3 w-3" />
            Tag hinzufügen
          </button>
        ) : (
          <div className="absolute left-0 top-full mt-1 z-50 w-60 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
            <div className="px-2 pt-2 pb-1.5 border-b border-neutral-100">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCreate) { e.preventDefault(); createAndAdd(); }
                  if (e.key === "Escape") { setAddOpen(false); setQuery(""); }
                }}
                placeholder="Tag suchen oder erstellen …"
                className="w-full text-xs px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-neutral-50 placeholder:text-neutral-400"
              />
            </div>
            <div className="py-1 max-h-64 overflow-y-auto">
              {matchedTags.length === 0 && !showCreate && (
                <p className="text-xs text-neutral-400 text-center py-3">Keine Tags gefunden</p>
              )}

              {/* Exclusive sub-namespace sections — radio behavior */}
              {groupedSections.map(({ namespace, label, tags }, i) => (
                <div key={namespace}>
                  {i > 0 && <div className="mx-2 my-1 border-t border-neutral-100" />}
                  <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {label} <span className="normal-case font-normal">(nur einer)</span>
                  </div>
                  {tags.map((tag: import("@/lib/tags").Tag) => {
                    const ref = tagToRef(tag);
                    const active = currentTags.includes(ref);
                    const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                    return (
                      <button key={ref} onClick={() => { toggle(ref, tag); setAddOpen(false); setQuery(""); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${active ? `${colors.bg} ${colors.text} font-medium` : "text-neutral-700 hover:bg-neutral-50"}`}
                      >
                        <span className={`h-3.5 w-3.5 rounded-full flex-shrink-0 border-2 flex items-center justify-center ${active ? colors.border : "border-neutral-300"}`}>
                          {active && <span className={`h-1.5 w-1.5 rounded-full ${colors.text.replace("text-", "bg-")}`} />}
                        </span>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Akten-specific general tags — checkbox behavior */}
              {aktenGeneralTags.length > 0 && (
                <div>
                  {(groupedSections.length > 0) && <div className="mx-2 my-1 border-t border-neutral-100" />}
                  {(groupedSections.length > 0 || globalTags.length > 0) && (
                    <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Akten</div>
                  )}
                  {aktenGeneralTags.map((tag: import("@/lib/tags").Tag) => {
                    const ref = tagToRef(tag);
                    const active = currentTags.includes(ref);
                    const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                    return (
                      <button key={ref} onClick={() => { toggle(ref, tag); setAddOpen(false); setQuery(""); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${active ? `${colors.bg} ${colors.text} font-medium` : "text-neutral-700 hover:bg-neutral-50"}`}
                      >
                        <span className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border ${active ? `${colors.bg} ${colors.border}` : "border-neutral-300 bg-white"}`}>
                          {active && <Check className={`h-2.5 w-2.5 ${colors.text}`} />}
                        </span>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Global tags (namespace "") — checkbox behavior */}
              {globalTags.length > 0 && (
                <div>
                  {(groupedSections.length > 0 || aktenGeneralTags.length > 0) && <div className="mx-2 my-1 border-t border-neutral-100" />}
                  <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Übergreifend</div>
                  {globalTags.map((tag: import("@/lib/tags").Tag) => {
                    const ref = tagToRef(tag);
                    const active = currentTags.includes(ref);
                    const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                    return (
                      <button key={ref} onClick={() => { toggle(ref, tag); setAddOpen(false); setQuery(""); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${active ? `${colors.bg} ${colors.text} font-medium` : "text-neutral-700 hover:bg-neutral-50"}`}
                      >
                        <span className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border ${active ? `${colors.bg} ${colors.border}` : "border-neutral-300 bg-white"}`}>
                          {active && <Check className={`h-2.5 w-2.5 ${colors.text}`} />}
                        </span>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Create option — new tag lands in akten namespace */}
              {showCreate && (
                <div className="border-t border-neutral-100 mt-0.5 pt-2 px-3 pb-2">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {COLOR_PICKER_OPTIONS.map((c) => {
                      const swatch = TAG_SWATCHES[c] ?? "bg-gray-400";
                      return (
                        <Tooltip key={c}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setNewTagColor(c)}
                              className={`h-4 w-4 rounded-full transition-all ${swatch} ${newTagColor === c ? "ring-2 ring-offset-1 ring-neutral-500 scale-125" : "opacity-70 hover:opacity-100"}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {COLOR_LABELS[c] ?? c}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <button onClick={createAndAdd} disabled={creating}
                    className="w-full flex items-center gap-2 text-left text-xs text-brand hover:bg-brand-subtle transition-colors rounded py-0.5"
                  >
                    <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                    {creating ? "Erstelle …" : <><span className="text-neutral-500">Erstellen: </span><span className="font-medium">&ldquo;{query.trim()}&rdquo;</span></>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aufgaben-Sortierung ───────────────────────────────────────────────────────

type SortBy = "priorität" | "status" | "datum" | "titel";

const SORT_LABELS: Record<SortBy, string> = {
  priorität: "Priorität",
  status:    "Status",
  datum:     "Datum",
  titel:     "Titel",
};

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const priorityRank = (t: Task) => {
    if ((t.tags ?? []).includes("aufgabe/priorität/hoch"))    return 0;
    if ((t.tags ?? []).includes("aufgabe/priorität/mittel"))  return 1;
    if ((t.tags ?? []).includes("aufgabe/priorität/niedrig")) return 2;
    return 3;
  };
  const statusRank = (t: Task) => {
    const order: TaskStatus[] = ["in_bearbeitung", "offen", "erledigt", "abgebrochen"];
    return order.indexOf(t.status);
  };
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "priorität": {
        const d = priorityRank(a) - priorityRank(b);
        return d !== 0 ? d : statusRank(a) - statusRank(b);
      }
      case "status":  return statusRank(a) - statusRank(b);
      case "datum":   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "titel":   return a.title.localeCompare(b.title, "de");
    }
  });
}

// ─── Aufgaben-Tab ──────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; text: string }> = {
  offen: { label: "Offen", dot: "bg-neutral-400", text: "text-neutral-600" },
  in_bearbeitung: { label: "In Bearbeitung", dot: "bg-brand-muted", text: "text-brand-text" },
  erledigt: { label: "Erledigt", dot: "bg-success-muted", text: "text-success-text" },
  abgebrochen: { label: "Abgebrochen", dot: "bg-error-muted", text: "text-error-text" },
};

function AufgabenTab({ caseId }: { caseId: string }) {
  const { currentUser, allUsers, allTags, allNamespaces } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMine, setFilterMine] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("priorität");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/aufgaben?caseId=${caseId}`);
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("aufgaben-updated", handler);
    return () => window.removeEventListener("aufgaben-updated", handler);
  }, [load]);

  const openCreate = () => {
    const detail: AufgabeCreateDetail = {
      draggedSource: { kind: "akte", caseId, label: caseId } as DragSource,
      dropTarget: { kind: "user", userId: currentUser?.id ?? "" } as DropTarget,
    };
    window.dispatchEvent(new CustomEvent(AUFGABE_CREATE_EVENT, { detail }));
  };

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    setUpdatingId(taskId);
    try {
      await fetch(`/api/aufgaben/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, _actorId: currentUser?.id }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
      window.dispatchEvent(new Event("aufgaben-updated"));
    } finally {
      setUpdatingId(null);
    }
  };

  const updateTags = async (taskId: string, tags: string[]) => {
    await fetch(`/api/aufgaben/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, tags } : t)));
  };

  const toggleTaskTag = (task: Task, ref: string) => {
    const current = task.tags ?? [];
    const nsPrefix = ref.slice(0, ref.lastIndexOf("/"));
    const nsConfig = allNamespaces.find((n) => n.namespace === nsPrefix);
    const isExclusive = nsConfig?.exclusive ?? nsPrefix.includes("/");
    let next: string[];
    if (current.includes(ref)) {
      next = current.filter((r) => r !== ref);
    } else if (isExclusive) {
      next = [...current.filter((r) => !r.startsWith(nsPrefix + "/")), ref];
    } else {
      next = [...current, ref];
    }
    updateTags(task.id, next);
  };

  // Tag namespaces assignable to tasks
  const taskTagNamespaces = allNamespaces.filter(
    (ns) => ns.namespace === "" || ns.namespace.startsWith("aufgabe")
  );

  const displayed = sortTasks(
    filterMine && currentUser
      ? tasks.filter((t) => t.assignees.includes(currentUser.id))
      : tasks,
    sortBy
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade Aufgaben…
      </div>
    );
  }

  return (
    <div>
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={(updated) => {
            setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
            setEditingTask(null);
            window.dispatchEvent(new Event("aufgaben-updated"));
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMine(false)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
              !filterMine ? "bg-brand text-white border-brand" : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
            }`}
          >
            Alle ({tasks.length})
          </button>
          <button
            onClick={() => setFilterMine(true)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
              filterMine ? "bg-brand text-white border-brand" : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
            }`}
          >
            Meine ({tasks.filter((t) => t.assignees.includes(currentUser?.id ?? "")).length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-neutral-500 border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus-within:ring-1 focus-within:ring-brand">
            <ArrowUpDown className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-transparent focus:outline-none text-neutral-600 cursor-pointer"
            >
              {(Object.keys(SORT_LABELS) as SortBy[]).map((s) => (
                <option key={s} value={s}>{SORT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-text bg-brand-subtle hover:bg-brand-light px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Aufgabe erstellen
          </button>
        </div>
      </div>

      {/* Empty state */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
          <FileQuestion className="h-12 w-12 opacity-20" />
          <p className="text-sm font-medium text-neutral-500">
            {filterMine ? "Keine Aufgaben für dich in dieser Akte" : "Keine Aufgaben in dieser Akte"}
          </p>
          <p className="text-xs">Erstelle eine Aufgabe oder ziehe einen Bearbeiter auf ein Element.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((task) => {
            const cfg = TASK_STATUS_CONFIG[task.status];
            const auftraggeber = allUsers.find((u) => u.id === task.createdBy);
            const bearbeiter = allUsers.filter((u) => task.assignees.includes(u.id));
            return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: { kind: "task", taskId: task.id } }));
                  e.dataTransfer.effectAllowed = "link";
                }}
                onClick={() => setEditingTask(task)}
                className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col gap-2.5 cursor-pointer select-none hover:border-neutral-300 hover:shadow-sm transition-all"
              >
                {/* Header row */}
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 leading-tight">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  {/* Status */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={task.status}
                      disabled={updatingId === task.id}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); updateStatus(task.id, e.target.value as TaskStatus); }}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium bg-transparent cursor-pointer transition-colors ${cfg.text} border-neutral-200`}
                    >
                      {Object.entries(TASK_STATUS_CONFIG).map(([val, c]) => (
                        <option key={val} value={val}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bearbeiter */}
                {bearbeiter.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-4">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Bearbeiter:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {bearbeiter.map((u) => (
                        <span key={u.id} className="flex items-center gap-1 text-xs bg-neutral-100 rounded-full px-2 py-0.5 text-neutral-700">
                          <span className="w-4 h-4 rounded-full bg-neutral-300 text-[9px] font-semibold flex items-center justify-center text-neutral-700">
                            {u.initials}
                          </span>
                          {u.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked elements */}
                {task.linkedElements.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-4 flex-wrap">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Verknüpft mit:</span>
                    {task.linkedElements.map((el, i) => {
                      const label =
                        el.type === "akte" ? (el.label ?? "Akte") :
                        el.type === "beteiligter" ? (el.label ?? "Beteiligter") :
                        el.type === "dokument" ? el.filename :
                        el.type === "feldgruppe" ? (el.label ?? "Datengruppe") :
                        el.type === "feld" ? (el.label ?? el.fieldId) :
                        el.type === "vorschlag" ? el.fieldLabel : "Element";
                      const typeLabel =
                        el.type === "akte" ? "Akte" :
                        el.type === "beteiligter" ? "Beteiligter" :
                        el.type === "dokument" ? "Dok." :
                        el.type === "feldgruppe" ? "Gruppe" :
                        el.type === "vorschlag" ? "KI-Vorschlag" : "Feld";
                      return (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                          <span className="text-neutral-400">{typeLabel}: </span>{label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Tags */}
                <div className="pl-4 flex flex-wrap gap-1 items-center">
                  {(task.tags ?? []).map((ref) => {
                    const tag = lookupTag(allTags, ref);
                    if (!tag) return null;
                    const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                    return (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => toggleTaskTag(task, ref)}
                        title="Tag entfernen"
                        className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium hover:opacity-70 transition-opacity ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        {tag.label}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    );
                  })}
                  {/* Tag-Picker — kompakt als Popover-ähnliche Inline-Liste */}
                  {taskTagNamespaces.map((ns) => {
                    const nsTags = getTagsByNamespace(allTags, ns.namespace);
                    return nsTags
                      .filter((tag) => {
                        const ref = `${tag.namespace ? tag.namespace + "/" : ""}${tag.name}`;
                        return !(task.tags ?? []).includes(ref);
                      })
                      .map((tag) => {
                        const ref = `${tag.namespace ? tag.namespace + "/" : ""}${tag.name}`;
                        return (
                          <button
                            key={ref}
                            type="button"
                            onClick={() => toggleTaskTag(task, ref)}
                            title={`Tag hinzufügen: ${tag.label}`}
                            className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
                          >
                            + {tag.label}
                          </button>
                        );
                      });
                  })}
                </div>

                {/* Auftraggeber + date */}
                <div className="flex items-center gap-2 pl-4 text-[10px] text-neutral-400">
                  {auftraggeber && <span>von {auftraggeber.name}</span>}
                  <span>·</span>
                  <span>{new Date(task.createdAt).toLocaleDateString("de-DE")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Tab = "beteiligte" | "dokumente" | "daten" | "ki-vorschlaege" | "aufgaben";

export default function AktenDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { allTags } = useUser();

  const [caseData, setCaseData] = useState<CaseFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") ?? "beteiligte") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [inAkteSearch, setInAkteSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string[] | null>(null);
  const [pendingTodoCount, setPendingTodoCount] = useState(0);
  const [headerDragOver, setHeaderDragOver] = useState(false);

  const handleInAkteSearch = (v: string) => {
    setInAkteSearch(v);
    if (v.trim()) setTab("daten");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Generierung fehlgeschlagen.");
        return;
      }
      setGenerateSuccess(data.files ?? []);
      setTab("dokumente");
    } finally {
      setGenerating(false);
    }
  };

  const loadCase = useCallback(() => {
    fetch(`/api/cases/${caseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCaseData(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { loadCase(); }, [loadCase]);

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then((all: { caseId: string; proposals: unknown[] }[]) => {
        const group = all.find((g) => g.caseId === caseId);
        setPendingTodoCount(group ? group.proposals.length : 0);
      })
      .catch(() => {});
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-neutral-400">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Lade Akte…
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4">
        <p className="text-error font-medium">⚠ {error ?? "Akte nicht gefunden."}</p>
        <Button variant="outline" onClick={() => router.push("/akten")}>← Zurück zu Akten</Button>
      </div>
    );
  }

  const beteiligte = extractBeteiligte(caseData);
  const glaeubigerCount = beteiligte.filter((b) => b.rolle === "Gläubiger").length;
  const vermieterCount = beteiligte.filter((b) => b.isVermieter).length;
  const hasArbeitgeber = beteiligte.some((b) => b.rolle === "Arbeitgeber");

  const summaryParts = [
    "1 Schuldner",
    glaeubigerCount > 0 && `${glaeubigerCount} Gläubiger${vermieterCount > 0 ? ` (${vermieterCount} Vermieter)` : ""}`,
    hasArbeitgeber && "1 Arbeitgeber",
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header (case info + tabs) ──────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 pt-5 pb-0">
          {/* Case title row */}
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_KEY)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "link";
                  setHeaderDragOver(true);
                }
              }}
              onDragLeave={() => setHeaderDragOver(false)}
              onDrop={(e) => {
                setHeaderDragOver(false);
                const dragged = parseDragSource(e);
                if (dragged) {
                  e.preventDefault();
                  fireDragCreateEvent(dragged, { kind: "akte", caseId, label: caseData?.aktenzeichenDisplay ?? caseData?.aktenzeichen ?? caseId });
                }
              }}
              className={`rounded-lg transition-colors px-2 -mx-2 ${headerDragOver ? "bg-brand-subtle ring-2 ring-brand/30" : ""}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-neutral-900">
                  {caseData.aktenzeichenDisplay ?? caseData.aktenzeichen ?? caseData.filename}
                </h1>
                <StatusBadge status={caseData.status} />
              </div>
              {caseData.schuldnerName && (
                <p className="text-sm text-neutral-500">{caseData.schuldnerName}</p>
              )}
              <InlineTagEditor
                currentTags={caseData.tags ?? []}
                allTags={allTags}
                onSave={async (tags) => {
                  setCaseData((prev) => prev ? { ...prev, tags } : prev);
                  await fetch(`/api/akten/${caseId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tags }),
                  });
                  window.dispatchEvent(new Event("akten-updated"));
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-neutral-400 hover:text-red-600 hover:bg-red-50 px-2"
                onClick={async () => {
                  if (!confirm("Akte unwiderruflich löschen? Alle Daten und Dokumente werden entfernt.")) return;
                  await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
                  window.dispatchEvent(new Event("akten-updated"));
                  router.push("/akten");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {caseData.status === "review_complete" ? (
                generateSuccess ? (
                  <div className="flex items-center gap-3">
                    <span className="text-success-text text-xs font-medium">
                      ✓ {generateSuccess.length} Brief(e) gespeichert
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setTab("dokumente")}>
                      Dokumente ansehen
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="gap-1.5" disabled={generating} onClick={handleGenerate}>
                    <FileDown className="h-4 w-4" />
                    {generating ? "Generiere…" : "Dokumente erstellen"}
                  </Button>
                )
              ) : (
                <Link href={`/cases/${caseId}/review`}>
                  <Button variant="outline" size="sm">Zur Prüfung →</Button>
                </Link>
              )}
            </div>
          </div>

          {/* Tabs + In-Akte-Suche */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {(["beteiligte", "dokumente", "daten", "ki-vorschlaege", "aufgaben"] as Tab[]).map((t) => {
                const labels: Record<Tab, string> = {
                  beteiligte: "Beteiligte",
                  dokumente: "Dokumente",
                  daten: "Daten",
                  "ki-vorschlaege": "KI-Vorschläge",
                  aufgaben: "Aufgaben",
                };
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      tab === t
                        ? "border-brand text-brand-text"
                        : "border-transparent text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {t === "ki-vorschlaege" && pendingTodoCount > 0 ? (
                      <span className="flex items-center gap-1.5">
                        {labels[t]}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning text-white leading-none">
                          {pendingTodoCount}
                        </span>
                      </span>
                    ) : labels[t]}
                  </button>
                );
              })}
            </div>

            {/* In-Akte-Suche */}
            <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="In dieser Akte suchen…"
                  value={inAkteSearch}
                  onChange={(e) => handleInAkteSearch(e.target.value)}
                  className="pl-8 pr-7 py-1 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand w-52"
                />
                {inAkteSearch && (
                  <button
                    onClick={() => handleInAkteSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 whitespace-nowrap">Nur in dieser Akte</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable tab content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {tab === "beteiligte" && (
            <div className="space-y-8">
              <p className="text-sm text-neutral-500">{summaryParts}</p>
              <BeteiligteSection label="Schuldner" rolle="Schuldner" beteiligte={beteiligte} caseId={caseId} onUpdate={loadCase} />
              <BeteiligteSection label="Gläubiger" rolle="Gläubiger" beteiligte={beteiligte} caseId={caseId} onUpdate={loadCase} />
              <BeteiligteSection label="Arbeitgeber" rolle="Arbeitgeber" beteiligte={beteiligte} caseId={caseId} onUpdate={loadCase} />
              <BeteiligteSection label="Verfahrensbevollmächtigte(r)" rolle="Verfahrensbevollmächtigte(r)" beteiligte={beteiligte} caseId={caseId} onUpdate={loadCase} />
            </div>
          )}

          {tab === "dokumente" && <DokumenteTab caseId={caseId} />}

          {tab === "daten" && <DatenTab caseData={caseData} caseId={caseId} onUpdate={loadCase} search={inAkteSearch} onSearchChange={handleInAkteSearch} />}

          {tab === "ki-vorschlaege" && <TodosTab caseId={caseId} />}

          {tab === "aufgaben" && <AufgabenTab caseId={caseId} />}
        </div>
      </div>
    </div>
  );
}
