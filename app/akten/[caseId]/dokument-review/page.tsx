"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DRAG_KEY, AUFGABE_CREATE_EVENT } from "@/lib/drag-types";
import type { DragSource, AufgabeCreateDetail } from "@/lib/drag-types";

interface Proposal {
  id: string;
  fieldLabel: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  groupId: string;
  fieldId: string;
  sourceDocument: { folder: string; filename: string };
}

// ─── Highlight-Helpers ────────────────────────────────────────────────────────

/**
 * Sucht `searchText` in allen Text-Nodes unterhalb `container`,
 * umschließt Treffer mit einem <mark>-Element und gibt die eingefügten
 * Marks zurück (für späteres Cleanup).
 */
function applyHighlight(container: HTMLElement, searchText: string): HTMLElement[] {
  const marks: HTMLElement[] = [];
  if (!searchText.trim()) return marks;

  const lower = searchText.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const idx = text.toLowerCase().indexOf(lower);
    if (idx === -1) continue;

    try {
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + searchText.length);
      const after = text.slice(idx + searchText.length);

      const mark = document.createElement("mark");
      mark.style.cssText =
        "background:#fde68a;border-radius:2px;padding:0 1px;outline:2px solid #f59e0b;";
      mark.textContent = match;

      const parent = textNode.parentNode!;
      if (before) parent.insertBefore(document.createTextNode(before), textNode);
      parent.insertBefore(mark, textNode);
      if (after) parent.insertBefore(document.createTextNode(after), textNode);
      parent.removeChild(textNode);

      marks.push(mark);
    } catch {
      // Text-Node in komplexem Element — überspringen
    }
  }

  // Zum ersten Treffer scrollen
  if (marks.length > 0) {
    marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return marks;
}

function removeHighlights(marks: HTMLElement[]) {
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

// ─── Seite ────────────────────────────────────────────────────────────────────

export default function DokumentReviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const docKey = searchParams.get("doc") ?? "";

  const [folder, filename] = docKey.includes("/")
    ? [docKey.split("/")[0], docKey.split("/").slice(1).join("/")]
    : ["eingehend", docKey];

  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const docUrl = `/api/cases/${caseId}/documents/${folder}/${encodeURIComponent(filename)}`;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // DOCX-Rendering
  const docxRendered = useRef(false);
  const docxElRef = useRef<HTMLDivElement | null>(null);
  const highlightMarksRef = useRef<HTMLElement[]>([]);

  const loadProposals = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/proposals`);
    if (res.ok) {
      const all: Proposal[] = await res.json();
      setProposals(all.filter(
        (p) => p.sourceDocument?.folder === folder &&
               p.sourceDocument?.filename === filename
      ));
    }
  }, [caseId, folder, filename]);

  useEffect(() => {
    setLoading(true);
    loadProposals().finally(() => setLoading(false));
  }, [loadProposals]);

  const docxContainerRef = useCallback((el: HTMLDivElement | null) => {
    docxElRef.current = el;
    if (!el || ext !== ".docx" || docxRendered.current) return;
    docxRendered.current = true;
    import("docx-preview").then(({ renderAsync }) =>
      fetch(docUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => renderAsync(buf, el, undefined, {
          className: "docx-preview",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
        }))
    ).catch(() => { el.textContent = "Vorschau konnte nicht geladen werden."; });
  }, [docUrl, ext]);

  // Highlight on hover — versucht proposedValue, dann currentValue
  const handleProposalHover = useCallback((proposal: Proposal | null) => {
    removeHighlights(highlightMarksRef.current);
    highlightMarksRef.current = [];

    if (!proposal || !docxElRef.current) return;

    const primary = proposal.proposedValue?.trim();
    const fallback = proposal.currentValue?.trim();

    let marks = primary ? applyHighlight(docxElRef.current, primary) : [];
    if (marks.length === 0 && fallback) {
      marks = applyHighlight(docxElRef.current, fallback);
    }
    highlightMarksRef.current = marks;
  }, []);

  const handleDecision = async (proposalId: string, status: "accepted" | "rejected") => {
    setSaving(proposalId);
    try {
      const res = await fetch(`/api/cases/${caseId}/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, status } : p));
      }
    } finally {
      setSaving(null);
    }
  };

  const handleBulk = async (status: "accepted" | "rejected") => {
    const pending = proposals.filter((p) => p.status === "pending");
    for (const p of pending) await handleDecision(p.id, status);
  };

  const pending = proposals.filter((p) => p.status === "pending");
  const allDone = proposals.length > 0 && pending.length === 0;
  const isDocx = ext === ".docx";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/todos" className="text-neutral-400 hover:text-neutral-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-neutral-900 text-sm">Dokument-Prüfung</h1>
            <p className="text-xs text-neutral-400 font-mono">{filename}</p>
          </div>
        </div>
        {allDone && (
          <Link href="/todos">
            <Button size="sm" variant="outline" className="gap-1.5">
              <CheckCircle className="h-4 w-4 text-success" /> Fertig – zurück zu TODOs
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Document */}
          <div className="flex-1 overflow-hidden border-r bg-neutral-50">
            {ext === ".pdf" ? (
              <iframe src={docUrl} className="w-full h-full" title={filename} />
            ) : ext === ".docx" ? (
              <div className="h-full overflow-auto px-8 py-6">
                <div ref={docxContainerRef} className="text-sm [&_.docx-preview]:max-w-none" />
              </div>
            ) : (
              <div className="h-full overflow-auto p-6">
                <iframe src={docUrl} className="w-full h-full min-h-[60vh] bg-white rounded-xl border" title={filename} />
              </div>
            )}
          </div>

          {/* Right: Proposals */}
          <div className="w-96 shrink-0 flex flex-col overflow-hidden bg-white">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="font-medium text-sm text-neutral-900">
                Vorschläge ({pending.length} offen)
              </span>
              {pending.length > 1 && (
                <div className="flex gap-1">
                  <button onClick={() => handleBulk("accepted")}
                    className="text-xs px-2 py-1 bg-success-subtle hover:bg-success-light text-success-text rounded font-medium">
                    Alle akzeptieren
                  </button>
                  <button onClick={() => handleBulk("rejected")}
                    className="text-xs px-2 py-1 bg-error-subtle hover:bg-error-light text-error-text rounded font-medium">
                    Alle ablehnen
                  </button>
                </div>
              )}
            </div>

            {isDocx && (
              <p className="px-4 py-2 text-xs text-neutral-400 border-b bg-neutral-50">
                Hover über einen Vorschlag um die Stelle im Dokument hervorzuheben.
              </p>
            )}

            <div className="flex-1 overflow-auto p-3 space-y-3">
              {proposals.length === 0 ? (
                <div className="text-center text-neutral-400 py-8 text-sm">
                  Keine Vorschläge für dieses Dokument.
                </div>
              ) : (
                proposals.map((p) => {
                  const vorschlagSource: DragSource = {
                    kind: "vorschlag",
                    caseId,
                    proposalId: p.id,
                    fieldLabel: p.fieldLabel,
                    folder: p.sourceDocument.folder,
                    filename: p.sourceDocument.filename,
                    groupId: p.groupId,
                    fieldId: p.fieldId,
                  };
                  return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ source: vorschlagSource }));
                      e.dataTransfer.effectAllowed = "link";
                    }}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(DRAG_KEY)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "link";
                      }
                    }}
                    onDrop={(e) => {
                      try {
                        const raw = e.dataTransfer.getData(DRAG_KEY);
                        if (!raw) return;
                        const { source } = JSON.parse(raw) as { source: DragSource };
                        if (source.kind === "user") {
                          e.preventDefault();
                          const detail: AufgabeCreateDetail = { draggedSource: source, dropTarget: vorschlagSource };
                          window.dispatchEvent(new CustomEvent(AUFGABE_CREATE_EVENT, { detail }));
                        }
                      } catch { /* ignore */ }
                    }}
                    onMouseEnter={() => isDocx && handleProposalHover(p)}
                    onMouseLeave={() => isDocx && handleProposalHover(null)}
                    className={`rounded-xl border p-3 text-sm transition-all ${
                      p.status !== "pending" ? "opacity-50" : "cursor-grab"
                    } ${p.status === "accepted" ? "border-success-border bg-success-subtle/30" : ""}
                    ${p.status === "rejected" ? "border-error-border bg-error-subtle/30" : ""}
                    ${p.status === "pending" && isDocx ? "hover:border-warning-border hover:shadow-sm" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-neutral-900">{p.fieldLabel}</span>
                      <div className="flex gap-1 shrink-0">
                        {p.status === "pending" ? (
                          <>
                            <button
                              onClick={() => handleDecision(p.id, "accepted")}
                              disabled={saving === p.id}
                              className="p-1 rounded bg-success-subtle hover:bg-success-light text-success-text disabled:opacity-50"
                              title="Akzeptieren">
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDecision(p.id, "rejected")}
                              disabled={saving === p.id}
                              className="p-1 rounded bg-error-subtle hover:bg-error-light text-error-text disabled:opacity-50"
                              title="Ablehnen">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : p.status === "accepted" ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-error-muted" />
                        )}
                      </div>
                    </div>

                    {p.currentValue ? (
                      <div className="text-xs text-neutral-500 mb-1">
                        <span className="line-through text-error-muted">{p.currentValue}</span>
                        <span className="mx-1">→</span>
                        <span className="text-success-text font-medium">{p.proposedValue}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-success-text font-medium mb-1">
                        + {p.proposedValue}
                      </div>
                    )}

                    <p className="text-xs text-neutral-400 leading-relaxed">{p.reason}</p>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.confidence > 0.7 ? "bg-green-500" : p.confidence > 0.5 ? "bg-warning-muted" : "bg-error-muted"}`}
                          style={{ width: `${p.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-400">{Math.round(p.confidence * 100)}%</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
