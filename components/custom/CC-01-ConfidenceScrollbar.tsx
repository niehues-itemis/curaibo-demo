"use client";

import type { CaseField } from "@/lib/extraction/types";

interface Props {
  allFields: CaseField[];
  totalCount: number;
}

export function ConfidenceScrollbar({ allFields, totalCount }: Props) {
  const pendingFields = allFields.filter(
    (f) => f.status === "extracted_unreviewed"
  );
  const allDone = pendingFields.length === 0;

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(`field-${fieldId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Kurz visuell hervorheben
      el.classList.add("ring-2", "ring-amber-400", "ring-offset-1");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-400", "ring-offset-1");
      }, 1500);
    }
  };

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-50">
      {/* Legende */}
      <div className="mb-1 flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-neutral-400 font-medium leading-none">
          {pendingFields.length}
        </span>
        <span className="text-[9px] text-neutral-400 leading-none">offen</span>
      </div>

      {allDone ? (
        <div
          className="w-3 h-3 rounded-full bg-success-muted shadow-sm"
          title="Alle Felder geprüft"
        />
      ) : (
        pendingFields.map((field) => {
          const isRed = field.confidence < 0.75;
          return (
            <button
              key={field.fieldId}
              onClick={() => scrollToField(field.fieldId)}
              className={`w-3 h-2 rounded-sm cursor-pointer transition-all hover:scale-125 hover:opacity-80 shadow-sm ${
                isRed ? "bg-red-500" : "bg-warning-muted"
              }`}
              title={`${field.label}: ${Math.round(field.confidence * 100)}% Konfidenz${
                field.confidenceReason ? ` — ${field.confidenceReason}` : ""
              }`}
            />
          );
        })
      )}

      {/* Fortschrittsbalken */}
      <div className="mt-1 w-1 rounded-full bg-neutral-200 overflow-hidden" style={{ height: 40 }}>
        <div
          className="w-full rounded-full bg-success-muted transition-all duration-500"
          style={{
            height: `${totalCount > 0 ? ((totalCount - pendingFields.length) / totalCount) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
