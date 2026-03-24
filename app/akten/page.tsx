"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowUpDown, Clock, CheckCircle2, FileText, Search, Users, ChevronRight, Trash2, X, RefreshCw, CheckSquare, Filter, UserCheck } from "lucide-react";
import Image from "next/image";
import type { AkteListItem } from "@/lib/extraction/types";
import type { CaseSearchResult, SearchTreffer } from "@/lib/search/case-search";
import type { Task, TaskStatus } from "@/lib/storage/task-store";
import { useUser } from "@/lib/user-context";
import { lookupTag, TAG_COLORS, getTagsByNamespace } from "@/lib/tags";
import type { TagRef } from "@/lib/tags";
import { TaskEditModal } from "@/components/custom/CC-14-TaskEditModal";
import { DRAG_KEY } from "@/lib/drag-types";
import type { DragSource } from "@/lib/drag-types";

// ─── Statische Demo-Fristen ────────────────────────────────────────────────────

const FRISTEN = [
  { kritikalitaet: "kritisch" as const,     akte: "2024-INS-001 (Müller, Hans)",   frist: "Forderungsanmeldung", datum: "22.03.2026", tage: 6  },
  { kritikalitaet: "kritisch" as const,     akte: "2024-INS-003 (Weber, Anna)",    frist: "Gläubigerversammlung", datum: "24.03.2026", tage: 8  },
  { kritikalitaet: "demnächst" as const,    akte: "2024-INS-005 (Fischer, Klaus)", frist: "RSB-Antrag",           datum: "01.04.2026", tage: 16 },
  { kritikalitaet: "demnächst" as const,    akte: "2024-INS-002 (Schmidt, Maria)", frist: "Schlussverteilung",    datum: "15.04.2026", tage: 30 },
  { kritikalitaet: "mittelfristig" as const,akte: "2024-INS-004 (Braun, Thomas)",  frist: "Jahresbericht",        datum: "30.05.2026", tage: 75 },
];

const KRITIKALITAET_CONFIG = {
  kritisch:     { label: "Kritisch",     sublabel: "innerhalb 7 Tage",  icon: AlertCircle,  iconColor: "text-error",        bgColor: "bg-error-subtle",   borderColor: "border-error-border",   textColor: "text-error-text",   badgeColor: "bg-error text-white"   },
  demnächst:    { label: "Demnächst",    sublabel: "innerhalb 30 Tage", icon: Clock,        iconColor: "text-warning",      bgColor: "bg-warning-light",  borderColor: "border-warning-border", textColor: "text-warning-dark", badgeColor: "bg-warning text-white" },
  mittelfristig:{ label: "Mittelfristig",sublabel: "bis 90 Tage",       icon: CheckCircle2, iconColor: "text-success",      bgColor: "bg-success-subtle", borderColor: "border-success-border", textColor: "text-success-text", badgeColor: "bg-success text-white" },
};

// ─── Hilfskomponenten für Suchergebnisse ─────────────────────────────────────

function statusColor(status: AkteListItem["status"]): string {
  switch (status) {
    case "extracting":        return "bg-brand-light text-brand-dark";
    case "review_in_progress": return "bg-warning-light text-warning-dark";
    case "review_complete":   return "bg-success-light text-green-800";
    default:                  return "bg-neutral-100 text-neutral-700";
  }
}

function statusLabel(status: AkteListItem["status"]): string {
  switch (status) {
    case "extracting":        return "Wird erfasst";
    case "review_in_progress": return "Zu klären";
    case "review_complete":   return "Geklärt";
    default:                  return status;
  }
}

function rolleColor(rolle: string): string {
  if (rolle.startsWith("Gläubiger")) return "bg-error-subtle text-error-text border-error-border";
  if (rolle === "Schuldner")         return "bg-brand-subtle text-brand-text border-brand-border";
  if (rolle.startsWith("Arbeitgeber")) return "bg-success-subtle text-success-text border-success-border";
  if (rolle === "Gericht")           return "bg-sec-subtle text-sec-text border-purple-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}

function TrefferBadge({ treffer }: { treffer: SearchTreffer }) {
  return (
    <div className={`inline-flex flex-col text-xs rounded-lg border px-2.5 py-1.5 ${rolleColor(treffer.rolle)}`}>
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{treffer.rolle}:</span>
        <span className="font-medium">{treffer.anzeigeName}</span>
      </div>
      {treffer.details.length > 0 && (
        <div className="mt-0.5 text-[11px] opacity-75">{treffer.details.slice(0, 2).join(" · ")}</div>
      )}
    </div>
  );
}

function SuchergebnisKarte({
  result,
  searchQuery,
  onNavigate,
  onDelete,
  deleting,
}: {
  result: CaseSearchResult;
  searchQuery: string;
  onNavigate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deleting: boolean;
}) {
  return (
    <div
      onClick={onNavigate}
      className="bg-white rounded-xl border hover:border-brand-border hover:shadow-sm cursor-pointer transition-all p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-neutral-400" />
            <span className="font-semibold text-neutral-900">
              {result.aktenzeichenDisplay ?? result.aktenzeichen ?? "—"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(result.status)}`}>
              {statusLabel(result.status)}
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-0.5 ml-6">
            Schuldner: <span className="font-medium">{result.schuldnerName ?? "—"}</span>
            {result.verfahrensart && (
              <span className="ml-2 text-xs text-neutral-400">· {result.verfahrensart}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            className="p-1.5 text-neutral-400 hover:text-brand hover:bg-brand-subtle rounded-md"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 text-neutral-400 hover:text-error hover:bg-error-subtle rounded-md disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs text-neutral-500">
          <Users className="h-3.5 w-3.5" />
          <span>
            {result.treffer.length} Beteiligung{result.treffer.length !== 1 ? "en" : ""} für „{searchQuery}"
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.treffer.map((treffer, i) => (
            <TrefferBadge key={i} treffer={treffer} />
          ))}
        </div>
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

const PRIORITY_RANK = (t: Task) => {
  if ((t.tags ?? []).includes("aufgabe/priorität/hoch"))    return 0;
  if ((t.tags ?? []).includes("aufgabe/priorität/mittel"))  return 1;
  if ((t.tags ?? []).includes("aufgabe/priorität/niedrig")) return 2;
  return 3;
};

const STATUS_RANK = (t: Task) => {
  const order: TaskStatus[] = ["in_bearbeitung", "offen", "erledigt", "abgebrochen"];
  return order.indexOf(t.status);
};

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "priorität": {
        const d = PRIORITY_RANK(a) - PRIORITY_RANK(b);
        return d !== 0 ? d : STATUS_RANK(a) - STATUS_RANK(b);
      }
      case "status":  return STATUS_RANK(a) - STATUS_RANK(b);
      case "datum":   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "titel":   return a.title.localeCompare(b.title, "de");
    }
  });
}

// ─── Aufgaben-Helpers ─────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; bg: string; text: string }> = {
  offen:         { label: "Offen",         dot: "bg-neutral-400",   bg: "bg-neutral-100",    text: "text-neutral-600"  },
  in_bearbeitung:{ label: "In Bearbeitung", dot: "bg-brand-muted",   bg: "bg-brand-subtle",   text: "text-brand-text"   },
  erledigt:      { label: "Erledigt",      dot: "bg-success-muted", bg: "bg-success-subtle", text: "text-success-text" },
  abgebrochen:   { label: "Abgebrochen",   dot: "bg-error-muted",   bg: "bg-error-subtle",   text: "text-error-text"   },
};

const ALL_STATUSES: TaskStatus[] = ["offen", "in_bearbeitung", "erledigt", "abgebrochen"];

function linkedLabel(el: Task["linkedElements"][number]): string {
  if (el.type === "akte") return "Akte";
  if (el.type === "beteiligter") return "Beteiligter";
  if (el.type === "dokument") return (el as { filename: string }).filename;
  if (el.type === "feldgruppe") return "Datengruppe";
  if (el.type === "vorschlag") return "KI-Vorschlag";
  return "Element";
}

/** Determine which userIds a given user may see tasks for. */
function resolveVisibleUserIds(currentUser: { id: string; roles: string[]; tags: string[] }, allUsers: { id: string; roles: string[]; tags: string[] }[]): Set<string> | "all" {
  const roles = currentUser.roles;
  if (roles.includes("user/role/kanzlei-partner") || roles.includes("user/role/administrator")) {
    return "all";
  }
  if (roles.includes("user/role/rechtsanwalt")) {
    // own team = users sharing at least one user/team/* tag
    const myTeams = currentUser.tags.filter((t) => t.startsWith("user/team/"));
    const teamMates = allUsers
      .filter((u) => u.tags.some((t) => myTeams.includes(t)))
      .map((u) => u.id);
    return new Set([currentUser.id, ...teamMates]);
  }
  // refa and others: only own tasks
  return new Set([currentUser.id]);
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  allUsers,
  allTags,
  currentUserId,
  onStatusChange,
  onEdit,
  updating,
  showAssignee,
}: {
  task: Task;
  allUsers: { id: string; name: string; initials: string; avatarUrl?: string }[];
  allTags: import("@/lib/tags").Tag[];
  currentUserId: string;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  updating: boolean;
  showAssignee: boolean;
}) {
  const cfg = TASK_STATUS_CONFIG[task.status];
  const assigneeUsers = task.assignees.map((uid) => allUsers.find((u) => u.id === uid)).filter(Boolean);
  const creatorUser = allUsers.find((u) => u.id === task.createdBy);
  const done = task.status === "erledigt" || task.status === "abgebrochen";
  const taskTags = (task.tags ?? []).map((ref) => ({ ref, tag: lookupTag(allTags, ref) })).filter((x) => x.tag);

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
        {/* Cycle-status dot */}
        <div className="mt-1.5 flex-shrink-0">
          <button
            disabled={updating}
            onClick={(e) => {
              e.stopPropagation();
              const next: TaskStatus = task.status === "offen" ? "in_bearbeitung" : task.status === "in_bearbeitung" ? "erledigt" : "offen";
              onStatusChange(task.id, next);
            }}
            title="Status weiterschalten"
            className="group"
          >
            <span className={`block w-2.5 h-2.5 rounded-full ${cfg.dot} group-hover:scale-125 transition-transform`} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${done ? "line-through text-neutral-400" : "text-neutral-900"}`}>{task.title}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
          </div>

          {task.description && (
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}

          {taskTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {taskTags.map(({ ref, tag }) => {
                const colors = TAG_COLORS[tag!.color] ?? TAG_COLORS.gray;
                return (
                  <span key={ref} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                    {tag!.label}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {task.linkedElements?.[0] && (
              <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">{linkedLabel(task.linkedElements[0])}</span>
            )}
            {creatorUser && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                von{" "}
                {creatorUser.avatarUrl
                  ? <Image src={creatorUser.avatarUrl} alt={creatorUser.name} width={14} height={14} className="rounded-full object-cover" unoptimized />
                  : <span className="w-3.5 h-3.5 rounded-full bg-neutral-200 inline-flex items-center justify-center text-[8px] font-bold text-neutral-500">{creatorUser.initials}</span>}
                <span className="font-medium text-neutral-500">{creatorUser.name}</span>
              </span>
            )}
            {showAssignee && assigneeUsers.length > 0 && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                für{" "}
                <span className="flex items-center gap-1">
                  {assigneeUsers.map((u) => u && (
                    <span key={u.id} className="flex items-center gap-0.5">
                      {u.avatarUrl
                        ? <Image src={u.avatarUrl} alt={u.name} width={14} height={14} className="rounded-full object-cover" unoptimized />
                        : <span className="w-3.5 h-3.5 rounded-full bg-neutral-200 inline-flex items-center justify-center text-[8px] font-bold text-neutral-500">{u.initials}</span>}
                      <span className={`font-medium ${u.id === currentUserId ? "text-brand" : "text-neutral-500"}`}>{u.id === currentUserId ? "mich" : u.name}</span>
                    </span>
                  ))}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={task.status}
            disabled={updating}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value as TaskStatus); }}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1 text-neutral-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="offen">Offen</option>
            <option value="in_bearbeitung">In Bearbeitung</option>
            <option value="erledigt">Erledigt</option>
            <option value="abgebrochen">Abgebrochen</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── AnwaltDropzone ───────────────────────────────────────────────────────────

function AnwaltDropzone({
  anwalt,
  zugewieseneCount,
  isCurrentUser,
  onDrop,
}: {
  anwalt: { id: string; name: string; initials: string; avatarUrl?: string };
  zugewieseneCount: number;
  isCurrentUser: boolean;
  onDrop: (caseId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
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
        try {
          const raw = e.dataTransfer.getData(DRAG_KEY);
          if (!raw) return;
          const { source } = JSON.parse(raw) as { source: DragSource };
          if (source.kind !== "akte") return;
          e.preventDefault();
          onDrop(source.caseId);
        } catch { /* ignore */ }
      }}
      className={`rounded-xl border px-3 py-2.5 transition-all ${
        isDragOver
          ? "bg-brand-subtle border-brand ring-2 ring-brand/20"
          : isCurrentUser
          ? "bg-brand-light/50 border-brand-border"
          : "bg-white border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-full overflow-hidden flex-shrink-0 ring-2 ${isCurrentUser ? "ring-brand" : "ring-transparent"}`}>
          {anwalt.avatarUrl ? (
            <Image src={anwalt.avatarUrl} alt={anwalt.name} width={28} height={28} className="object-cover w-full h-full" unoptimized />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-xs font-semibold ${isCurrentUser ? "bg-brand text-white" : "bg-neutral-200 text-neutral-600"}`}>
              {anwalt.initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-neutral-900 truncate">{anwalt.name}</div>
          {zugewieseneCount > 0 && (
            <div className="text-[10px] text-brand font-semibold">{zugewieseneCount} Akte{zugewieseneCount !== 1 ? "n" : ""}</div>
          )}
        </div>
        {isDragOver && (
          <span className="text-[10px] font-bold text-brand bg-brand-light rounded-full px-1.5 py-0.5 flex-shrink-0">
            Hier ablegen
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard-Ansicht ────────────────────────────────────────────────────────

function Dashboard() {
  const { currentUser, allUsers, allTags, allNamespaces } = useUser();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [akten, setAkten] = useState<AkteListItem[]>([]);
  const [caseTags, setCaseTags] = useState<Map<string, TagRef[]>>(new Map());
  const [tasksLoading, setTasksLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [delegating, setDelegating] = useState<string | null>(null);

  // Filter / search state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterTags, setFilterTags] = useState<TagRef[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("priorität");

  const isPartner = currentUser?.roles?.includes("user/role/kanzlei-partner") ?? false;
  const isAdmin   = currentUser?.roles?.includes("user/role/administrator")    ?? false;
  const hasTabs   = isPartner || isAdmin;

  // Tab state — only relevant for partner/admin
  const [activeTab, setActiveTab] = useState<"aufgaben" | "fristen" | "delegieren">("aufgaben");

  // Compute which tasks this user is allowed to see
  const visibleUserIds = currentUser
    ? resolveVisibleUserIds(currentUser, allUsers)
    : new Set<string>();
  const canSeeAll = visibleUserIds === "all";
  const canSeeTeam = canSeeAll || (visibleUserIds instanceof Set && visibleUserIds.size > 1);

  // Scope label for the section heading
  const scopeLabel = isPartner || isAdmin ? "Alle Aufgaben" : canSeeTeam ? "Team-Aufgaben" : "Meine Aufgaben";

  // Users selectable in assignee filter (respects visibility scope)
  const selectableUsers = canSeeAll
    ? allUsers
    : allUsers.filter((u) => visibleUserIds instanceof Set && visibleUserIds.has(u.id));

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [tasksRes, aktenRes] = await Promise.all([
        fetch("/api/aufgaben"),
        fetch("/api/akten"),
      ]);
      if (tasksRes.ok) setAllTasks(await tasksRes.json());
      if (aktenRes.ok) {
        const loaded: AkteListItem[] = await aktenRes.json();
        setAkten(loaded);
        setCaseTags(new Map(loaded.map((a) => [a.caseId, a.tags ?? []])));
      }
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Daten und Filter-State beim User-Wechsel zurücksetzen
  useEffect(() => {
    if (!currentUser) return;
    loadTasks();
    setFilterAssignee("");
    setFilterStatus([]);
    setFilterTags([]);
    setSearch("");
    setShowDone(false);
    setActiveTab("aufgaben");
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener("aufgaben-updated", handler);
    return () => window.removeEventListener("aufgaben-updated", handler);
  }, [loadTasks]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setUpdatingStatus(taskId);
    try {
      const res = await fetch(`/api/aufgaben/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, _actorId: currentUser?.id }),
      });
      if (res.ok) setAllTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const toggleFilterTag = (ref: TagRef) =>
    setFilterTags((prev) => prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]);

  /** Collect all tags "reachable" from a task: its own tags + case tags for all linked caseIds */
  const effectiveTagsFor = useCallback((task: Task): Set<TagRef> => {
    const set = new Set<TagRef>(task.tags ?? []);
    const caseIds = new Set([task.caseId, ...task.linkedElements.map((el) => (el as { caseId: string }).caseId)]);
    for (const cid of caseIds) {
      for (const t of (caseTags.get(cid) ?? [])) set.add(t);
    }
    return set;
  }, [caseTags]);

  // Apply visibility scope
  const scopedTasks = allTasks.filter((task) => {
    if (canSeeAll) return true;
    if (visibleUserIds instanceof Set) {
      return task.assignees.some((uid) => visibleUserIds.has(uid)) ||
             visibleUserIds.has(task.createdBy);
    }
    return false;
  });

  const lowerSearch = search.toLowerCase();
  const filteredTasks = scopedTasks.filter((task) => {
    if (!showDone && (task.status === "erledigt" || task.status === "abgebrochen")) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(task.status)) return false;
    if (filterAssignee && !task.assignees.includes(filterAssignee)) return false;
    if (lowerSearch) {
      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      if (!haystack.includes(lowerSearch)) return false;
    }
    if (filterTags.length > 0) {
      const effective = effectiveTagsFor(task);
      if (!filterTags.every((ref) => effective.has(ref))) return false;
    }
    return true;
  });

  // Build the grouped tag filter options: all namespaces except user/*
  const filterableNamespaces = allNamespaces.filter(
    (ns) => !ns.namespace.startsWith("user/") && ns.namespace !== "user"
  );

  const sortedTasks = sortTasks(filteredTasks, sortBy);

  const openCount = scopedTasks.filter((t) => t.status === "offen" || t.status === "in_bearbeitung").length;
  const filtersActive = filterStatus.length > 0 || filterAssignee !== "" || search !== "" || showDone || filterTags.length > 0;

  const fristenByKritikalitaet = {
    kritisch:      FRISTEN.filter((f) => f.kritikalitaet === "kritisch"),
    demnächst:     FRISTEN.filter((f) => f.kritikalitaet === "demnächst"),
    mittelfristig: FRISTEN.filter((f) => f.kritikalitaet === "mittelfristig"),
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Übersicht</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Willkommen zurück{currentUser ? `, ${currentUser.name.split(" ").find((p) => !p.endsWith(".")) ?? currentUser.name.split(" ")[0]}` : ""}
        </p>
      </div>

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

      {/* ── Tabs für Partner/Admin ── */}
      {hasTabs && (
        <div className="flex gap-1 mb-6 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab("aufgaben")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "aufgaben" ? "border-brand text-brand" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              Aufgaben
              {openCount > 0 && (
                <span className="text-[10px] font-bold bg-brand text-white rounded-full px-1.5 py-0.5 leading-none">{openCount}</span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("fristen")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "fristen" ? "border-brand text-brand" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
            }`}
          >
            Fristen
          </button>
          {isPartner && (() => {
            const nichtZugewiesenCount = akten.filter((a) => !a.hauptverantwortlicherId).length;
            return (
              <button
                onClick={() => setActiveTab("delegieren")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "delegieren" ? "border-brand text-brand" : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  Delegieren
                  {nichtZugewiesenCount > 0 && (
                    <span className="text-[10px] font-bold bg-warning text-white rounded-full px-1.5 py-0.5 leading-none">{nichtZugewiesenCount}</span>
                  )}
                </span>
              </button>
            );
          })()}
        </div>
      )}

      {/* ── Aufgaben-Sektion ── */}
      {(!hasTabs || activeTab === "aufgaben") && (
      <div className="mb-10">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2 flex-shrink-0">
            {scopeLabel}
            {openCount > 0 && (
              <span className="text-xs font-bold bg-brand text-white rounded-full px-2 py-0.5">{openCount}</span>
            )}
          </h2>

          {/* Left controls: search · assignee · status chips · erledigte · reset */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche…"
                className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand w-36 bg-white placeholder:text-neutral-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Assignee filter */}
            {canSeeTeam && (
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 text-neutral-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Alle Bearbeiter</option>
                {selectableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.id === currentUser?.id ? " (ich)" : ""}</option>
                ))}
              </select>
            )}

            {/* Status filter chips */}
            <div className="flex gap-1 flex-wrap">
              {ALL_STATUSES.map((s) => {
                const cfg = TASK_STATUS_CONFIG[s];
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

            {/* Show done toggle */}
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
                onClick={() => { setSearch(""); setFilterStatus([]); setFilterAssignee(""); setFilterTags([]); setShowDone(false); }}
                className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5"
              >
                <X className="h-3 w-3" /> Zurücksetzen
              </button>
            )}
          </div>

          {/* Right controls: Tags · Sort */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {/* Tag filter toggle */}
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

            {/* Sort */}
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
            {/* Active filter chips with remove */}
            {filterTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200">
                {filterTags.map((ref) => {
                  const tag = lookupTag(allTags, ref);
                  if (!tag) return null;
                  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                  return (
                    <button
                      key={ref}
                      onClick={() => toggleFilterTag(ref)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {tag.label} <X className="h-3 w-3" />
                    </button>
                  );
                })}
                <button
                  onClick={() => setFilterTags([])}
                  className="text-xs text-neutral-400 hover:text-neutral-600 px-1"
                >
                  Alle leeren
                </button>
              </div>
            )}
          </div>
        )}

        {tasksLoading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 border-2 border-dashed rounded-2xl">
            <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-neutral-500">
              {filtersActive ? "Keine Aufgaben für diese Filter" : "Keine offenen Aufgaben"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allUsers={allUsers}
                allTags={allTags}
                currentUserId={currentUser?.id ?? ""}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                updating={updatingStatus === task.id}
                showAssignee={canSeeTeam}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── Delegieren-Tab (nur Partner) ── */}
      {isPartner && activeTab === "delegieren" && (() => {
        const nichtDelegiert = akten.filter((a) => !a.hauptverantwortlicherId);
        const bereitsZugewiesen = akten.filter((a) => !!a.hauptverantwortlicherId);
        const anwaelte = allUsers.filter((u) =>
          u.roles.includes("user/role/rechtsanwalt") || u.roles.includes("user/role/kanzlei-partner")
        );

        const handleZuweisung = async (caseId: string, userId: string | null) => {
          setDelegating(caseId);
          try {
            const res = await fetch(`/api/akten/${caseId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hauptverantwortlicherId: userId }),
            });
            if (res.ok) {
              setAkten((prev) =>
                prev.map((a) => a.caseId === caseId ? { ...a, hauptverantwortlicherId: userId ?? undefined } : a)
              );
              window.dispatchEvent(new Event("akten-updated"));
            }
          } finally {
            setDelegating(null);
          }
        };

        const AkteZeile = ({ akte }: { akte: AkteListItem }) => {
          const akteSource: DragSource = { kind: "akte", caseId: akte.caseId, label: akte.aktenzeichenDisplay ?? akte.aktenzeichen };
          const verantwortlicher = akte.hauptverantwortlicherId
            ? allUsers.find((u) => u.id === akte.hauptverantwortlicherId)
            : undefined;
          const isDelegatingThis = delegating === akte.caseId;
          return (
            <div
              draggable={!isDelegatingThis}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: akteSource }));
                e.dataTransfer.effectAllowed = "link";
              }}
              className={`bg-white rounded-xl border px-4 py-3 cursor-grab active:cursor-grabbing transition-all ${
                isDelegatingThis ? "opacity-50" : "hover:border-neutral-300 hover:shadow-sm"
              } ${verantwortlicher ? "border-brand-border" : "border-neutral-200"}`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    {akte.aktenzeichenDisplay ?? akte.aktenzeichen ?? "—"}
                  </div>
                  {akte.schuldnerName && (
                    <div className="text-xs text-neutral-500 truncate">{akte.schuldnerName}</div>
                  )}
                </div>
                {/* Avatar des aktuell Verantwortlichen */}
                {verantwortlicher && (
                  <div className="h-6 w-6 rounded-full overflow-hidden ring-2 ring-brand/30 flex-shrink-0" title={verantwortlicher.name}>
                    {verantwortlicher.avatarUrl ? (
                      <Image src={verantwortlicher.avatarUrl} alt={verantwortlicher.name} width={24} height={24} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold bg-brand text-white">
                        {verantwortlicher.initials}
                      </div>
                    )}
                  </div>
                )}
                {/* Dropdown zur direkten Zuweisung / Änderung */}
                <select
                  value={akte.hauptverantwortlicherId ?? ""}
                  disabled={isDelegatingThis}
                  onChange={(e) => handleZuweisung(akte.caseId, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 text-neutral-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50 flex-shrink-0"
                >
                  <option value="">— nicht zugewiesen —</option>
                  {anwaelte.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        };

        return (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-neutral-500" />
                Akten-Delegation
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Akte auf einen Anwalt ziehen oder Dropdown verwenden · nur für Partner
              </p>
            </div>

            <div className="flex gap-6">
              {/* Linke Spalte: Alle Akten */}
              <div className="flex-1 min-w-0 space-y-6">

                {/* Sektion: Nicht delegiert */}
                <div>
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    Nicht zugewiesen
                    {nichtDelegiert.length > 0 && (
                      <span className="text-[10px] font-bold bg-warning text-white rounded-full px-1.5 py-0.5 leading-none">{nichtDelegiert.length}</span>
                    )}
                  </p>
                  {nichtDelegiert.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-2xl text-neutral-400">
                      <UserCheck className="h-6 w-6 mx-auto mb-1.5 opacity-20" />
                      <p className="text-xs font-medium text-neutral-500">Alle Akten sind zugewiesen</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {nichtDelegiert.map((akte) => <AkteZeile key={akte.caseId} akte={akte} />)}
                    </div>
                  )}
                </div>

                {/* Sektion: Bereits zugewiesen */}
                {bereitsZugewiesen.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      Zugewiesen
                      <span className="text-[10px] font-bold bg-neutral-300 text-neutral-600 rounded-full px-1.5 py-0.5 leading-none">{bereitsZugewiesen.length}</span>
                    </p>
                    <div className="space-y-2">
                      {bereitsZugewiesen.map((akte) => <AkteZeile key={akte.caseId} akte={akte} />)}
                    </div>
                  </div>
                )}
              </div>

              {/* Rechte Spalte: Anwalt-Dropzonen */}
              <div className="w-52 flex-shrink-0">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Anwälte</p>
                <div className="space-y-2">
                  {anwaelte.map((anwalt) => {
                    const zugewieseneCount = akten.filter((a) => a.hauptverantwortlicherId === anwalt.id).length;
                    return (
                      <AnwaltDropzone
                        key={anwalt.id}
                        anwalt={anwalt}
                        zugewieseneCount={zugewieseneCount}
                        isCurrentUser={anwalt.id === currentUser?.id}
                        onDrop={(caseId) => handleZuweisung(caseId, anwalt.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Fristen — nur für Kanzlei-Partner und Administratoren, im Tab-Modus nur bei aktivem Fristen-Tab */}
      {(isPartner || isAdmin) && (!hasTabs || activeTab === "fristen") && (
        <div>
          <h2 className="text-base font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-500" />
            Fristen-Übersicht
            <span className="text-xs font-normal text-neutral-400 ml-1">(Demo-Daten)</span>
          </h2>
          <div className="space-y-4">
            {(["kritisch", "demnächst", "mittelfristig"] as const).map((stufe) => {
              const cfg = KRITIKALITAET_CONFIG[stufe];
              const list = fristenByKritikalitaet[stufe];
              if (list.length === 0) return null;
              const Icon = cfg.icon;
              return (
                <div key={stufe} className={`rounded-xl border ${cfg.borderColor} ${cfg.bgColor} overflow-hidden`}>
                  <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${cfg.borderColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                    <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
                    <span className={`text-xs ${cfg.textColor} opacity-70`}>— {cfg.sublabel}</span>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badgeColor}`}>{list.length}</span>
                  </div>
                  <ul className="divide-y divide-white/50">
                    {list.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium ${cfg.textColor}`}>{f.akte}</span>
                          <span className="text-xs text-neutral-500 ml-2">— {f.frist}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-semibold ${cfg.textColor}`}>{f.datum}</span>
                          <span className="text-xs text-neutral-400">({f.tage} Tage)</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suchergebnis-Ansicht ─────────────────────────────────────────────────────

function SearchResults({ query }: { query: string }) {
  const router = useRouter();
  const [results, setResults] = useState<CaseSearchResult[]>([]);
  const [searching, setSearching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const prevQuery = useRef<string>("");

  useEffect(() => {
    if (!query.trim()) return;
    prevQuery.current = query;
    setSearching(true);
    fetch(`/api/akten/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [query]);

  const handleDelete = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Akte unwiderruflich löschen?")) return;
    setDeleting(caseId);
    await fetch(`/api/cases/${caseId}`, { method: "DELETE" }).catch(() => {});
    setResults((prev) => prev.filter((r) => r.caseId !== caseId));
    setDeleting(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Search className="h-5 w-5 text-neutral-400" />
        <h1 className="text-lg font-bold text-neutral-900">
          Suchergebnisse für „{query}"
        </h1>
        <button
          onClick={() => router.push("/akten")}
          className="ml-auto text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" /> Suche zurücksetzen
        </button>
      </div>

      {searching ? (
        <div className="p-10 text-center text-neutral-400">
          <Search className="h-8 w-8 mx-auto mb-3 animate-pulse opacity-40" />
          <p>Durchsuche alle Akten…</p>
        </div>
      ) : results.length === 0 ? (
        <div className="p-10 text-center text-neutral-400 border-2 border-dashed rounded-2xl">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-neutral-600 font-medium">Keine Treffer für „{query}"</p>
          <p className="text-sm mt-1">
            Die gesuchte Partei ist in keiner Akte als Schuldner, Gläubiger, Arbeitgeber oder Bevollmächtigter erfasst.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-500 mb-4">
            <span className="font-medium text-neutral-900">{results.length}</span>{" "}
            Akte{results.length !== 1 ? "n" : ""} mit Beteiligung von „{query}"
          </p>
          <div className="space-y-3">
            {results.map((result) => (
              <SuchergebnisKarte
                key={result.caseId}
                result={result}
                searchQuery={query}
                onNavigate={() =>
                  router.push(
                    result.status === "review_complete"
                      ? `/akten/${result.caseId}`
                      : `/cases/${result.caseId}/review`
                  )
                }
                onDelete={(e) => handleDelete(result.caseId, e)}
                deleting={deleting === result.caseId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function AktenPage() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";

  return (
    <div className="h-full overflow-auto">
      {query.trim() ? <SearchResults query={query} /> : <Dashboard />}
    </div>
  );
}
