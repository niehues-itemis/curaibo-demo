"use client";

import { useState } from "react";
import { Check, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildDokumentKategorienTree,
  getDescendantTagRefs,
  UNBEKANNT_TAG_REF,
} from "@/lib/dokument-kategorien";
import type { KategorieTreeNode } from "@/lib/dokument-kategorien";
import type { Tag as TagType, TagRef } from "@/lib/tags";

interface Props {
  caseId: string;
  folder: "eingehend" | "ausgehend";
  filename: string;
  allTags: TagType[];
  currentTagRefs: TagRef[];
  onSaved: (newTagRefs: TagRef[]) => void;
}

function renderTreeOptions(
  nodes: KategorieTreeNode[],
  selected: Set<string>,
  onToggle: (ref: string) => void,
  depth = 0
): React.ReactNode {
  return nodes.map((node) => (
    <div key={node.tagRef}>
      <button
        type="button"
        onClick={() => onToggle(node.tagRef)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-neutral-50 transition-colors rounded-md`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span
          className={`flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
            selected.has(node.tagRef)
              ? "bg-brand border-brand"
              : "border-neutral-300"
          }`}
        >
          {selected.has(node.tagRef) && <Check className="h-2.5 w-2.5 text-white" />}
        </span>
        <span className="truncate text-neutral-700">{node.tag.label}</span>
      </button>
      {node.children.length > 0 &&
        renderTreeOptions(node.children, selected, onToggle, depth + 1)}
    </div>
  ));
}

export function DokumentKategorieEditor({
  caseId,
  folder,
  filename,
  allTags,
  currentTagRefs,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lokale Selektion ohne "unbekannt"
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(currentTagRefs.filter((r) => r !== UNBEKANNT_TAG_REF))
  );

  // Aktualisiert wenn sich currentTagRefs von außen ändert
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setSelected(new Set(currentTagRefs.filter((r) => r !== UNBEKANNT_TAG_REF)));
    }
    setOpen(isOpen);
  };

  const toggleRef = (tagRef: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagRef)) {
        next.delete(tagRef);
      } else {
        next.add(tagRef);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Wenn nichts ausgewählt → "Nicht klassifiziert" setzen
    const newTagRefs =
      selected.size > 0 ? Array.from(selected) : [UNBEKANNT_TAG_REF];

    try {
      await fetch(`/api/cases/${caseId}/documents/kategorien`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, filename, tagRefs: newTagRefs }),
      });
      onSaved(newTagRefs);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const tree = buildDokumentKategorienTree(allTags);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          title="Kategorie ändern"
          className="text-neutral-400 hover:text-brand p-0.5 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="p-3 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-700">Kategorie zuweisen</p>
          <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{filename}</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {renderTreeOptions(tree, selected, toggleRef)}
        </div>
        <div className="p-2 border-t border-neutral-100 flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-400">
            {selected.size === 0
              ? "Keine Kategorie → Nicht klassifiziert"
              : `${selected.size} ausgewählt`}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
