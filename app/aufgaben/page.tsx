"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpDown,
  CheckSquare,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Task, TaskStatus } from "@/lib/storage/task-store";
import type { AkteListItem } from "@/lib/extraction/types";
import { useUser } from "@/lib/user-context";
import { lookupTag, TAG_COLORS, getTagsByNamespace } from "@/lib/tags";
import type { TagRef } from "@/lib/tags";
import { TaskEditModal } from "@/components/custom/CC-14-TaskEditModal";
import { DRAG_KEY } from "@/lib/drag-types";

// ─── Sort ──────────────────────────────────────────────────────────────────────

type SortBy = "priorität" | "status" | "datum" | "titel";

const SORT_LABELS: Record<SortBy, string> = {
  priorität: "Priorität",
  status:    "Status",
  datum:     "Datum",
  titel:     "Titel",
};

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const pr = (t: Task) => {
    if ((t.tags ?? []).includes("aufgabe/priorität/hoch"))    return 0;
    if ((t.tags ?? []).includes("aufgabe/priorität/mittel"))  return 1;
    if ((t.tags ?? []).includes("aufgabe/priorität/niedrig")) return 2;
    return 3;
  };
  const sr = (t: Task) => {
    const o: TaskStatus[] = ["in_bearbeitung", "offen", "erledigt", "abgebrochen"];
    return o.indexOf(t.status);
  };
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "priorität": { const d = pr(a) - pr(b); return d !== 0 ? d : sr(a) - sr(b); }
      case "status":    return sr(a) - sr(b);
      case "datum":     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "titel":     return a.title.localeCompare(b.title, "de");
    }
  });
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TaskStatus, { label: string; dot: string; bg: string; text: string }> = {
  offen:          { label: "Offen",          dot: "bg-neutral-400",   bg: "bg-neutral-100",    text: "text-neutral-600"  },
  in_bearbeitung: { label: "In Bearbeitung", dot: "bg-brand-muted",   bg: "bg-brand-subtle",   text: "text-brand-text"   },
  erledigt:       { label: "Erledigt",       dot: "bg-success-muted", bg: "bg-success-subtle", text: "text-success-text" },
  abgebrochen:    { label: "Abgebrochen",    dot: "bg-error-muted",   bg: "bg-error-subtle",   text: "text-error-text"   },
};

const ALL_STATUSES: TaskStatus[] = ["offen", "in_bearbeitung", "erledigt", "abgebrochen"];

// ─── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  allUsers,
  allTags,
  caseLabel,
  currentUserId,
  onEdit,
  onStatusChange,
  updating,
}: {
  task: Task;
  allUsers: { id: string; name: string; initials: string; avatarUrl?: string }[];
  allTags: import("@/lib/tags").Tag[];
  caseLabel: string;
  currentUserId: string;
  onEdit: (t: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  updating: boolean;
}) {
  const cfg = STATUS_CFG[task.status];
  const done = task.status === "erledigt" || task.status === "abgebrochen";
  const assignees = task.assignees.map((uid) => allUsers.find((u) => u.id === uid)).filter(Boolean);
  const creator = allUsers.find((u) => u.id === task.createdBy);
  const taskTags = (task.tags ?? []).map((r) => ({ r, tag: lookupTag(allTags, r) })).filter((x) => x.tag);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: { kind: "task", taskId: task.id } }));
        e.dataTransfer.effectAllowed = "link";
      }}
      onClick={() => onEdit(task)}
      className={`rounded-xl border p-3.5 transition-all cursor-pointer select-none ${done ? "opacity-50 bg-neutral-50 border-neutral-100" : "bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-sm"}`}
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <button
          disabled={updating}
          onClick={(e) => {
            e.stopPropagation();
            const next: TaskStatus = task.status === "offen" ? "in_bearbeitung" : task.status === "in_bearbeitung" ? "erledigt" : "offen";
            onStatusChange(task.id, next);
          }}
          className="mt-1.5 flex-shrink-0 group"
          title="Status weiterschalten"
        >
          <span className={`block w-2.5 h-2.5 rounded-full ${cfg.dot} group-hover:scale-125 transition-transform`} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${done ? "line-through text-neutral-400" : "text-neutral-900"}`}>
              {task.title}
            </span>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
            {/* Case badge */}
            <Link
              href={`/akten/${task.caseId}?tab=aufgaben`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 hover:border-brand-border hover:text-brand transition-colors font-mono"
            >
              {caseLabel}
            </Link>
          </div>

          {task.description && (
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}

          {/* Tags */}
          {taskTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {taskTags.map(({ r, tag }) => {
                const colors = TAG_COLORS[tag!.color] ?? TAG_COLORS.gray;
                return (
                  <span key={r} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                    {tag!.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {creator && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                von{" "}
                {creator.avatarUrl
                  ? <Image src={creator.avatarUrl} alt={creator.name} width={14} height={14} className="rounded-full object-cover" unoptimized />
                  : <span className="w-3.5 h-3.5 rounded-full bg-neutral-200 inline-flex items-center justify-center text-[8px] font-bold text-neutral-500">{creator.initials}</span>}
                <span className={`font-medium ${creator.id === currentUserId ? "text-brand" : "text-neutral-500"}`}>
                  {creator.id === currentUserId ? "mir" : creator.name}
                </span>
              </span>
            )}
            {assignees.length > 0 && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                für{" "}
                {assignees.map((u) => u && (
                  <span key={u.id} className="flex items-center gap-0.5">
                    {u.avatarUrl
                      ? <Image src={u.avatarUrl} alt={u.name} width={14} height={14} className="rounded-full object-cover" unoptimized />
                      : <span className="w-3.5 h-3.5 rounded-full bg-neutral-200 inline-flex items-center justify-center text-[8px] font-bold text-neutral-500">{u.initials}</span>}
                    <span className={`font-medium ${u.id === currentUserId ? "text-brand" : "text-neutral-500"}`}>
                      {u.id === currentUserId ? "mich" : u.name}
                    </span>
                  </span>
                ))}
              </span>
            )}
            {task.linkedElements?.length > 0 && (
              <span className="text-[10px] text-neutral-400">
                {task.linkedElements.length} {task.linkedElements.length === 1 ? "Element" : "Elemente"}
              </span>
            )}
            {(task.comments?.length ?? 0) > 0 && (
              <span className="text-[10px] text-neutral-400">
                {task.comments.length} Kommentar{task.comments.length !== 1 ? "e" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={task.status}
            disabled={updating}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value as TaskStatus); }}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1 text-neutral-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CFG[s].label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MeineAufgabenPage() {
  const { currentUser, allUsers, allTags, allNamespaces } = useUser();

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [caseTags, setCaseTags] = useState<Map<string, TagRef[]>>(new Map());
  const [caseLabels, setCaseLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Scope: "mine" = assigned or created by me | "all" = all tasks
  const [scope, setScope] = useState<"mine" | "all">("mine");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>([]);
  const [filterTags, setFilterTags] = useState<TagRef[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("priorität");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, aktenRes] = await Promise.all([
        fetch("/api/aufgaben"),
        fetch("/api/akten"),
      ]);
      if (tasksRes.ok) setAllTasks(await tasksRes.json());
      if (aktenRes.ok) {
        const akten: AkteListItem[] = await aktenRes.json();
        setCaseTags(new Map(akten.map((a) => [a.caseId, a.tags ?? []])));
        setCaseLabels(new Map(akten.map((a) => [a.caseId, a.aktenzeichenDisplay ?? a.aktenzeichen ?? a.caseId])));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("aufgaben-updated", handler);
    return () => window.removeEventListener("aufgaben-updated", handler);
  }, [load]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setUpdatingId(taskId);
    try {
      const res = await fetch(`/api/aufgaben/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, _actorId: currentUser?.id }),
      });
      if (res.ok) setAllTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleFilterTag = (ref: TagRef) =>
    setFilterTags((prev) => prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]);

  const effectiveTagsFor = useCallback((task: Task): Set<TagRef> => {
    const set = new Set<TagRef>(task.tags ?? []);
    const caseIds = new Set([task.caseId, ...task.linkedElements.map((el) => (el as { caseId: string }).caseId)]);
    for (const cid of caseIds) for (const t of (caseTags.get(cid) ?? [])) set.add(t);
    return set;
  }, [caseTags]);

  const myId = currentUser?.id ?? "";

  // Scope filter: "mine" = assigned to me OR created by me
  const scopedTasks = scope === "mine"
    ? allTasks.filter((t) => t.assignees.includes(myId) || t.createdBy === myId)
    : allTasks;

  // Text filter: searches across ALL tasks when query is set, within scope otherwise
  const lowerSearch = search.toLowerCase();
  const searchSource = lowerSearch ? allTasks : scopedTasks;

  const filtered = sortTasks(
    searchSource.filter((task) => {
      if (!showDone && (task.status === "erledigt" || task.status === "abgebrochen")) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(task.status)) return false;
      if (lowerSearch && !`${task.title} ${task.description ?? ""}`.toLowerCase().includes(lowerSearch)) return false;
      if (filterTags.length > 0 && !filterTags.every((ref) => effectiveTagsFor(task).has(ref))) return false;
      return true;
    }),
    sortBy
  );

  const searchShowsOutsideScope = lowerSearch && scope === "mine";
  const myCount  = allTasks.filter((t) => t.assignees.includes(myId) || t.createdBy === myId).length;
  const allCount = allTasks.length;
  const openCount = scopedTasks.filter((t) => t.status === "offen" || t.status === "in_bearbeitung").length;
  const filtersActive = filterStatus.length > 0 || filterTags.length > 0 || showDone || lowerSearch !== "";

  const filterableNamespaces = allNamespaces.filter(
    (ns) => !ns.namespace.startsWith("user/") && ns.namespace !== "user"
  );

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <Link href="/akten" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Zur Übersicht
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">Aufgaben</h1>
            {openCount > 0 && (
              <span className="text-sm font-bold bg-brand text-white rounded-full px-2.5 py-0.5">{openCount} offen</span>
            )}
          </div>
        </div>

        {/* Scope toggle */}
        <div className="flex items-center gap-1 mb-5 p-1 bg-neutral-100 rounded-xl w-fit">
          <button
            onClick={() => setScope("mine")}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              scope === "mine" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Meine
            <span className={`ml-1.5 text-[10px] font-bold rounded-full px-1.5 leading-4 ${scope === "mine" ? "bg-brand text-white" : "bg-neutral-300 text-neutral-600"}`}>
              {myCount}
            </span>
          </button>
          <button
            onClick={() => setScope("all")}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              scope === "all" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Alle
            <span className={`ml-1.5 text-[10px] font-bold rounded-full px-1.5 leading-4 ${scope === "all" ? "bg-brand text-white" : "bg-neutral-300 text-neutral-600"}`}>
              {allCount}
            </span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Left: search · status chips · erledigte · reset */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Alle Aufgaben durchsuchen…"
                className="pl-8 pr-8 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand w-52 bg-white placeholder:text-neutral-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status chips */}
            <div className="flex gap-1 flex-wrap">
              {ALL_STATUSES.map((s) => {
                const cfg = STATUS_CFG[s];
                const active = filterStatus.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus((prev) => active ? prev.filter((x) => x !== s) : [...prev, s])}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                      active ? `${cfg.bg} ${cfg.text} border-current` : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Erledigte */}
            <button
              onClick={() => setShowDone((v) => !v)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                showDone ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              Erledigte
            </button>

            {/* Reset */}
            {filtersActive && (
              <button
                onClick={() => { setSearch(""); setFilterStatus([]); setFilterTags([]); setShowDone(false); }}
                className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5"
              >
                <X className="h-3 w-3" /> Zurücksetzen
              </button>
            )}
          </div>

          {/* Right: Tags · Sort */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <button
              onClick={() => setTagPanelOpen((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                tagPanelOpen || filterTags.length > 0
                  ? "bg-brand-light text-brand border-brand-border"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Tags
              {filterTags.length > 0 && (
                <span className="text-[10px] font-bold bg-brand text-white rounded-full px-1.5 leading-4">{filterTags.length}</span>
              )}
            </button>

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
          </div>
        </div>

        {/* Tag filter panel */}
        {tagPanelOpen && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 space-y-3">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
              Tag-Filter — inkl. transitiver Akte-Tags
            </p>
            {filterableNamespaces.map((ns) => {
              const nsTags = getTagsByNamespace(allTags, ns.namespace);
              if (nsTags.length === 0) return null;
              return (
                <div key={ns.namespace}>
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">{ns.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nsTags.map((tag) => {
                      const ref = `${tag.namespace ? tag.namespace + "/" : ""}${tag.name}` as TagRef;
                      const active = filterTags.includes(ref);
                      const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                      return (
                        <button
                          key={ref}
                          onClick={() => toggleFilterTag(ref)}
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                            active ? `${colors.bg} ${colors.text} ${colors.border}` : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
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
            {filterTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200">
                {filterTags.map((ref) => {
                  const tag = lookupTag(allTags, ref);
                  if (!tag) return null;
                  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                  return (
                    <button key={ref} onClick={() => toggleFilterTag(ref)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {tag.label} <X className="h-3 w-3" />
                    </button>
                  );
                })}
                <button onClick={() => setFilterTags([])} className="text-xs text-neutral-400 hover:text-neutral-600 px-1">Alle leeren</button>
              </div>
            )}
          </div>
        )}

        {/* Search-outside-scope hint */}
        {searchShowsOutsideScope && (
          <p className="text-xs text-neutral-400 mb-3 flex items-center gap-1">
            <Search className="h-3.5 w-3.5" />
            Suche zeigt Ergebnisse aus allen Aufgaben
            <button onClick={() => setScope("all")} className="underline hover:text-neutral-600 ml-0.5">Zu „Alle" wechseln</button>
          </p>
        )}

        {/* Task list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 border-2 border-dashed rounded-2xl">
            <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-neutral-500">
              {filtersActive ? "Keine Aufgaben für diese Filter" : scope === "mine" ? "Keine Aufgaben für dich" : "Keine Aufgaben vorhanden"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allUsers={allUsers}
                allTags={allTags}
                caseLabel={caseLabels.get(task.caseId) ?? task.caseId}
                currentUserId={myId}
                onEdit={setEditingTask}
                onStatusChange={handleStatusChange}
                updating={updatingId === task.id}
              />
            ))}
          </div>
        )}

        {/* Edit modal */}
        {editingTask && (
          <TaskEditModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSaved={(updated) => {
              setAllTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
              setEditingTask(null);
              window.dispatchEvent(new Event("aufgaben-updated"));
            }}
          />
        )}
      </div>
    </div>
  );
}
