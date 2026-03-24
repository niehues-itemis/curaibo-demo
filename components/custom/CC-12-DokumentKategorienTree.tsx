"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  buildDokumentKategorienTree,
  findNodeByRef,
  getDescendantTagRefs,
  getParentTagRef,
} from "@/lib/dokument-kategorien";
import type { KategorieTreeNode } from "@/lib/dokument-kategorien";
import { getTagsByNamespace, TAG_COLORS } from "@/lib/tags";
import type { Tag, TagRef } from "@/lib/tags";

interface Props {
  allTags: Tag[];
  dokTagMap: Record<string, string[]>;
  onSelectTagRef: (ref: TagRef | null) => void;
  selectedTagRef: TagRef | null;
}

function countForNode(
  node: KategorieTreeNode,
  dokTagMap: Record<string, string[]>
): number {
  const allRefs = new Set(getDescendantTagRefs(node));
  return Object.values(dokTagMap).filter((refs) =>
    refs.some((r) => allRefs.has(r))
  ).length;
}

function countForTagRef(
  tagRef: TagRef,
  dokTagMap: Record<string, string[]>
): number {
  return Object.values(dokTagMap).filter((refs) => refs.includes(tagRef)).length;
}

interface TreeNodeProps {
  node: KategorieTreeNode;
  dokTagMap: Record<string, string[]>;
  openRefs: Set<string>;
  onToggle: (ref: string) => void;
  selectedTagRef: TagRef | null;
  onSelect: (ref: TagRef) => void;
  depth?: number;
}

function TreeNodeItem({
  node,
  dokTagMap,
  openRefs,
  onToggle,
  selectedTagRef,
  onSelect,
  depth = 0,
}: TreeNodeProps) {
  const isOpen = openRefs.has(node.tagRef);
  const isSelected = selectedTagRef === node.tagRef;
  const count = countForNode(node, dokTagMap);
  const hasChildren = node.children.length > 0;
  const colors = TAG_COLORS[node.tag.color] ?? TAG_COLORS["gray"];

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={() => hasChildren && onToggle(node.tagRef)}>
        <div
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors ${
            isSelected
              ? "bg-brand-light text-brand-text"
              : "hover:bg-neutral-100 text-neutral-700"
          }`}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          onClick={() => onSelect(node.tagRef)}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="flex-shrink-0 p-0.5 rounded hover:bg-neutral-200">
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <span className="flex-1 text-xs truncate" title={node.tag.label}>
            {node.tag.label}
          </span>
          {count > 0 && (
            <span
              className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isSelected ? "bg-brand text-white" : `${colors.bg} ${colors.text}`
              }`}
            >
              {count}
            </span>
          )}
        </div>
        {hasChildren && (
          <CollapsibleContent>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.tagRef}
                node={child}
                dokTagMap={dokTagMap}
                openRefs={openRefs}
                onToggle={onToggle}
                selectedTagRef={selectedTagRef}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function DokumentKategorienTree({
  allTags,
  dokTagMap,
  onSelectTagRef,
  selectedTagRef,
}: Props) {
  const [openRefs, setOpenRefs] = useState<Set<string>>(new Set());

  const tree = buildDokumentKategorienTree(allTags);
  const personalTags = getTagsByNamespace(allTags, "dokument/tag");

  // Wenn selectedTagRef sich ändert → Parent aufklappen
  useEffect(() => {
    if (!selectedTagRef) return;
    const parentRef = getParentTagRef(selectedTagRef);
    if (parentRef) {
      setOpenRefs((prev) => new Set([...prev, parentRef]));
    }
  }, [selectedTagRef]);

  const toggleOpen = (ref: string) => {
    setOpenRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
      return next;
    });
  };

  const totalDocs = Object.keys(dokTagMap).length;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {/* "Alle"-Button */}
      <button
        onClick={() => onSelectTagRef(null)}
        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
          selectedTagRef === null
            ? "bg-brand-light text-brand-text"
            : "hover:bg-neutral-100 text-neutral-600"
        }`}
      >
        <span>Alle Dokumente</span>
        {totalDocs > 0 && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              selectedTagRef === null
                ? "bg-brand text-white"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {totalDocs}
          </span>
        )}
      </button>

      {/* Kategorien-Baum */}
      <div className="mt-1">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1">
          Kategorien
        </p>
        {tree.map((node) => (
          <TreeNodeItem
            key={node.tagRef}
            node={node}
            dokTagMap={dokTagMap}
            openRefs={openRefs}
            onToggle={toggleOpen}
            selectedTagRef={selectedTagRef}
            onSelect={onSelectTagRef}
          />
        ))}
      </div>

      {/* Persönliche Tags (flach) */}
      {personalTags.length > 0 && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1">
            Dokument-Tags
          </p>
          {personalTags.map((tag) => {
            const tagRef = `dokument/tag/${tag.name}`;
            const isSelected = selectedTagRef === tagRef;
            const count = countForTagRef(tagRef, dokTagMap);
            const colors = TAG_COLORS[tag.color] ?? TAG_COLORS["gray"];
            return (
              <button
                key={tagRef}
                onClick={() => onSelectTagRef(tagRef)}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                  isSelected
                    ? "bg-brand-light text-brand-text"
                    : "hover:bg-neutral-100 text-neutral-600"
                }`}
              >
                <span className="truncate">{tag.label}</span>
                {count > 0 && (
                  <span
                    className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected ? "bg-brand text-white" : `${colors.bg} ${colors.text}`
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
