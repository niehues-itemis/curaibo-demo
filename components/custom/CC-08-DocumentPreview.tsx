"use client";

import { useCallback } from "react";
import { FileDown, X } from "lucide-react";

export interface PreviewFile {
  folder: string;
  filename: string;
  url: string;
  ext: string;
}

export function DocumentPreviewModal({
  file,
  caseId,
  onClose,
}: {
  file: PreviewFile;
  caseId: string;
  onClose: () => void;
}) {
  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || file.ext !== ".docx") return;
      import("docx-preview").then(({ renderAsync }) =>
        fetch(file.url)
          .then((r) => r.arrayBuffer())
          .then((buf) =>
            renderAsync(buf, el, undefined, {
              className: "docx-preview",
              inWrapper: false,
              ignoreWidth: true,
              ignoreHeight: true,
            })
          )
      ).catch(() => {
        el.textContent = "Vorschau konnte nicht geladen werden.";
      });
    },
    [file.url, file.ext]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <span className="text-sm font-medium text-neutral-700 font-mono truncate">{file.filename}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <a
              href={`/api/cases/${caseId}/documents/${file.folder}/${encodeURIComponent(file.filename)}`}
              download={file.filename}
              className="text-xs text-neutral-500 hover:text-brand flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-subtle"
            >
              <FileDown className="h-3.5 w-3.5" /> Herunterladen
            </a>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {file.ext === ".pdf" ? (
            <iframe src={file.url} className="w-full h-full min-h-[70vh]" title={file.filename} />
          ) : file.ext === ".docx" ? (
            <div ref={containerRef} className="px-8 py-6 text-sm [&_.docx-preview]:max-w-none" />
          ) : (
            <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
              Keine Vorschau für diesen Dateityp verfügbar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
