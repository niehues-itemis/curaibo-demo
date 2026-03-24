"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Folder,
  Mail,
  AlertTriangle,
  Activity,
  Square,
  Trash2,
} from "lucide-react";
import type { JobLogEntry } from "@/lib/connectors/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "läuft…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `vor ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  return `vor ${h}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobLogEntry["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-brand-light text-brand-text">
        <RefreshCw className="h-3 w-3 animate-spin" /> Läuft
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-success-light text-success-text">
        <CheckCircle className="h-3 w-3" /> Erfolgreich
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-error-light text-error-text">
      <XCircle className="h-3 w-3" /> Fehler
    </span>
  );
}

function ConnectorIcon({ type }: { type: JobLogEntry["connectorType"] }) {
  if (type === "filesystem") return <Folder className="h-4 w-4 text-warning" />;
  return <Mail className="h-4 w-4 text-brand" />;
}

function JobRow({ job, onCancel, onDelete }: {
  job: JobLogEntry;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const hasErrors = job.errors.length > 0;

  const handleCancel = async () => {
    if (!confirm("Job wirklich abbrechen?")) return;
    setActing(true);
    await fetch(`/api/connectors/jobs/${job.id}`, { method: "POST" });
    onCancel(job.id);
  };

  const handleDelete = async () => {
    setActing(true);
    await fetch(`/api/connectors/jobs/${job.id}`, { method: "DELETE" });
    onDelete(job.id);
  };

  return (
    <div
      className={`border rounded-xl p-4 ${
        hasErrors ? "border-error-border bg-error-subtle/30" : "bg-white"
      } ${job.status === "running" ? "border-brand-border bg-brand-subtle/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 p-1.5 rounded-lg ${job.connectorType === "filesystem" ? "bg-warning-subtle" : "bg-brand-subtle"}`}>
            <ConnectorIcon type={job.connectorType} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-neutral-900 text-sm">{job.connectorName}</span>
              <StatusBadge status={job.status} />
              {hasErrors && (
                <span className="inline-flex items-center gap-1 text-xs text-error">
                  <AlertTriangle className="h-3 w-3" />
                  {job.errors.length} Fehler
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {formatDate(job.startedAt)} · {formatDuration(job.startedAt, job.finishedAt)}
              {job.status !== "running" && ` · ${timeAgo(job.finishedAt ?? job.startedAt)}`}
            </p>
            {job.result && (
              <p className={`text-xs mt-1 ${hasErrors ? "text-error" : "text-success-text"}`}>
                {job.result}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500">
          {job.processed > 0 && (
            <span className="hidden sm:block">{job.processed} verarbeitet</span>
          )}
          {job.newCaseIds.length > 0 && (
            <span className="hidden sm:block text-brand-text">{job.newCaseIds.length} neue Akten</span>
          )}
          {hasErrors && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-error hover:underline text-xs"
            >
              {expanded ? "Verbergen" : "Details"}
            </button>
          )}
          {job.status === "running" ? (
            <button
              onClick={handleCancel}
              disabled={acting}
              title="Job abbrechen"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={acting}
              title="Job löschen"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && hasErrors && (
        <div className="mt-3 pt-3 border-t border-error-border">
          <p className="text-xs font-medium text-error-text mb-1">Fehlermeldungen:</p>
          <ul className="space-y-1">
            {job.errors.map((e, i) => (
              <li key={i} className="text-xs text-error font-mono bg-error-subtle rounded px-2 py-1">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

type FilterType = "all" | "running" | "success" | "error";

export default function StatusPage() {
  const [jobs, setJobs] = useState<JobLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/jobs");
      if (res.ok) {
        setJobs(await res.json());
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 10_000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const running = jobs.filter((j) => j.status === "running");

  // Jeweils neuester Lauf pro Konnektor + alle Läufe mit Dokumenten
  const latestPerConnector = new Set(
    Object.values(
      jobs.reduce<Record<string, JobLogEntry>>((acc, j) => {
        if (!acc[j.connectorId] || j.startedAt > acc[j.connectorId].startedAt) {
          acc[j.connectorId] = j;
        }
        return acc;
      }, {})
    ).map((j) => j.id)
  );
  const relevantJobs = jobs.filter(
    (j) => latestPerConnector.has(j.id) || j.processed > 0 || j.newCaseIds.length > 0
  );

  const filtered =
    filter === "all" ? relevantJobs :
    filter === "running" ? running :
    relevantJobs.filter((j) => j.status === filter);

  const errorCount = relevantJobs.filter((j) => j.status === "error").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand" />
            Aktivität
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Konnektor-Jobs · Aktualisiert: {lastRefresh.toLocaleTimeString("de-DE")}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadJobs(); }}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {/* Summary-Chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {running.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-subtle text-brand-text rounded-full text-sm font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {running.length} laufend
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-error-subtle text-error-text rounded-full text-sm font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errorCount} Fehler
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-full text-sm">
          <Clock className="h-3.5 w-3.5" />
          {jobs.length} Jobs gesamt
        </div>
      </div>

      {/* Filter-Tabs */}
      <div className="flex gap-1 mb-4 bg-neutral-100 p-1 rounded-lg w-fit">
        {(["all", "running", "success", "error"] as FilterType[]).map((f) => {
          const labels: Record<FilterType, string> = {
            all: "Alle",
            running: "Läuft",
            success: "Erfolgreich",
            error: "Fehler",
          };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {labels[f]}
              {f !== "all" && (
                <span className="ml-1.5 text-xs text-neutral-400">
                  {jobs.filter((j) => j.status === f).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Job-Liste */}
      {loading ? (
        <div className="p-12 text-center text-neutral-400">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-30" />
          <p>Jobs werden geladen…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-neutral-400 border-2 border-dashed rounded-2xl">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-neutral-500">Keine Jobs vorhanden</p>
          <p className="text-sm mt-1">
            {filter === "all"
              ? "Noch keine Konnektor-Aktivität aufgezeichnet."
              : `Keine Jobs mit Status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onCancel={() => { setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "error", finishedAt: new Date().toISOString(), result: "Manuell abgebrochen" } : j)); }}
              onDelete={() => { setJobs((prev) => prev.filter((j) => j.id !== job.id)); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
