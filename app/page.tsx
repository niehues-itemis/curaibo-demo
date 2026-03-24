"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { FileUploadDropzone } from "@/components/custom/CC-05-FileUploadDropzone";
import { FileText, Trash2, ChevronRight, CheckCircle, Clock } from "lucide-react";
import type { CaseListItem } from "@/lib/storage/case-store";

export default function UploadPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    const res = await fetch("/api/cases");
    if (res.ok) setCases(await res.json());
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const handleDelete = async (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    if (!confirm("Akte wirklich löschen?")) return;
    setDeletingId(caseId);
    await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
    setCases((prev) => prev.filter((c) => c.caseId !== caseId));
    setDeletingId(null);
  };

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-4 py-1.5 text-sm text-neutral-500 mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-success-muted animate-pulse inline-block" />
            User Journey - Demonstrator
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">V-Inso-KI</h1>
          <p className="text-neutral-500 text-lg">
            KI-gestützte Datenextraktion aus Verbraucherinsolvenz-Formularen
          </p>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 mb-8">
          <FileUploadDropzone
            onUploadComplete={(caseId, result) => {
              router.push(
                `/cases/${caseId}/review?fields=${result.fieldCount}&low=${result.lowConfidenceCount}`
              );
            }}
          />
        </div>

        {/* Cases List */}
        {cases.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-700">Vorhandene Akten</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {cases.map((c) => (
                <li
                  key={c.caseId}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 cursor-pointer group"
                  onClick={() => router.push(`/cases/${c.caseId}/review`)}
                >
                  <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{c.filename}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(c.uploadedAt).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {c.status === "review_complete" ? (
                    <span className="flex items-center gap-1 text-xs text-success font-medium shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" /> Geklärt
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-warning-muted font-medium shrink-0">
                      <Clock className="w-3.5 h-3.5" /> Zu klären
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 shrink-0" />
                  <button
                    onClick={(e) => handleDelete(e, c.caseId)}
                    disabled={deletingId === c.caseId}
                    className="ml-1 p-1 rounded text-neutral-300 hover:text-error-muted hover:bg-error-subtle transition-colors shrink-0"
                    title="Akte löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-neutral-400 mt-6">
          Unterstützt: Amtliches VInsO-Formular 2020 · Powered by Claude claude-sonnet-4-6
        </p>
      </div>
    </main>
  );
}
