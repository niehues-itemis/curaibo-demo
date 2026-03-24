"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldStatusChip } from "./CC-04-FieldStatusChip";
import type { CaseField } from "@/lib/extraction/types";

interface Props {
  field: CaseField;
  onUpdate: (
    fieldId: string,
    status: CaseField["status"],
    correctedValue?: string
  ) => Promise<void>;
}

export function InlineEditField({ field, onUpdate }: Props) {
  const displayValue =
    field.correctedValue !== undefined ? field.correctedValue : field.extractedValue;
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    displayValue !== null && displayValue !== undefined ? String(displayValue) : ""
  );
  const [saving, setSaving] = useState(false);

  const isLowConfidence = field.confidence < 0.85;
  const isUnreviewed = field.status === "extracted_unreviewed";

  const borderColor =
    field.status === "extracted_confirmed" || field.status === "manually_corrected"
      ? "border-success"
      : isLowConfidence
      ? "border-warning"
      : "border-neutral-200";

  const handleConfirm = async () => {
    setSaving(true);
    await onUpdate(field.fieldId, "extracted_confirmed");
    setSaving(false);
  };

  const handleSaveCorrection = async () => {
    setSaving(true);
    await onUpdate(field.fieldId, "manually_corrected", inputValue);
    setEditing(false);
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setInputValue(
      displayValue !== null && displayValue !== undefined ? String(displayValue) : ""
    );
    setEditing(false);
  };

  // Für Checkboxen/Boolean-Felder
  if (field.fieldType === "checkbox") {
    const boolVal = displayValue === "true";
    return (
      <div
        id={`field-${field.fieldId}`}
        className={`border-l-4 pl-3 py-2 rounded-r ${borderColor}`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-700">{field.label}</span>
          <FieldStatusChip status={field.status} />
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-sm">
            {boolVal ? "✓ Ja (angekreuzt)" : "✗ Nein (nicht angekreuzt)"}
          </span>
          {isLowConfidence && (
            <span className="text-xs text-warning-muted">
              {Math.round(field.confidence * 100)}% Konfidenz
            </span>
          )}
        </div>
        {field.confidenceReason && (
          <p className="text-xs text-warning mt-1">⚠ {field.confidenceReason}</p>
        )}
        {isUnreviewed && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            disabled={saving}
            onClick={handleConfirm}
          >
            Bestätigen ✓
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      id={`field-${field.fieldId}`}
      className={`border-l-4 pl-3 py-2 rounded-r ${borderColor}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-neutral-700">{field.label}</span>
        <FieldStatusChip status={field.status} />
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveCorrection();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-success hover:text-success-text"
            onClick={handleSaveCorrection}
            disabled={saving}
            title="Speichern"
          >
            ✓
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-error-muted hover:text-error"
            onClick={handleCancelEdit}
            title="Abbrechen"
          >
            ✗
          </Button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between mt-1 cursor-text hover:bg-neutral-50 rounded px-1 -ml-1 group"
          onClick={() => setEditing(true)}
        >
          <span className="text-sm text-neutral-900">
            {displayValue !== null && displayValue !== undefined && displayValue !== "" ? (
              String(displayValue)
            ) : (
              <span className="text-neutral-400 italic">— leer —</span>
            )}
          </span>
          <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            ✎ bearbeiten
          </span>
        </div>
      )}

      {isLowConfidence && !editing && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-warning-muted font-medium">
            {Math.round(field.confidence * 100)}% Konfidenz
          </span>
          {field.confidenceReason && (
            <span className="text-xs text-warning">— {field.confidenceReason}</span>
          )}
        </div>
      )}

      {isUnreviewed && !editing && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs border-success-border text-success-text hover:bg-success-subtle"
          disabled={saving}
          onClick={handleConfirm}
        >
          Bestätigen ✓
        </Button>
      )}
    </div>
  );
}
