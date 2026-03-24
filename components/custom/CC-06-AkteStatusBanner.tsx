import { Progress } from "@/components/ui/progress";

interface Props {
  confirmedCount: number;
  totalCount: number;
  filename: string;
}

export function AkteStatusBanner({ confirmedCount, totalCount, filename }: Props) {
  const allDone = totalCount > 0 && confirmedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

  return (
    <div
      className={`rounded-lg p-4 border ${
        allDone
          ? "bg-success-subtle border-success-border"
          : "bg-warning-subtle border-warning-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-xs text-neutral-500 mb-0.5 font-mono truncate max-w-xs">
            {filename}
          </p>
          <p className={`font-semibold text-sm ${allDone ? "text-success-text" : "text-warning-dark"}`}>
            {allDone
              ? "✓ Alle Felder geprüft — Daten vollständig geklärt"
              : `${confirmedCount} von ${totalCount} Feldern bestätigt`}
          </p>
        </div>
        <span
          className={`text-2xl font-bold tabular-nums ${
            allDone ? "text-success" : "text-warning"
          }`}
        >
          {progress}%
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
