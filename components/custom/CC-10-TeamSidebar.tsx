"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, Filter, Save, Users, X } from "lucide-react";
import Image from "next/image";
import { useUser } from "@/lib/user-context";
import { lookupTag, getTagsByNamespace, TAG_COLORS } from "@/lib/tags";
import type { User } from "@/lib/storage/user-store";
import type { Tag, TagRef } from "@/lib/tags";
import { DRAG_KEY, AUFGABE_CREATE_EVENT, AUFGABE_ASSIGNEE_ADD_EVENT } from "@/lib/drag-types";
import type { DragSource, AufgabeCreateDetail, AssigneeAddDetail } from "@/lib/drag-types";

const SIDEBAR_KEY = "team-sidebar-open";

function TagChip({ tagRef, allTags }: { tagRef: TagRef; allTags: Tag[] }) {
  const tag = lookupTag(allTags, tagRef);
  if (!tag) return <span className="text-xs text-neutral-400">{tagRef}</span>;
  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
  return (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
      {tag.label}
    </span>
  );
}

function UserCard({
  user,
  allTags,
  isCurrentUser,
  hideTags,
}: {
  user: User;
  allTags: Tag[];
  isCurrentUser: boolean;
  hideTags: TagRef[];
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const primaryRole = user.roles[0];
  const roleTag = primaryRole ? lookupTag(allTags, primaryRole) : undefined;
  const roleColors = roleTag ? (TAG_COLORS[roleTag.color] ?? TAG_COLORS.gray) : TAG_COLORS.gray;
  const visibleTags = user.tags.filter((t) => !hideTags.includes(t));

  const userSource: DragSource = { kind: "user", userId: user.id };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: userSource }));
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
        try {
          const raw = e.dataTransfer.getData(DRAG_KEY);
          if (!raw) return;
          const { source } = JSON.parse(raw) as { source: DragSource };
          if (source.kind === "user") return;
          e.preventDefault();
          if (source.kind === "task") {
            const detail: AssigneeAddDetail = { taskId: source.taskId, userId: user.id };
            window.dispatchEvent(new CustomEvent(AUFGABE_ASSIGNEE_ADD_EVENT, { detail }));
          } else {
            const detail: AufgabeCreateDetail = { draggedSource: source, dropTarget: userSource };
            window.dispatchEvent(new CustomEvent(AUFGABE_CREATE_EVENT, { detail }));
          }
        } catch { /* ignore */ }
      }}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer select-none ${
        isDragOver
          ? "bg-brand-subtle border border-brand-muted ring-2 ring-brand/30"
          : isCurrentUser
          ? "bg-brand-light/60 border border-brand-border"
          : "hover:bg-neutral-50 border border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-8 w-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ${isCurrentUser ? "ring-brand" : "ring-transparent"}`}>
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="object-cover w-full h-full" unoptimized />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-xs font-semibold ${
              isCurrentUser ? "bg-brand text-white" : "bg-neutral-200 text-neutral-600"
            }`}>
              {user.initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-neutral-900 truncate">{user.name}</div>
        </div>
      </div>
      {(roleTag || visibleTags.length > 0) && (
        <div className="pl-9 flex flex-wrap gap-1">
          {roleTag && !hideTags.includes(primaryRole) && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${roleColors.bg} ${roleColors.text} ${roleColors.border}`}>
              {roleTag.label}
            </span>
          )}
          {visibleTags.map((t) => (
            <TagChip key={t} tagRef={t} allTags={allTags} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamSidebar() {
  const { currentUser, allUsers, allTags, allNamespaces, refreshUsers } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<TagRef[]>([]);
  const [pendingFilters, setPendingFilters] = useState<TagRef[]>([]);
  const [saving, setSaving] = useState(false);

  // Load sidebar state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setIsOpen(true);
  }, []);

  // Sync pendingFilters when currentUser changes
  useEffect(() => {
    if (currentUser) {
      const prefs = currentUser.filterPreferences.tags ?? [];
      setActiveFilters(prefs);
      setPendingFilters(prefs);
    }
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = useCallback(() => {
    setIsOpen((v) => {
      localStorage.setItem(SIDEBAR_KEY, String(!v));
      return !v;
    });
  }, []);

  const togglePendingFilter = (ref: TagRef) => {
    setPendingFilters((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]
    );
  };

  const saveFilters = async () => {
    if (!currentUser) return;
    setSaving(true);
    await fetch(`/api/users/${currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filterPreferences: { tags: pendingFilters } }),
    });
    setActiveFilters(pendingFilters);
    refreshUsers();
    setSaving(false);
  };

  const clearFilters = () => {
    setPendingFilters([]);
  };

  // Filter users by activeFilters
  const filteredUsers =
    activeFilters.length === 0
      ? allUsers
      : allUsers.filter((u) =>
          activeFilters.every((f) => u.tags.includes(f) || u.roles.includes(f))
        );

  // Dynamic filter namespaces: all user/* except user/role and user itself
  const filterNamespaces = allNamespaces
    .filter((n) => n.namespace.startsWith("user/") && n.namespace !== "user/role" && n.namespace !== "user");

  // Group tags by namespace for filter panel
  const filterTagsByNamespace = filterNamespaces
    .map((ns) => ({
      namespace: ns.namespace,
      label: ns.label,
      tags: getTagsByNamespace(allTags, ns.namespace),
    }))
    .filter((g) => g.tags.length > 0);

  const pendingChanges =
    JSON.stringify([...pendingFilters].sort()) !== JSON.stringify([...activeFilters].sort());

  // Collapsed state: narrow strip with rotated tab label
  if (!isOpen) {
    return (
      <div className="w-10 flex-shrink-0 h-full border-l border-neutral-200 bg-white flex flex-col items-center">
        <button
          onClick={toggleSidebar}
          className="w-full flex-1 flex flex-col items-center justify-start pt-3 gap-3 hover:bg-neutral-50 transition-colors group"
          title="Team öffnen"
        >
          <Users className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 flex-shrink-0" />
          <span className="text-xs font-semibold text-neutral-400 group-hover:text-neutral-700 [writing-mode:vertical-rl] tracking-widest uppercase">
            Team
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 flex-shrink-0 mt-auto mb-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 h-full border-l border-neutral-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 flex-shrink-0">
        <span className="text-sm font-semibold text-neutral-800">Team</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400">{filteredUsers.length}/{allUsers.length}</span>
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`p-1.5 rounded-md transition-colors ${
                    filterOpen || activeFilters.length > 0
                      ? "bg-brand-light text-brand"
                      : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  }`}
                  title="Filter"
                >
                  <Filter className="h-4 w-4" />
                </button>
                {activeFilters.length > 0 && (
                  <span className="text-xs font-semibold text-brand bg-brand-light rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Team-Sidebar einklappen"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
      </div>

      {/* Filter panel */}
            {filterOpen && (
              <div className="border-b border-neutral-100 px-4 py-3 bg-neutral-50 flex-shrink-0">
                {filterTagsByNamespace.map(({ namespace, label, tags }) => (
                  <div key={namespace} className="mb-3 last:mb-0">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => {
                        const ref = `${tag.namespace}/${tag.name}` as TagRef;
                        const active = pendingFilters.includes(ref);
                        const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                        return (
                          <button
                            key={ref}
                            onClick={() => togglePendingFilter(ref)}
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

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={saveFilters}
                    disabled={!pendingChanges || saving}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      pendingChanges
                        ? "bg-brand text-white hover:bg-brand-hover"
                        : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    <Save className="h-3 w-3" />
                    {saving ? "Speichern…" : "Speichern"}
                  </button>
                  {pendingFilters.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Leeren
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Active filter chips — shown centrally above the list */}
            {activeFilters.length > 0 && (
              <div className="px-3 pt-2.5 pb-1.5 flex flex-wrap gap-1 border-b border-neutral-100 flex-shrink-0">
                {activeFilters.map((ref) => {
                  const tag = lookupTag(allTags, ref);
                  if (!tag) return null;
                  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                  return (
                    <button
                      key={ref}
                      onClick={async () => {
                        const next = activeFilters.filter((r) => r !== ref);
                        setPendingFilters(next);
                        setActiveFilters(next);
                        if (currentUser) {
                          await fetch(`/api/users/${currentUser.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filterPreferences: { tags: next } }),
                          });
                          refreshUsers();
                        }
                      }}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-opacity hover:opacity-70 ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {tag.label}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">Keine Treffer</p>
              ) : (
                filteredUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    allTags={allTags}
                    isCurrentUser={user.id === currentUser?.id}
                    hideTags={activeFilters}
                  />
                ))
              )}
            </div>
    </div>
  );
}
