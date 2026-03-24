"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, MessageSquare, Send, X } from "lucide-react";
import { DocumentPreviewModal } from "@/components/custom/CC-08-DocumentPreview";
import type { PreviewFile } from "@/components/custom/CC-08-DocumentPreview";
import { useUser } from "@/lib/user-context";
import type { LinkedElement, Task, TaskStatus, TaskHistoryEntry, TaskComment } from "@/lib/storage/task-store";
import type { User } from "@/lib/storage/user-store";
import type { CaseFile, CaseFieldGroup } from "@/lib/extraction/types";
import { extractBeteiligte } from "@/lib/beteiligte/extract-beteiligte";
import { TAG_COLORS, getTagsByNamespace } from "@/lib/tags";
import type { TagRef } from "@/lib/tags";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function linkedElementKey(el: LinkedElement): string {
  if (el.type === "akte") return `akte:${el.caseId}`;
  if (el.type === "beteiligter") return `beteiligter:${el.caseId}:${el.groupId}:${el.beteiligterId}`;
  if (el.type === "dokument") return `dokument:${el.caseId}:${el.folder}:${el.filename}`;
  if (el.type === "feldgruppe") return `feldgruppe:${el.caseId}:${el.groupId}:${String(el.instanceIndex ?? "")}`;
  if (el.type === "feld") return `feld:${el.caseId}:${el.groupId}:${el.fieldId}:${String(el.instanceIndex ?? "")}`;
  if (el.type === "vorschlag") return `vorschlag:${el.caseId}:${el.proposalId}`;
  return JSON.stringify(el);
}

function labelFromLinkedElement(el: LinkedElement): string {
  if (el.type === "akte") return el.label ?? "Akte";
  if (el.type === "beteiligter") return el.label ?? "Beteiligter";
  if (el.type === "dokument") return el.filename;
  if (el.type === "feldgruppe") return el.label ?? "Datengruppe";
  if (el.type === "feld") return el.label ?? el.fieldId;
  if (el.type === "vorschlag") return `${el.fieldLabel} (${el.filename})`;
  return "Element";
}

function typeFromLinkedElement(el: LinkedElement): string {
  if (el.type === "akte") return "Akte";
  if (el.type === "beteiligter") return "Beteiligter";
  if (el.type === "dokument") return "Dok.";
  if (el.type === "feldgruppe") return "Gruppe";
  if (el.type === "feld") return "Feld";
  if (el.type === "vorschlag") return "KI-Vorschlag";
  return "Element";
}

function hrefFromLinkedElement(el: LinkedElement): string {
  if (el.type === "dokument") return `/akten/${el.caseId}/dokument-review?doc=${el.folder}/${el.filename}`;
  if (el.type === "vorschlag") return `/akten/${el.caseId}/dokument-review?doc=${el.folder}/${el.filename}`;
  if (el.type === "beteiligter") return `/akten/${el.caseId}?tab=beteiligte`;
  if (el.type === "feldgruppe") return `/akten/${el.caseId}?tab=daten`;
  if (el.type === "feld") return `/akten/${el.caseId}?tab=daten`;
  return `/akten/${el.caseId}`;
}

// ─── History helpers ───────────────────────────────────────────────────────────

function historyLabel(entry: TaskHistoryEntry, allUsers: User[]): string {
  const who = entry.authorId ? (allUsers.find((u) => u.id === entry.authorId)?.name ?? "Jemand") : "System";
  switch (entry.type) {
    case "created":             return `${who} hat die Aufgabe erstellt`;
    case "status_changed":      return `${who} hat Status geändert: ${statusLabel(entry.from)} → ${statusLabel(entry.to)}`;
    case "title_changed":       return `${who} hat den Titel geändert`;
    case "description_changed": return `${who} hat die Beschreibung geändert`;
    case "assignees_changed": {
      const parts: string[] = [];
      if (entry.added.length)   parts.push(`${entry.added.map((id) => allUsers.find((u) => u.id === id)?.name ?? id).join(", ")} zugewiesen`);
      if (entry.removed.length) parts.push(`${entry.removed.map((id) => allUsers.find((u) => u.id === id)?.name ?? id).join(", ")} entfernt`);
      return `${who}: ${parts.join(" · ")}`;
    }
    case "tags_changed": {
      const parts: string[] = [];
      if (entry.added.length)   parts.push(`+${entry.added.join(", ")}`);
      if (entry.removed.length) parts.push(`−${entry.removed.join(", ")}`);
      return `${who} hat Tags geändert (${parts.join(" ")})`;
    }
    case "linked_elements_changed": return `${who} hat verknüpfte Elemente geändert`;
    case "comment_added":           return `${who} hat einen Kommentar hinzugefügt`;
  }
}

function statusLabel(s: TaskStatus): string {
  const map: Record<TaskStatus, string> = { offen: "Offen", in_bearbeitung: "In Bearbeitung", erledigt: "Erledigt", abgebrochen: "Abgebrochen" };
  return map[s];
}

function historyDot(type: TaskHistoryEntry["type"]): string {
  switch (type) {
    case "created":         return "bg-brand";
    case "status_changed":  return "bg-neutral-400";
    case "comment_added":   return "bg-sec-muted";
    default:                return "bg-neutral-300";
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 24 }: { user: User; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 bg-neutral-200 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt={user.name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
      ) : (
        <span className="text-[10px] font-semibold text-neutral-600">{user.initials}</span>
      )}
    </div>
  );
}

function UserPicker({ allUsers, selected, onToggle }: { allUsers: User[]; selected: string[]; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = allUsers.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Bearbeiter suchen…"
        className="w-full px-3 py-2 text-xs border-b border-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand bg-neutral-50 placeholder:text-neutral-400"
      />
      <div className="max-h-36 overflow-y-auto divide-y divide-neutral-50">
        {filtered.map((u) => {
          const isSelected = selected.includes(u.id);
          return (
            <button key={u.id} type="button" onClick={() => onToggle(u.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${isSelected ? "bg-brand-light/40" : "hover:bg-neutral-50"}`}
            >
              <UserAvatar user={u} size={20} />
              <span className="flex-1 text-neutral-800">{u.name}</span>
              {isSelected && <Check className="h-3.5 w-3.5 text-brand flex-shrink-0" />}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-neutral-400 text-center py-3">Keine Treffer</p>}
      </div>
    </div>
  );
}

// ─── Element picker ────────────────────────────────────────────────────────────

type DocFolders = Record<string, string[]>;

function ElementPicker({ caseId, linkedElements, onToggle }: { caseId: string; linkedElements: LinkedElement[]; onToggle: (el: LinkedElement) => void }) {
  const [open, setOpen] = useState(false);
  const [caseData, setCaseData] = useState<CaseFile | null>(null);
  const [docs, setDocs] = useState<DocFolders>({});
  const [loading, setLoading] = useState(false);
  const [openSection, setOpenSection] = useState<"beteiligte" | "dokumente" | "feldgruppen" | null>(null);

  const linkedKeys = new Set(linkedElements.map(linkedElementKey));

  const load = async () => {
    if (caseData) return;
    setLoading(true);
    try {
      const [caseRes, docsRes] = await Promise.all([fetch(`/api/cases/${caseId}`), fetch(`/api/cases/${caseId}/documents`)]);
      if (caseRes.ok) setCaseData(await caseRes.json());
      if (docsRes.ok) {
        const raw = await docsRes.json() as { eingehend?: string[]; ausgehend?: string[]; zu_verarbeiten?: string[] };
        const result: DocFolders = {};
        if (raw.eingehend?.length) result["eingehend"] = raw.eingehend;
        if (raw.ausgehend?.length) result["ausgehend"] = raw.ausgehend;
        if (raw.zu_verarbeiten?.length) result["zu_verarbeiten"] = raw.zu_verarbeiten;
        setDocs(result);
      }
    } finally { setLoading(false); }
  };

  const isLinked = (el: LinkedElement) => linkedKeys.has(linkedElementKey(el));
  const beteiligte = caseData ? extractBeteiligte(caseData) : [];
  const groups: CaseFieldGroup[] = caseData?.fieldGroups ?? [];

  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <button type="button" onClick={() => { if (!open) load(); setOpen((v) => !v); }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors bg-neutral-50"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
        Weitere Elemente aus der Akte hinzufügen
      </button>
      {open && (
        <div className="border-t border-neutral-100">
          {loading && <p className="text-xs text-neutral-400 text-center py-4">Lade…</p>}
          {!loading && (
            <div className="divide-y divide-neutral-100">
              {beteiligte.length > 0 && (
                <div>
                  <button type="button" onClick={() => setOpenSection((s) => s === "beteiligte" ? null : "beteiligte")}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                  >
                    {openSection === "beteiligte" ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-medium">Beteiligte</span><span className="text-neutral-400">({beteiligte.length})</span>
                  </button>
                  {openSection === "beteiligte" && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                      {beteiligte.map((b) => {
                        const el: LinkedElement = { type: "beteiligter", caseId, groupId: b.details[0]?.groupId ?? b.id, beteiligterId: b.id, label: b.name };
                        const linked = isLinked(el);
                        return (
                          <button key={b.id} type="button" onClick={() => onToggle(el)}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${linked ? "bg-brand-light text-brand-text border-brand-border" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}
                          >
                            {linked && <Check className="inline h-3 w-3 mr-0.5" />}{b.name}<span className="ml-1 text-[10px] opacity-60">{b.rolle}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {Object.keys(docs).length > 0 && (
                <div>
                  <button type="button" onClick={() => setOpenSection((s) => s === "dokumente" ? null : "dokumente")}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                  >
                    {openSection === "dokumente" ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-medium">Dokumente</span><span className="text-neutral-400">({Object.values(docs).flat().length})</span>
                  </button>
                  {openSection === "dokumente" && (
                    <div className="px-3 pb-2 space-y-2">
                      {Object.entries(docs).map(([folder, filenames]) => (
                        <div key={folder}>
                          <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide mb-1">{folder}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {filenames.map((filename) => {
                              const el: LinkedElement = { type: "dokument", caseId, folder, filename };
                              const linked = isLinked(el);
                              return (
                                <button key={filename} type="button" onClick={() => onToggle(el)}
                                  className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${linked ? "bg-brand-light text-brand-text border-brand-border" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}
                                >
                                  {linked && <Check className="inline h-3 w-3 mr-0.5" />}{filename}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {groups.length > 0 && (
                <div>
                  <button type="button" onClick={() => setOpenSection((s) => s === "feldgruppen" ? null : "feldgruppen")}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                  >
                    {openSection === "feldgruppen" ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-medium">Datengruppen</span><span className="text-neutral-400">({groups.length})</span>
                  </button>
                  {openSection === "feldgruppen" && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                      {groups.flatMap((g) => {
                        if (g.isArray && g.instances && g.instances.length > 0) {
                          return g.instances.map((_, idx) => {
                            const el: LinkedElement = { type: "feldgruppe", caseId, groupId: g.groupId, instanceIndex: idx, label: `${g.label} ${idx + 1}` };
                            const linked = isLinked(el);
                            return (
                              <button key={`${g.groupId}-${idx}`} type="button" onClick={() => onToggle(el)}
                                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${linked ? "bg-brand-light text-brand-text border-brand-border" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}
                              >
                                {linked && <Check className="inline h-3 w-3 mr-0.5" />}{g.label} {idx + 1}
                              </button>
                            );
                          });
                        }
                        const el: LinkedElement = { type: "feldgruppe", caseId, groupId: g.groupId, label: g.label };
                        const linked = isLinked(el);
                        return [(
                          <button key={g.groupId} type="button" onClick={() => onToggle(el)}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${linked ? "bg-brand-light text-brand-text border-brand-border" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}
                          >
                            {linked && <Check className="inline h-3 w-3 mr-0.5" />}{g.label}
                          </button>
                        )];
                      })}
                    </div>
                  )}
                </div>
              )}
              {beteiligte.length === 0 && Object.keys(docs).length === 0 && groups.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-3">Keine weiteren Elemente</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Verlauf & Kommentare ──────────────────────────────────────────────────────

function VerlaufTab({ task, allUsers, currentUser, onUpdated }: {
  task: Task;
  allUsers: User[];
  currentUser: User | null;
  onUpdated: (t: Task) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Build a merged, chronological timeline of history + comments
  type TimelineEntry =
    | { kind: "history"; entry: TaskHistoryEntry }
    | { kind: "comment"; comment: TaskComment };

  const timeline: TimelineEntry[] = [
    ...(task.history ?? []).map((entry) => ({ kind: "history" as const, entry })),
    ...(task.comments ?? []).map((comment) => ({ kind: "comment" as const, comment })),
  ].sort((a, b) => {
    const ta = a.kind === "history" ? a.entry.timestamp : a.comment.createdAt;
    const tb = b.kind === "history" ? b.entry.timestamp : b.comment.createdAt;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });

  // Skip "comment_added" history entries — the comment itself appears inline
  const filtered = timeline.filter(
    (item) => !(item.kind === "history" && item.entry.type === "comment_added")
  );

  const submitComment = async () => {
    if (!commentText.trim() || !currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/aufgaben/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim(), authorId: currentUser.id }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        onUpdated(updated);
        setCommentText("");
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full">
      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
        {filtered.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-8">Noch keine Einträge</p>
        )}
        {filtered.map((item, i) => {
          if (item.kind === "history") {
            const entry = item.entry;
            return (
              <div key={entry.id ?? i} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${historyDot(entry.type)}`} />
                  {i < filtered.length - 1 && <span className="w-px flex-1 bg-neutral-100 mt-1 min-h-[12px]" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-xs text-neutral-600">{historyLabel(entry, allUsers)}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{fmt(entry.timestamp)}</p>
                </div>
              </div>
            );
          } else {
            const comment = item.comment;
            const author = allUsers.find((u) => u.id === comment.authorId);
            const isOwn = comment.authorId === currentUser?.id;
            return (
              <div key={comment.id} className={`flex items-start gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                <div className="flex-shrink-0 pt-0.5">
                  {author ? (
                    <UserAvatar user={author} size={22} />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center">
                      <MessageSquare className="h-3 w-3 text-neutral-400" />
                    </span>
                  )}
                </div>
                <div className={`flex flex-col gap-0.5 max-w-[80%] ${isOwn ? "items-end" : "items-start"}`}>
                  <div className={`text-xs px-3 py-2 rounded-2xl leading-relaxed ${
                    isOwn
                      ? "bg-brand text-white rounded-tr-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                  }`}>
                    {comment.text}
                  </div>
                  <p className="text-[10px] text-neutral-400 px-1">
                    {author?.name ?? "Unbekannt"} · {fmt(comment.createdAt)}
                  </p>
                </div>
              </div>
            );
          }
        })}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50 flex items-end gap-2">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }
          }}
          placeholder="Kommentar schreiben…"
          rows={2}
          className="flex-1 text-xs px-3 py-2 border border-neutral-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-neutral-400 bg-white"
        />
        <button
          type="button"
          onClick={submitComment}
          disabled={submitting || !commentText.trim()}
          className="p-2 rounded-xl bg-brand text-white hover:bg-brand-hover disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Status options ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "offen",          label: "Offen",          dot: "bg-neutral-400"    },
  { value: "in_bearbeitung", label: "In Bearbeitung", dot: "bg-brand-muted"    },
  { value: "erledigt",       label: "Erledigt",       dot: "bg-success-muted"  },
  { value: "abgebrochen",    label: "Abgebrochen",    dot: "bg-error-muted"    },
];

// ─── TaskEditModal ──────────────────────────────────────────────────────────────

export function TaskEditModal({
  task: initialTask,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const { currentUser, allUsers, allTags, allNamespaces } = useUser();
  const titleRef = useRef<HTMLInputElement>(null);

  // Keep local copy that also reflects comment/history updates
  const [task, setTask] = useState<Task>(initialTask);
  const [activeTab, setActiveTab] = useState<"felder" | "verlauf">("felder");

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignees, setAssignees] = useState<string[]>(task.assignees);
  const [tags, setTags] = useState<TagRef[]>(task.tags ?? []);
  const [linkedElements, setLinkedElements] = useState<LinkedElement[]>(task.linkedElements);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const commentCount = task.comments?.length ?? 0;

  const taskTagNamespaces = allNamespaces.filter(
    (ns) => ns.namespace === "" || ns.namespace.startsWith("aufgabe")
  );

  useEffect(() => {
    if (activeTab === "felder") setTimeout(() => titleRef.current?.focus(), 40);
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleAssignee = (userId: string) =>
    setAssignees((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);

  const toggleTag = (ref: TagRef) => {
    setTags((prev) => {
      const ns = allNamespaces.find((n) => ref.startsWith(n.namespace + "/") || ref === n.namespace);
      const isExclusive = ns?.exclusive ?? ref.includes("/");
      if (prev.includes(ref)) return prev.filter((r) => r !== ref);
      if (isExclusive) {
        const nsPrefix = ref.slice(0, ref.lastIndexOf("/"));
        return [...prev.filter((r) => !r.startsWith(nsPrefix + "/")), ref];
      }
      return [...prev, ref];
    });
  };

  const toggleLinkedElement = (el: LinkedElement) => {
    const key = linkedElementKey(el);
    setLinkedElements((prev) => {
      const exists = prev.some((e) => linkedElementKey(e) === key);
      return exists ? prev.filter((e) => linkedElementKey(e) !== key) : [...prev, el];
    });
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Titel ist Pflicht"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/aufgaben/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          assignees,
          tags,
          linkedElements,
          _actorId: currentUser?.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Speichern");
        return;
      }
      const updated: Task = await res.json();
      onSaved(updated);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-1">
            {(["felder", "verlauf"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-brand-subtle text-brand"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {tab === "felder" ? "Bearbeiten" : (
                  <span className="flex items-center gap-1">
                    Verlauf
                    {commentCount > 0 && (
                      <span className="text-[10px] font-bold bg-brand text-white rounded-full px-1.5 leading-4">{commentCount}</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {activeTab === "felder" ? (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Titel <span className="text-error">*</span></label>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e); } }}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Details zur Aufgabe (optional)…"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-neutral-400 resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Status</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map(({ value, label, dot }) => (
                    <button key={value} type="button" onClick={() => setStatus(value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        status === value ? "bg-brand text-white border-brand" : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === value ? "bg-white/70" : dot}`} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bearbeiter */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Bearbeiter</label>
                {assignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {assignees.map((uid) => {
                      const u = allUsers.find((x) => x.id === uid);
                      if (!u) return null;
                      return (
                        <div key={uid} className="flex items-center gap-1.5 bg-brand-light/60 border border-brand-border rounded-full px-2 py-0.5 text-xs text-brand-text">
                          <UserAvatar user={u} size={16} />
                          <span>{u.name}</span>
                          <button type="button" onClick={() => toggleAssignee(uid)} className="hover:opacity-60"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <UserPicker allUsers={allUsers} selected={assignees} onToggle={toggleAssignee} />
              </div>

              {/* Tags */}
              {taskTagNamespaces.some((ns) => getTagsByNamespace(allTags, ns.namespace).length > 0) && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Tags</label>
                  <div className="space-y-2">
                    {taskTagNamespaces.map((ns) => {
                      const nsTags = getTagsByNamespace(allTags, ns.namespace);
                      if (nsTags.length === 0) return null;
                      return (
                        <div key={ns.namespace}>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">{ns.label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {nsTags.map((tag) => {
                              const ref = `${tag.namespace ? tag.namespace + "/" : ""}${tag.name}` as TagRef;
                              const active = tags.includes(ref);
                              const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                              return (
                                <button key={ref} type="button" onClick={() => toggleTag(ref)}
                                  className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${active ? `${colors.bg} ${colors.text} ${colors.border}` : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"}`}
                                >
                                  {tag.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Linked elements */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Verknüpfte Elemente</label>
                {linkedElements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {linkedElements.map((el) => {
                      const isDoc = el.type === "dokument" || el.type === "vorschlag";
                      const folder = el.type === "dokument" ? el.folder : el.type === "vorschlag" ? el.folder : "";
                      const filename = el.type === "dokument" ? el.filename : el.type === "vorschlag" ? el.filename : "";
                      const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
                      return (
                        <div key={linkedElementKey(el)} className="flex items-center gap-1 text-xs bg-neutral-100 border border-neutral-200 rounded-full px-2 py-0.5 text-neutral-700">
                          <span className="text-neutral-400 text-[10px]">{typeFromLinkedElement(el)}:</span>
                          {isDoc ? (
                            <button
                              type="button"
                              onClick={() => setPreviewFile({ folder, filename, ext, url: `/api/cases/${task.caseId}/documents/${folder}/${encodeURIComponent(filename)}` })}
                              className="font-medium truncate max-w-[140px] hover:underline hover:text-brand transition-colors text-left"
                            >
                              {labelFromLinkedElement(el)}
                            </button>
                          ) : (
                            <Link
                              href={hrefFromLinkedElement(el)}
                              onClick={onClose}
                              className="font-medium truncate max-w-[140px] hover:underline hover:text-brand transition-colors"
                            >
                              {labelFromLinkedElement(el)}
                            </Link>
                          )}
                          <button type="button" onClick={() => toggleLinkedElement(el)} className="hover:opacity-60 flex-shrink-0"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <ElementPicker caseId={task.caseId} linkedElements={linkedElements} onToggle={toggleLinkedElement} />
              </div>

              {error && <p className="text-xs text-error font-medium">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex-shrink-0">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors">
                Abbrechen
              </button>
              <button type="submit" disabled={submitting || !title.trim()}
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Speichere…" : "Änderungen speichern"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <VerlaufTab
              task={task}
              allUsers={allUsers}
              currentUser={currentUser}
              onUpdated={(updated) => {
                setTask(updated);
                // Also propagate so parent list can update comment count etc.
                onSaved(updated);
              }}
            />
          </div>
        )}
      </div>
    </div>
    {previewFile && (
      <DocumentPreviewModal
        file={previewFile}
        caseId={task.caseId}
        onClose={() => setPreviewFile(null)}
      />
    )}
    </>
  );
}
