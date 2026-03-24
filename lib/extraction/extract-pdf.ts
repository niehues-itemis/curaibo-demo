import path from "path";
import type { AcroField } from "./static-extractor";

/**
 * PDF-Textextraktion + AcroForm-Extraktion via pdfjs-dist legacy build.
 * pdfjs-dist ist in next.config als serverExternalPackage markiert —
 * Turbopack bundelt es NICHT, Node.js lädt es nativ über require().
 */

export interface PdfExtractResult {
  /** Rohtext aus allen Seiten */
  text: string;
  /** AcroForm-Felder (nur bei digital ausgefüllten Formularen) */
  acroFields: AcroField[];
}

async function getPdfjsLib() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  lib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  return lib;
}

export async function extractFromPdf(buffer: Buffer): Promise<PdfExtractResult> {
  const pdfjsLib = await getPdfjsLib();
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib
    .getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true })
    .promise;

  const pageTexts: string[] = [];
  const acroFields: AcroField[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);

    // Text extrahieren
    const content = await page.getTextContent();
    const pageText = content.items.map((item: { str?: string }) => item.str ?? "").join(" ");
    pageTexts.push(pageText);

    // AcroForm-Annotationen extrahieren (interaktive Formularfelder)
    try {
      const annotations = await page.getAnnotations();
      for (const ann of annotations) {
        if (!ann.fieldName) continue;
        // Nur Formularfelder (Widget-Annotationen)
        if (ann.subtype !== "Widget") continue;

        const value = resolveAnnotationValue(ann);
        acroFields.push({
          name: ann.fieldName,
          value,
          fieldType: ann.fieldType,
        });
      }
    } catch {
      // AcroForm nicht verfügbar (z.B. gescanntes PDF) — kein Fehler
    }
  }

  await doc.destroy();
  return { text: pageTexts.join("\n\n"), acroFields };
}

/** Rückwärtskompatible Hilfsfunktion (wird noch von altem Code genutzt) */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractFromPdf(buffer);
  return text;
}

function resolveAnnotationValue(ann: Record<string, unknown>): string {
  // Checkbox / Radio
  if (ann.fieldType === "Btn") {
    // fieldValue ist oft "Yes"/"Off" oder der exportValue
    const val = ann.fieldValue ?? ann.buttonValue;
    if (val === "Yes" || val === "On" || val === "Ja") return "true";
    if (val === "Off" || val === "" || val === "No" || val === "Nein") return "false";
    return String(val ?? "");
  }
  // Choice (Dropdown / Listbox)
  if (ann.fieldType === "Ch") {
    const val = ann.fieldValue;
    if (Array.isArray(val)) return val.join(", ");
    return String(val ?? "");
  }
  // Textfeld
  return String(ann.fieldValue ?? "").trim();
}
