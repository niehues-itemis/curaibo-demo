"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  Menu,
  PanelLeftClose,
  Plus,
  X,
} from "lucide-react";
import { FileUploadDropzone } from "@/components/custom/CC-05-FileUploadDropzone";
import type { AkteListItem } from "@/lib/extraction/types";

function statusColor(status: AkteListItem["status"]): string {
  switch (status) {
    case "extracting": return "bg-brand-light text-brand-dark";
    case "review_in_progress": return "bg-warning-light text-warning-dark";
    case "review_complete": return "bg-success-light text-green-800";
    default: return "bg-neutral-100 text-neutral-700";
  }
}

function statusLabel(status: AkteListItem["status"]): string {
  switch (status) {
    case "extracting": return "Wird erfasst";
    case "review_in_progress": return "Zu klären";
    case "review_complete": return "Geklärt";
    default: return status;
  }
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AktenSidebar({ collapsed, onToggle }: Props) {
  const params = useParams<{ caseId?: string }>();
  const router = useRouter();
  const activeCaseId = params?.caseId ?? null;

  const [akten, setAkten] = useState<AkteListItem[]>([]);
  const [todoCounts, setTodoCounts] = useState<Map<string, number>>(new Map());
  const [showUpload, setShowUpload] = useState(false);

  const loadAkten = useCallback(async () => {
    const [aktenRes, todosRes] = await Promise.all([
      fetch("/api/akten").catch(() => null),
      fetch("/api/todos").catch(() => null),
    ]);
    if (aktenRes?.ok) setAkten(await aktenRes.json());
    if (todosRes?.ok) {
      const todos: { caseId: string; proposals: unknown[] }[] = await todosRes.json();
      const map = new Map<string, number>();
      todos.forEach((t) => { if (t.proposals.length > 0) map.set(t.caseId, t.proposals.length); });
      setTodoCounts(map);
    }
  }, []);

  useEffect(() => { loadAkten(); }, [loadAkten]);

  useEffect(() => {
    window.addEventListener("akten-updated", loadAkten);
    return () => window.removeEventListener("akten-updated", loadAkten);
  }, [loadAkten]);

  const handleUploadComplete = (caseId: string) => {
    setShowUpload(false);
    loadAkten();
    router.push(`/akten/${caseId}`);
  };

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col items-center pt-3 border-r bg-white">
        <button
          onClick={onToggle}
          className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors"
          title="Seitenleiste öffnen"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-72 flex-shrink-0 flex flex-col border-r bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-text bg-brand-subtle hover:bg-brand-light px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Neue Akte
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            title="Seitenleiste einklappen"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Akten list */}
        <div className="flex-1 overflow-y-auto">
          {akten.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-neutral-400">
              Noch keine Akten vorhanden.
            </div>
          ) : (
            <ul className="py-1">
              {akten.map((akte) => {
                const isActive = akte.caseId === activeCaseId;
                return (
                  <li key={akte.caseId}>
                    <Link
                      href={`/akten/${akte.caseId}`}
                      className={`flex flex-col px-3 py-2.5 transition-colors border-l-2 ${
                        isActive
                          ? "bg-brand-subtle border-brand text-brand-text"
                          : "border-transparent hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-brand" : "text-neutral-400"}`} />
                        <span className="text-xs font-semibold truncate">
                          {akte.aktenzeichenDisplay ?? akte.aktenzeichen ?? "—"}
                        </span>
                        {(todoCounts.get(akte.caseId) ?? 0) > 0 && (
                          <span className="ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning text-white">
                            {todoCounts.get(akte.caseId)}
                          </span>
                        )}
                      </div>
                      {akte.schuldnerName && (
                        <span className="text-xs text-neutral-500 ml-5 truncate mt-0.5">
                          {akte.schuldnerName}
                        </span>
                      )}
                      <div className="ml-5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(akte.status)}`}>
                          {statusLabel(akte.status)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">VInsO-Formular hochladen</h2>
              <button onClick={() => setShowUpload(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FileUploadDropzone onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      )}
    </>
  );
}
