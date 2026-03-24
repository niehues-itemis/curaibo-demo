"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface UploadResult {
  fieldCount: number;
  lowConfidenceCount: number;
  processingTimeMs: number;
}

interface Props {
  onUploadComplete: (caseId: string, result: UploadResult) => void;
}

const PROGRESS_MESSAGES = [
  "PDF wird hochgeladen…",
  "Text wird extrahiert…",
  "KI analysiert Formular…",
  "Felder werden strukturiert…",
  "Fast fertig…",
];

export function FileUploadDropzone({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgressMessages = () => {
    let i = 0;
    setProgressMsg(PROGRESS_MESSAGES[0]);
    intervalRef.current = setInterval(() => {
      i = Math.min(i + 1, PROGRESS_MESSAGES.length - 1);
      setProgressMsg(PROGRESS_MESSAGES[i]);
    }, 5000);
  };

  const stopProgressMessages = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Nur PDF-Dateien erlaubt.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Datei zu groß (max. 15 MB).");
      return;
    }

    setError(null);
    setUploading(true);
    startProgressMessages();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler.");
        return;
      }

      onUploadComplete(data.caseId, {
        fieldCount: data.fieldCount,
        lowConfidenceCount: data.lowConfidenceCount,
        processingTimeMs: data.processingTimeMs,
      });
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      stopProgressMessages();
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all select-none ${
          dragging
            ? "border-brand bg-brand-subtle scale-[1.01]"
            : uploading
            ? "border-neutral-300 bg-neutral-50 cursor-default"
            : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-4xl animate-spin">⚙</div>
            <p className="text-neutral-600 font-medium">{progressMsg}</p>
            <p className="text-sm text-neutral-400">
              Claude analysiert das Formular — dauert ca. 15–30 Sekunden
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-5xl">📄</div>
            <p className="text-xl font-semibold text-neutral-800">
              VInsO-Formular hier ablegen
            </p>
            <p className="text-sm text-neutral-500">
              PDF-Datei · max. 15 MB
            </p>
            <Button variant="outline" className="mt-2" onClick={(e) => e.stopPropagation()}>
              <label htmlFor="pdf-input" className="cursor-pointer">
                Datei auswählen
              </label>
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id="pdf-input"
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-3 text-sm text-error text-center">⚠ {error}</p>
      )}
    </div>
  );
}
