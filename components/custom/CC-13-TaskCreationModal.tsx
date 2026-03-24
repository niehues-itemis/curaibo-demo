"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { useUser } from "@/lib/user-context";
import type { AufgabeCreateDetail, DragSource } from "@/lib/drag-types";
import type { LinkedElement, Task, TaskStatus } from "@/lib/storage/task-store";
import type { User } from "@/lib/storage/user-store";
import { lookupTag, TAG_COLORS, getTagsByNamespace } from "@/lib/tags";
import type { TagRef } from "@/lib/tags";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function linkedElementFromSource(source: DragSource): LinkedElement | null {
  if (source.kind === "user") return null;
  if (source.kind === "akte") return { type: "akte", caseId: source.caseId, label: source.label };
  if (source.kind === "beteiligter") return { type: "beteiligter", caseId: source.caseId, groupId: source.groupId, beteiligterId: source.beteiligterId, label: source.label };
  if (source.kind === "dokument") return { type: "dokument", caseId: source.caseId, folder: source.folder, filename: source.filename };
  if (source.kind === "feldgruppe") return { type: "feldgruppe", caseId: source.caseId, groupId: source.groupId, instanceIndex: source.instanceIndex, label: source.label };
  if (source.kind === "vorschlag") return { type: "vorschlag", caseId: source.caseId, proposalId: source.proposalId, fieldLabel: source.fieldLabel, folder: source.folder, filename: source.filename };
  return null;
}

function caseIdFromSources(a: DragSource, b: DragSource): string {
  if (a.kind !== "user" && "caseId" in a) return a.caseId;
  if (b.kind !== "user" && "caseId" in b) return b.caseId;
  return "";
}

function labelFromLinkedElement(el: LinkedElement): string {
  if (el.type === "akte") return el.label ?? `Akte`;
  if (el.type === "beteiligter") return el.label ?? `Beteiligter`;
  if (el.type === "dokument") return el.filename;
  if (el.type === "feldgruppe") return el.label ?? `Datengruppe`;
  if (el.type === "feld") return el.label ?? el.fieldId;
  if (el.type === "vorschlag") return `${el.fieldLabel} (${el.filename})`;
  return "Element";
}

function typeFromLinkedElement(el: LinkedElement): string {
  if (el.type === "akte") return "Akte";
  if (el.type === "beteiligter") return "Beteiligter";
  if (el.type === "dokument") return "Dokument";
  if (el.type === "feldgruppe") return "Datengruppe";
  if (el.type === "feld") return "Feld";
  if (el.type === "vorschlag") return "KI-Vorschlag";
  return "Element";
}

// ─── UserAvatar ────────────────────────────────────────────────────────────────

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

// ─── UserPicker ────────────────────────────────────────────────────────────────

function UserPicker({
  allUsers,
  selected,
  onToggle,
  exclude,
}: {
  allUsers: User[];
  selected: string[];
  onToggle: (userId: string) => void;
  exclude?: string[];
}) {
  const [query, setQuery] = useState("");
  const filtered = allUsers
    .filter((u) => !(exclude ?? []).includes(u.id))
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Bearbeiter suchen…"
        className="w-full px-3 py-2 text-xs border-b border-neutral-100 focus:outline-none focus:ring-1 focus:ring-brand bg-neutral-50 placeholder:text-neutral-400"
      />
      <div className="max-h-40 overflow-y-auto divide-y divide-neutral-50">
        {filtered.map((u) => {
          const isSelected = selected.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                isSelected ? "bg-brand-light/40" : "hover:bg-neutral-50"
              }`}
            >
              <UserAvatar user={u} size={20} />
              <span className="flex-1 text-neutral-800">{u.name}</span>
              {isSelected && <Check className="h-3.5 w-3.5 text-brand flex-shrink-0" />}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">Keine Treffer</p>
        )}
      </div>
    </div>
  );
}

// ─── TaskCreationModal ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "offen", label: "Offen", dot: "bg-neutral-400" },
  { value: "in_bearbeitung", label: "In Bearbeitung", dot: "bg-brand-muted" },
  { value: "erledigt", label: "Erledigt", dot: "bg-success-muted" },
  { value: "abgebrochen", label: "Abgebrochen", dot: "bg-error-muted" },
];

export function TaskCreationModal({
  payload,
  onClose,
  onCreated,
}: {
  payload: AufgabeCreateDetail | null;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const { currentUser, allUsers, allTags, allNamespaces } = useUser();
  const titleRef = useRef<HTMLInputElement>(null);

  // Derive initial values from payload
  const { draggedSource, dropTarget } = payload ?? { draggedSource: null, dropTarget: null };

  const initialAssigneeId =
    draggedSource?.kind === "user"
      ? draggedSource.userId
      : dropTarget?.kind === "user"
      ? dropTarget.userId
      : null;

  const elementSource =
    draggedSource?.kind !== "user"
      ? draggedSource
      : dropTarget?.kind !== "user"
      ? dropTarget
      : null;

  const caseId = payload
    ? caseIdFromSources(draggedSource!, dropTarget!)
    : "";

  const initialLinkedElement = elementSource
    ? linkedElementFromSource(elementSource as DragSource)
    : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("offen");
  const [assignees, setAssignees] = useState<string[]>(
    initialAssigneeId ? [initialAssigneeId] : []
  );
  const [tags, setTags] = useState<TagRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Namespaces that can be assigned to tasks directly
  const taskTagNamespaces = allNamespaces.filter((ns) =>
    ns.namespace === "" || ns.namespace.startsWith("aufgabe")
  );

  const toggleTag = (ref: TagRef) => {
    setTags((prev) => {
      const ns = allNamespaces.find((n) => ref.startsWith(n.namespace + "/") || ref === n.namespace);
      const isExclusive = ns?.exclusive ?? ref.includes("/");
      if (prev.includes(ref)) return prev.filter((r) => r !== ref);
      if (isExclusive) {
        // Remove other tags from the same namespace
        const nsPrefix = ref.slice(0, ref.lastIndexOf("/"));
        return [...prev.filter((r) => !r.startsWith(nsPrefix + "/")), ref];
      }
      return [...prev, ref];
    });
  };

  // Reset state when payload changes
  useEffect(() => {
    setTitle("");
    setDescription("");
    setStatus("offen");
    setTags([]);
    setAssignees(initialAssigneeId ? [initialAssigneeId] : []);
    setError(null);
    setTimeout(() => titleRef.current?.focus(), 40);
  }, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleAssignee = (userId: string) => {
    setAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Titel ist Pflicht"); return; }
    if (!caseId) { setError("Keine Akte zugeordnet"); return; }
    if (!currentUser) { setError("Kein aktiver Benutzer"); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/aufgaben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          tags,
          createdBy: currentUser.id,
          assignees,
          linkedElements: initialLinkedElement ? [initialLinkedElement] : [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fehler beim Erstellen");
        return;
      }
      const task: Task = await res.json();
      onCreated(task);
    } finally {
      setSubmitting(false);
    }
  };

  if (!payload) return null;

  const auftraggeber = currentUser;
  const linkedEl = initialLinkedElement;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">Aufgabe erstellen</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Linked element info */}
            {linkedEl && (
              <div className="bg-neutral-50 rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs text-neutral-600">
                <span className="font-medium text-neutral-400 uppercase tracking-wide text-[10px]">
                  {typeFromLinkedElement(linkedEl)}:
                </span>
                <span className="font-medium text-neutral-800 truncate">{labelFromLinkedElement(linkedEl)}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Titel <span className="text-error">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Kurze Beschreibung der Aufgabe…"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-neutral-400"
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
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      status === value
                        ? "bg-brand text-white border-brand"
                        : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === value ? "bg-white/70" : dot}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Auftraggeber */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Auftraggeber</label>
              {auftraggeber ? (
                <div className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
                  <UserAvatar user={auftraggeber} size={20} />
                  <span className="text-xs text-neutral-800">{auftraggeber.name}</span>
                  <span className="text-[10px] text-neutral-400 ml-auto">Aktueller Nutzer</span>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">Kein Nutzer aktiv</p>
              )}
            </div>

            {/* Bearbeiter */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Bearbeiter</label>
              {/* Selected assignees chips */}
              {assignees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {assignees.map((uid) => {
                    const u = allUsers.find((x) => x.id === uid);
                    if (!u) return null;
                    return (
                      <div key={uid} className="flex items-center gap-1.5 bg-brand-light/60 border border-brand-border rounded-full px-2 py-0.5 text-xs text-brand-text">
                        <UserAvatar user={u} size={16} />
                        <span>{u.name}</span>
                        <button type="button" onClick={() => toggleAssignee(uid)} className="hover:opacity-60">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <UserPicker
                allUsers={allUsers}
                selected={assignees}
                onToggle={toggleAssignee}
              />
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
                              <button
                                key={ref}
                                type="button"
                                onClick={() => toggleTag(ref)}
                                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                                  active
                                    ? `${colors.bg} ${colors.text} ${colors.border}`
                                    : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
                                }`}
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
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((ref) => {
                      const tag = lookupTag(allTags, ref);
                      if (!tag) return null;
                      const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                      return (
                        <span key={ref} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                          {tag.label}
                          <button type="button" onClick={() => toggleTag(ref)} className="hover:opacity-60">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-error font-medium">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Erstelle…" : "Aufgabe erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
