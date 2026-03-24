"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckSquare,
  FileText,
  Filter,
  Plus,
  Scale,
  Search,
  X,
} from "lucide-react";
import { FileUploadDropzone } from "@/components/custom/CC-05-FileUploadDropzone";
import { useUser } from "@/lib/user-context";
import { lookupTag, isExclusiveNamespace, namespaceLabel, TAG_COLORS } from "@/lib/tags";
import type { TagRef } from "@/lib/tags";
import type { AkteListItem } from "@/lib/extraction/types";
import { DRAG_KEY, AUFGABE_CREATE_EVENT } from "@/lib/drag-types";
import type { DragSource, AufgabeCreateDetail } from "@/lib/drag-types";

const SIDEBAR_KEY = "akten-global-sidebar-open";


// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function GlobalAktenSidebar() {
  const params = useParams<{ caseId?: string }>();
  const router = useRouter();
  const { allTags, currentUser, allUsers, refreshUsers } = useUser();
  const activeCaseId = params?.caseId ?? null;

  const [isOpen, setIsOpen] = useState(true);
  const [akten, setAkten] = useState<AkteListItem[]>([]);
  const [todoCounts, setTodoCounts] = useState<Map<string, number>>(new Map());
  const [taskCounts, setTaskCounts] = useState<Map<string, number>>(new Map());
  const [myTaskCaseIds, setMyTaskCaseIds] = useState<Set<string>>(new Set());
  const [filterMineAufgaben, setFilterMineAufgaben] = useState(false);
  const [filterHauptverantwortlicher, setFilterHauptverantwortlicher] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<TagRef[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sidebar state
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) setIsOpen(stored === "true");
  }, []);

  // Sync akten filters from current user preferences
  useEffect(() => {
    setActiveFilters(currentUser?.filterPreferences.aktenTags ?? []);
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveFilters = useCallback(async (filters: TagRef[]) => {
    setActiveFilters(filters);
    if (!currentUser) return;
    await fetch(`/api/users/${currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filterPreferences: { aktenTags: filters } }),
    });
    await refreshUsers();
  }, [currentUser, refreshUsers]);

  const loadTaskCounts = useCallback(async () => {
    if (!currentUser) return;
    const [summaryRes, myRes] = await Promise.all([
      fetch("/api/aufgaben?summary=1").catch(() => null),
      fetch(`/api/aufgaben?summary=1&userId=${currentUser.id}`).catch(() => null),
    ]);
    if (summaryRes?.ok) {
      const data: { caseId: string; openCount: number }[] = await summaryRes.json();
      const map = new Map<string, number>();
      data.forEach((d) => { if (d.openCount > 0) map.set(d.caseId, d.openCount); });
      setTaskCounts(map);
    }
    if (myRes?.ok) {
      const caseIds: string[] = await myRes.json();
      setMyTaskCaseIds(new Set(caseIds));
    }
  }, [currentUser]);

  const loadAkten = useCallback(async () => {
    const [aktenRes, todosRes] = await Promise.all([
      fetch("/api/akten").catch(() => null),
      fetch("/api/todos").catch(() => null),
    ]);
    if (aktenRes?.ok) setAkten(await aktenRes.json());
    if (todosRes?.ok) {
      const todos: { caseId: string; proposals: unknown[] }[] = await todosRes.json();
      const map = new Map<string, number>();
      todos.forEach((t) => { if (t.proposals.length > 0) map.set(t.caseId, t.proposals.length); });
      setTodoCounts(map);
    }
    await loadTaskCounts();
  }, [loadTaskCounts]);

  useEffect(() => { loadAkten(); }, [loadAkten]);
  useEffect(() => {
    window.addEventListener("akten-updated", loadAkten);
    window.addEventListener("aufgaben-updated", loadTaskCounts);
    return () => {
      window.removeEventListener("akten-updated", loadAkten);
      window.removeEventListener("aufgaben-updated", loadTaskCounts);
    };
  }, [loadAkten, loadTaskCounts]);

  const toggleSidebar = () => {
    setIsOpen((v) => { localStorage.setItem(SIDEBAR_KEY, String(!v)); return !v; });
  };

  const handleSearch = (v: string) => {
    setSearchValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim()) router.push(`/akten?q=${encodeURIComponent(v.trim())}`);
      else router.push("/akten");
    }, 350);
  };

  const toggleFilter = (ref: TagRef) => {
    const next = activeFilters.includes(ref)
      ? activeFilters.filter((r) => r !== ref)
      : [...activeFilters, ref];
    saveFilters(next);
  };

  // Filter: by active tag filters (AND logic) + optional "Meine Aufgaben" + optional Hauptverantwortlicher
  const filteredAkten = akten
    .filter((a) => activeFilters.length === 0 || activeFilters.every((f) => (a.tags ?? []).includes(f)))
    .filter((a) => !filterMineAufgaben || myTaskCaseIds.has(a.caseId))
    .filter((a) => {
      if (!filterHauptverantwortlicher) return true;
      if (filterHauptverantwortlicher === "__unassigned__") return !a.hauptverantwortlicherId;
      return a.hauptverantwortlicherId === filterHauptverantwortlicher;
    });

  // All filterable tags: global ("") + akten + akten/*
  const filterableTags = allTags.filter(
    (t) => t.namespace === "" || t.namespace === "akten" || t.namespace.startsWith("akten/")
  );
  // TagRef helper — empty namespace → just name
  const tagToRef = (t: (typeof allTags)[0]): TagRef =>
    t.namespace ? `${t.namespace}/${t.name}` : t.name;

  const exclusiveNamespaces = Array.from(
    new Set(filterableTags.filter((t) => isExclusiveNamespace(t.namespace)).map((t) => t.namespace))
  );
  const filterSections = [
    ...exclusiveNamespaces.map((ns) => ({
      key: ns,
      label: namespaceLabel(ns),
      tags: filterableTags.filter((t) => t.namespace === ns),
    })),
    ...(filterableTags.some((t) => t.namespace === "akten")
      ? [{ key: "akten", label: "Akten", tags: filterableTags.filter((t) => t.namespace === "akten") }]
      : []),
    ...(filterableTags.some((t) => t.namespace === "")
      ? [{ key: "global", label: "Übergreifend", tags: filterableTags.filter((t) => t.namespace === "") }]
      : []),
  ];

  // Collapsed state: narrow strip with rotated tab label
  const activeAkte = activeCaseId ? akten.find((a) => a.caseId === activeCaseId) : null;

  if (!isOpen) {
    return (
      <div className="w-10 flex-shrink-0 h-full border-r border-neutral-200 bg-white flex flex-col items-center">
        <button
          onClick={toggleSidebar}
          className="w-full flex-1 flex flex-col items-center justify-start pt-3 gap-3 hover:bg-neutral-50 transition-colors group"
          title="Akten öffnen"
        >
          <Scale className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 flex-shrink-0" />
          <span className="text-xs font-semibold text-neutral-400 group-hover:text-neutral-700 [writing-mode:vertical-rl] rotate-180 tracking-widest uppercase">
            Akten
          </span>
          {activeAkte && (
            <div className="flex flex-col items-center gap-1 px-1">
              <span className="text-[10px] font-semibold text-brand [writing-mode:vertical-rl] rotate-180 leading-none">
                {activeAkte.aktenzeichenDisplay ?? activeAkte.aktenzeichen}
              </span>
              {activeAkte.schuldnerName && (
                <span className="text-[10px] text-neutral-500 [writing-mode:vertical-rl] rotate-180 leading-none truncate max-h-24">
                  {activeAkte.schuldnerName}
                </span>
              )}
            </div>
          )}
          <ChevronLeft className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 rotate-180 flex-shrink-0 mt-auto mb-3" />
        </button>
        {/* Upload Modal (must be accessible even when collapsed) */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">VInsO-Formular hochladen</h2>
                <button onClick={() => setShowUpload(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FileUploadDropzone onUploadComplete={(caseId) => { setShowUpload(false); loadAkten(); router.push(`/akten/${caseId}`); }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 h-full border-r border-neutral-200 bg-white flex flex-col overflow-hidden">
      {true && (
        <>
            {/* Search */}
            <div className="px-3 pt-3 pb-2 border-b border-neutral-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Akten durchsuchen …"
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-neutral-50 placeholder:text-neutral-400"
                />
                {searchValue && (
                  <button
                    onClick={() => handleSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Header: Neue Akte + Filter + Collapse */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-text bg-brand-subtle hover:bg-brand-light px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Neue Akte
                </button>
                <button
                  onClick={() => setFilterMineAufgaben((v) => !v)}
                  title="Nur Akten mit meinen Aufgaben"
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                    filterMineAufgaben
                      ? "bg-brand text-white"
                      : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-400">{filteredAkten.length}/{akten.length}</span>
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`p-1.5 rounded-md transition-colors ${
                    filterOpen || activeFilters.length > 0 || filterHauptverantwortlicher
                      ? "bg-brand-light text-brand"
                      : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  }`}
                  title="Filter"
                >
                  <Filter className="h-4 w-4" />
                </button>
                {(activeFilters.length > 0 || filterHauptverantwortlicher) && (
                  <span className="text-xs font-semibold text-brand bg-brand-light rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilters.length + (filterHauptverantwortlicher ? 1 : 0)}
                  </span>
                )}
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Seitenleiste einklappen"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {filterOpen && (
              <div className="border-b border-neutral-100 px-3 py-2.5 bg-neutral-50 flex-shrink-0 max-h-60 overflow-y-auto">
                {/* Hauptverantwortlicher-Filter */}
                <div className="mb-2.5">
                  <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                    Hauptverantwortlich
                  </div>
                  <select
                    value={filterHauptverantwortlicher}
                    onChange={(e) => setFilterHauptverantwortlicher(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand transition-colors ${
                      filterHauptverantwortlicher
                        ? "border-brand bg-brand-subtle text-brand-text"
                        : "border-neutral-200 bg-white text-neutral-600"
                    }`}
                  >
                    <option value="">Alle Anwälte</option>
                    <option value="__unassigned__">— nicht zugewiesen —</option>
                    {allUsers
                      .filter((u) => u.roles.includes("user/role/rechtsanwalt") || u.roles.includes("user/role/kanzlei-partner"))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Tag-Filter-Sektionen */}
                {filterSections.length === 0 && !filterHauptverantwortlicher && (
                  <p className="text-xs text-neutral-400 text-center py-2">Keine Tags vorhanden</p>
                )}
                {filterSections.map(({ key, label, tags }) => (
                  <div key={key} className="mb-2.5 last:mb-0">
                    <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => {
                        const ref = tagToRef(tag);
                        const active = activeFilters.includes(ref);
                        const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                        return (
                          <button
                            key={ref}
                            onClick={() => toggleFilter(ref)}
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
                ))}
                {(activeFilters.length > 0 || filterHauptverantwortlicher) && (
                  <button
                    onClick={() => { saveFilters([]); setFilterHauptverantwortlicher(""); }}
                    className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors"
                  >
                    <X className="h-3 w-3" /> Alle zurücksetzen
                  </button>
                )}
              </div>
            )}

            {/* Active filter chips */}
            {(activeFilters.length > 0 || filterHauptverantwortlicher) && (
              <div className="px-3 pt-2 pb-1.5 flex flex-wrap gap-1 border-b border-neutral-100 flex-shrink-0">
                {/* HV-Filter-Chip */}
                {filterHauptverantwortlicher && (() => {
                  const label = filterHauptverantwortlicher === "__unassigned__"
                    ? "Nicht zugewiesen"
                    : (allUsers.find((u) => u.id === filterHauptverantwortlicher)?.name ?? filterHauptverantwortlicher);
                  return (
                    <button
                      onClick={() => setFilterHauptverantwortlicher("")}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-opacity hover:opacity-70 bg-brand-subtle text-brand-text border-brand-border"
                    >
                      {label}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })()}
                {/* Tag-Filter-Chips */}
                {activeFilters.map((ref) => {
                  const tag = lookupTag(allTags, ref);
                  if (!tag) return null;
                  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                  return (
                    <button
                      key={ref}
                      onClick={() => toggleFilter(ref)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-opacity hover:opacity-70 ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {tag.label}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Akten list */}
            <div className="flex-1 overflow-y-auto">
              {filteredAkten.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-8">Keine Akten gefunden</p>
              ) : (
                <ul className="py-1">
                  {filteredAkten.map((akte) => {
                    const isActive = akte.caseId === activeCaseId;
                    const visibleTags = (akte.tags ?? []).filter((t) => !activeFilters.includes(t));
                    const todoCount = todoCounts.get(akte.caseId) ?? 0;
                    const taskCount = taskCounts.get(akte.caseId) ?? 0;
                    const akteSource: DragSource = { kind: "akte", caseId: akte.caseId, label: akte.aktenzeichenDisplay ?? akte.aktenzeichen };
                    const hauptverantwortlicher = akte.hauptverantwortlicherId
                      ? allUsers.find((u) => u.id === akte.hauptverantwortlicherId)
                      : undefined;
                    return (
                      <li key={akte.caseId}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: akteSource }));
                            e.dataTransfer.effectAllowed = "link";
                          }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes(DRAG_KEY)) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "link";
                            }
                          }}
                          onDrop={(e) => {
                            try {
                              const raw = e.dataTransfer.getData(DRAG_KEY);
                              if (!raw) return;
                              const { source } = JSON.parse(raw) as { source: DragSource };
                              if (source.kind !== "user") return;
                              e.preventDefault();
                              const detail: AufgabeCreateDetail = { draggedSource: source, dropTarget: akteSource };
                              window.dispatchEvent(new CustomEvent(AUFGABE_CREATE_EVENT, { detail }));
                            } catch { /* ignore */ }
                          }}
                        >
                        <Link
                          href={`/akten/${akte.caseId}`}
                          className={`flex flex-col px-3 py-2.5 transition-colors border-l-2 group ${
                            isActive
                              ? "bg-brand-subtle border-brand text-brand-text"
                              : "border-transparent hover:bg-neutral-50 text-neutral-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {hauptverantwortlicher ? (
                              <div
                                className="h-3.5 w-3.5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-brand/30"
                                title={`Hauptverantwortlich: ${hauptverantwortlicher.name}`}
                              >
                                {hauptverantwortlicher.avatarUrl ? (
                                  <Image
                                    src={hauptverantwortlicher.avatarUrl}
                                    alt={hauptverantwortlicher.name}
                                    width={14}
                                    height={14}
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[7px] font-bold bg-brand text-white">
                                    {hauptverantwortlicher.initials}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-brand" : "text-neutral-400"}`} />
                            )}
                            <span className="text-xs font-semibold truncate flex-1">
                              {akte.aktenzeichenDisplay ?? akte.aktenzeichen ?? "—"}
                            </span>
                            {akte.status === "extracting" && (
                              <span className="flex-shrink-0 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-neutral-200 text-neutral-500" title="Wird noch erfasst">
                                ?
                              </span>
                            )}
                            {akte.status === "review_in_progress" && todoCount === 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-warning text-white" title="Zu klären">
                                !
                              </span>
                            )}
                            {todoCount > 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning text-white" title="Offene KI-Vorschläge">
                                {todoCount}
                              </span>
                            )}
                            {taskCount > 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand text-white" title="Offene Aufgaben">
                                {taskCount}
                              </span>
                            )}
                          </div>
                          {akte.schuldnerName && (
                            <span className="text-xs text-neutral-500 ml-5 truncate mt-0.5">
                              {akte.schuldnerName}
                            </span>
                          )}
                          {visibleTags.length > 0 && (
                            <div className="ml-5 mt-1 flex items-center gap-1 flex-wrap">
                              {visibleTags.map((t) => {
                                const tag = lookupTag(allTags, t);
                                if (!tag) return null;
                                const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                                return (
                                  <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                                    {tag.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
      </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">VInsO-Formular hochladen</h2>
              <button onClick={() => setShowUpload(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FileUploadDropzone onUploadComplete={(caseId) => { setShowUpload(false); loadAkten(); router.push(`/akten/${caseId}`); }} />
          </div>
        </div>
      )}
    </div>
  );
}
