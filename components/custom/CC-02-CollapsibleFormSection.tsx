"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { InlineEditField } from "./CC-03-InlineEditField";
import { Input } from "@/components/ui/input";
import type { CaseField, CaseFieldGroup } from "@/lib/extraction/types";

interface Props {
  group: CaseFieldGroup;
  onFieldUpdate: (
    groupId: string,
    fieldId: string,
    instanceIndex: number | null,
    status: CaseField["status"],
    correctedValue?: string
  ) => Promise<void>;
  onSectionOpen?: (groupId: string) => void;
}

// ─── Editierbare Tabellenzelle ────────────────────────────────────────────────

function TableCell({
  field,
  onUpdate,
}: {
  field: CaseField;
  onUpdate: (fieldId: string, status: CaseField["status"], correctedValue?: string) => Promise<void>;
}) {
  const rawValue = field.correctedValue !== undefined ? field.correctedValue : field.extractedValue;
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(rawValue ?? "");
  const [saving, setSaving] = useState(false);

  const isLow = field.confidence < 0.85 && (rawValue ?? "") !== "";
  const isConfirmed = field.status === "extracted_confirmed" || field.status === "manually_corrected";

  const bgClass = isConfirmed ? "bg-success-subtle" : isLow ? "bg-warning-subtle" : "";

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(field.fieldId, "manually_corrected", inputValue);
    setEditing(false);
    setSaving(false);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onUpdate(field.fieldId, "extracted_confirmed");
    setSaving(false);
  };

  if (editing) {
    return (
      <td className={`px-2 py-1 min-w-[80px] ${bgClass}`}>
        <div className="flex items-center gap-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            className="h-6 text-xs px-1 py-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setInputValue(rawValue ?? ""); setEditing(false); }
            }}
          />
          <button onClick={handleSave} disabled={saving} className="shrink-0 text-success hover:text-success-text text-xs">✓</button>
          <button onClick={() => { setInputValue(rawValue ?? ""); setEditing(false); }} className="shrink-0 text-neutral-400 hover:text-neutral-600 text-xs">✗</button>
        </div>
      </td>
    );
  }

  const cell = (
    <td
      className={`px-3 py-2 text-xs cursor-pointer group whitespace-nowrap max-w-[200px] ${bgClass} ${isLow ? "text-warning-text" : "text-neutral-900"}`}
      onClick={() => { setInputValue(rawValue ?? ""); setEditing(true); }}
    >
      {rawValue ? (
        <span className="flex items-center gap-1 overflow-hidden">
          <span className="truncate">{rawValue}</span>
          {isLow && <span className="text-warning-muted text-[9px] shrink-0">⚠</span>}
          {!isConfirmed && rawValue && (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="hidden group-hover:inline text-[9px] text-success-muted hover:text-success shrink-0"
              title="Bestätigen"
            >
              ✓
            </button>
          )}
        </span>
      ) : (
        <span className="text-neutral-300">—</span>
      )}
    </td>
  );

  if (!isLow) return cell;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-xs">
        <span className="font-medium">{Math.round(field.confidence * 100)}% Konfidenz</span>
        {field.confidenceReason && (
          <span className="text-muted-foreground"> – {field.confidenceReason}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Tabelle für Array-Gruppen (Gläubiger) ────────────────────────────────────

function ArrayTable({
  group,
  makeUpdater,
}: {
  group: CaseFieldGroup;
  makeUpdater: (idx: number) => (fieldId: string, status: CaseField["status"], correctedValue?: string) => Promise<void>;
}) {
  const instances = group.instances ?? [];
  if (instances.length === 0) {
    return <p className="text-sm text-neutral-400 italic pl-6 py-3">Keine Einträge extrahiert.</p>;
  }
  const headers = instances[0].map((f) => f.label);

  return (
    <div className="overflow-x-auto pt-2 pb-3">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 w-8 shrink-0">Nr.</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {instances.map((rowFields, idx) => (
            <tr key={idx} className="hover:bg-neutral-50/60">
              <td className="px-3 py-2 text-neutral-400 font-medium">{idx + 1}</td>
              {rowFields.map((field) => (
                <TableCell key={field.fieldId} field={field} onUpdate={makeUpdater(idx)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Kompakte Tabelle für einfache Gruppen (Vermögen, Einkünfte etc.) ─────────

function CompactTable({
  group,
  onUpdate,
}: {
  group: CaseFieldGroup;
  onUpdate: (fieldId: string, status: CaseField["status"], correctedValue?: string) => Promise<void>;
}) {
  const fields = group.fields ?? [];
  return (
    <div className="pt-2 pb-3">
      <table className="min-w-full text-sm border-collapse">
        <tbody className="divide-y divide-gray-100">
          {fields.map((field) => (
            <tr key={field.fieldId} className="hover:bg-neutral-50/60">
              <td className="px-3 py-2 text-neutral-600 w-3/4">{field.label}</td>
              <TableCell field={field} onUpdate={onUpdate} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function CollapsibleFormSection({ group, onFieldUpdate, onSectionOpen }: Props) {
  const allFields = group.isArray
    ? (group.instances ?? []).flat()
    : (group.fields ?? []);

  const confirmedCount = allFields.filter((f) => f.status !== "extracted_unreviewed").length;
  const allConfirmed = allFields.length > 0 && confirmedCount === allFields.length;

  const [open, setOpen] = useState(!allConfirmed);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  const makeUpdater =
    (instanceIndex: number | null) =>
    async (fieldId: string, status: CaseField["status"], correctedValue?: string) => {
      await onFieldUpdate(group.groupId, fieldId, instanceIndex, status, correctedValue);
    };

  // Fallback für ältere Fälle ohne gespeichertes displayMode
  const TABLE_GROUPS = new Set([
    "glaeubigeranlage6", "glaeubigerAdressenAnlage7",
    "vermoegenAnlage4", "einkuenfteAnlage4", "verpflichtungenAnlage4", "wohnkosten_5j",
  ]);
  const isTable = group.displayMode === "table" || TABLE_GROUPS.has(group.groupId);

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        onClick={() => onSectionOpen?.(group.groupId)}
        className="flex items-center justify-between w-full py-3 px-1 text-left border-b hover:bg-neutral-50 rounded transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-neutral-500 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-500 shrink-0" />
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            {(group.anlageName || group.sectionLabel) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {group.anlageName && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand bg-brand-subtle border border-brand-border rounded px-1.5 py-0.5 leading-none">
                    {group.anlageName}
                  </span>
                )}
                {group.sectionLabel && (
                  <span className="text-[10px] text-neutral-500 leading-none">
                    {group.sectionLabel}
                  </span>
                )}
              </div>
            )}
            <span className="font-semibold text-neutral-800">{group.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-normal shrink-0 ml-2">
          <span className={allConfirmed ? "text-success" : "text-neutral-500"}>
            {confirmedCount}/{allFields.length}
          </span>
          {allConfirmed && <span className="text-success-muted text-base">✓</span>}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {isTable ? (
          group.isArray ? (
            <ArrayTable group={group} makeUpdater={(idx) => makeUpdater(idx)} />
          ) : (
            <CompactTable group={group} onUpdate={makeUpdater(null)} />
          )
        ) : group.isArray ? (
          // Array-Liste (Standard)
          <div className="pt-2 pb-4 space-y-4">
            {(group.instances ?? []).length === 0 ? (
              <p className="text-sm text-neutral-400 italic pl-6 py-2">Keine Einträge extrahiert.</p>
            ) : (
              (group.instances ?? []).map((instanceFields, idx) => (
                <div key={idx} className="pl-4 border-l-2 border-neutral-200">
                  <p className="text-xs text-neutral-500 font-medium mb-2">Eintrag {idx + 1}</p>
                  <div className="space-y-3">
                    {instanceFields.map((field) => (
                      <InlineEditField key={field.fieldId} field={field} onUpdate={makeUpdater(idx)} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Einfache Liste (Standard)
          <div className="pt-2 pb-4 pl-4 space-y-3">
            {(group.fields ?? []).map((field) => (
              <InlineEditField key={field.fieldId} field={field} onUpdate={makeUpdater(null)} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
