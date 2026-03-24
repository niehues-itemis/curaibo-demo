import { Badge } from "@/components/ui/badge";
import type { FieldStatus } from "@/lib/extraction/types";

const CONFIG: Record<FieldStatus, { label: string; className: string }> = {
  extracted_unreviewed: {
    label: "Nicht geprüft",
    className: "border-warning text-warning bg-warning-subtle",
  },
  extracted_confirmed: {
    label: "Bestätigt ✓",
    className: "border-success text-success-text bg-success-subtle",
  },
  manually_corrected: {
    label: "Korrigiert ✎",
    className: "border-brand text-brand-text bg-brand-subtle",
  },
};

export function FieldStatusChip({ status }: { status: FieldStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={`text-xs font-normal ${className}`}>
      {label}
    </Badge>
  );
}
