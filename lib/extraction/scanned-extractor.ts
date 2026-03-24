/**
 * OCR-Extraktor für eingescannte/handschriftliche VInsO-Formulare.
 *
 * Ablauf:
 *   1. PDF-Seiten → PNG-Bilder via pdftoppm (Poppler)
 *   2. Bilder → Claude Vision (claude-sonnet-4-6)
 *   3. Strukturierte Feldextraktion direkt aus den Bildern
 *
 * Voraussetzung: Poppler muss installiert sein (`brew install poppler`
 * oder `apt-get install poppler-utils`).
 */

import { execSync } from "child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateObject, generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { loadSettings } from "@/lib/ai/settings-store";
import { z } from "zod";
import { VINSO_FIELD_GROUPS } from "./vinso-field-groups";
import type { CaseFile, CaseField, CaseFieldGroup } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Konfiguration
// ─────────────────────────────────────────────────────────────────────────────

/** Bildseitenauflösung in DPI (80 = ausreichend für Handschrift-OCR bei ~150-200 KB/Seite) */
const OCR_RESOLUTION = 80;

/**
 * Maximale Seitenanzahl an Claude (0 = alle Seiten).
 * VInsO-Formulare können bis zu 33 Seiten haben (Anlage 6 ab S.24, Anlage 7 ab S.26).
 */
const MAX_OCR_PAGES = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Erkennung
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt true zurück wenn das PDF keinen verwertbaren Textlayer enthält
 * (eingescannt, handschriftlich, gedruckt ohne Textlayer).
 */
export function isScannedPdf(text: string): boolean {
  return text.trim().length < 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF → Bilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Konvertiert die ersten MAX_OCR_PAGES Seiten des PDFs in base64-kodierte PNG-Bilder.
 * Nutzt pdftoppm aus dem Poppler-Paket.
 *
 * @throws Error wenn pdftoppm nicht gefunden wird
 */
export function renderPdfToImages(buffer: Buffer): string[] {
  const tmpDir = mkdtempSync(join(tmpdir(), "ainsolvenz-ocr-"));
  const pdfPath = join(tmpDir, "input.pdf");
  const prefix = join(tmpDir, "page");

  try {
    writeFileSync(pdfPath, buffer);

    const pageLimit = MAX_OCR_PAGES > 0 ? `-l ${MAX_OCR_PAGES}` : "";
    execSync(
      `pdftoppm -r ${OCR_RESOLUTION} -png ${pageLimit} "${pdfPath}" "${prefix}"`,
      { timeout: 120_000 }
    );

    // Generierte PNG-Dateien in Seitenreihenfolge einlesen
    const pngFiles = readdirSync(tmpDir)
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort(); // alphabetisch = Seitenreihenfolge

    return pngFiles.map((f) => readFileSync(join(tmpDir, f)).toString("base64"));
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("pdftoppm")) {
      throw new Error(
        "pdftoppm nicht gefunden. Bitte Poppler installieren: brew install poppler"
      );
    }
    throw err;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude-Vision-Schema + Prompt
// ─────────────────────────────────────────────────────────────────────────────

const VisionExtractionSchema = z.object({
  fields: z.array(
    z.object({
      fieldId: z.string(),
      value: z.string(),
      confidence: z.number(),
      confidenceReason: z.string(),
    })
  ),
  glaeubigerAnzahl: z.number(),
});

function buildVisionPrompt(): string {
  // Alle Feld-IDs aus allen Gruppen sammeln (als Referenzliste für Claude)
  const fieldLines: string[] = [];
  for (const group of VINSO_FIELD_GROUPS) {
    const kp = group.keyPrefix ?? group.groupId;
    if (group.isArray) {
      for (const f of group.fields) {
        fieldLines.push(`${kp}__INDEX__${f.fieldId}  (${f.label})`);
      }
    } else {
      for (const f of group.fields) {
        fieldLines.push(`${group.groupId}__${f.fieldId}  (${f.label})`);
      }
    }
  }

  return `Du bist ein Experte fuer deutsches Insolvenzrecht und analysierst handschriftlich ausgefuellte
amtliche Verbraucherinsolvenz-Formulare (VInsO 2020). Die Formulare koennen handschriftlich oder
maschinenschriftlich ausgefuellt sein.

Deine Aufgabe: Extrahiere alle ausgefuellten Felder aus den Formularseiten.

REGELN:
- value: extrahierter Wert als String, leerer String wenn Feld leer oder unleserlich
- Fuer Checkboxen/Ankreuzfelder: value = "true" wenn angekreuzt, sonst "false"
- Fuer Radio-Felder: value = den angekreuzten Textwert (z.B. "ledig", "weiblich")
- confidence: 0.0 (unleserlich) bis 1.0 (klar lesbar)
- confidenceReason: Begruendung nur wenn confidence < 0.85 (z.B. "handschriftlich schwer lesbar")
- Extrahiere NUR was im Formular steht. Keine Interpretation oder Ergaenzung.
- Bei Handschrift: Gib den erkannten Wert an und setze confidence entsprechend der Lesbarkeit.

Feld-Schema (INDEX = 0, 1, 2 ... fuer Arrays):
${fieldLines.join("\n")}

Glaeubigerfelder (Anlage 6 + Anlage 7 §69) - Schema: glaeubigeranlage6__INDEX__FELDNAME:
Anlage 6 Felder:
- nameOderFirma: Name/Kurzbezeichnung des Glaeubiger
- forderungsgrund: Art der Forderung
- hauptforderungEur: Hauptforderung in EUR als Dezimalzahl (z.B. "18500.00")
- zinsenEur: Zinsen in EUR als Dezimalzahl
- zinsenBis: Datum bis zu dem Zinsen berechnet wurden
- kostenEur: Kosten in EUR als Dezimalzahl
- summeForderungEur: Summe aller Forderungen in EUR
- anteilGesamtverschuldungPct: Anteil an Gesamtverschuldung in %
Anlage 7 §69 Felder:
- adresse: Vollstaendige Anschrift (Strasse Hausnr., PLZ Ort)
- geschaeftszeichen: Geschaeftszeichen des Glaeubiger
- gesetzlVertreten: Gesetzlich vertreten durch
- bevName: Name des Verfahrensbevollmaechtigten
- bevStrasseHausnr: Strasse und Hausnummer des Bevollmaechtigten
- bevPlzOrt: PLZ und Ort des Bevollmaechtigten
- bevGeschaeftszeichen: Geschaeftszeichen des Bevollmaechtigten
glaeubigerAnzahl = Gesamtanzahl Glaeubigerzeilen in Anlage 6`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisierung (analog zu claude-extractor.ts)
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_CONFIRM_THRESHOLD = 0.85;

function makeField(
  fc: { fieldId: string; label: string; fieldType: string },
  raw: { value: string; confidence: number; confidenceReason?: string }
): CaseField {
  return {
    fieldId: fc.fieldId,
    label: fc.label,
    fieldType: fc.fieldType as CaseField["fieldType"],
    extractedValue: raw.value,
    confidence: raw.confidence,
    confidenceReason: raw.confidenceReason ?? "",
    status:
      raw.value === "" || raw.confidence >= AUTO_CONFIRM_THRESHOLD
        ? "extracted_confirmed"
        : "extracted_unreviewed",
  };
}

function normalizeVisionExtraction(
  claudeFields: Map<string, { value: string; confidence: number; confidenceReason: string }>,
  glaeubigerAnzahl: number,
  filename: string,
  processingTimeMs: number
): Omit<CaseFile, "caseId"> {
  const fieldGroups: CaseFieldGroup[] = [];

  for (const groupConfig of VINSO_FIELD_GROUPS) {
    const { groupId, label, anlageName, sectionLabel, isArray, fields: fieldConfigs, displayMode } = groupConfig;
    const keyPrefix = groupConfig.keyPrefix ?? groupId;

    if (isArray) {
      const count = Math.max(glaeubigerAnzahl, 0);
      const instances: CaseField[][] = [];

      for (let idx = 0; idx < count; idx++) {
        const instance = (fieldConfigs ?? []).map((fc) => {
          const key = `${keyPrefix}__${idx}__${fc.fieldId}`;
          const r = claudeFields.get(key);
          return r
            ? makeField(fc, r)
            : makeField(fc, { value: "", confidence: 0.1, confidenceReason: "Nicht gefunden" });
        });
        instances.push(instance);
      }

      fieldGroups.push({ groupId, label, anlageName, sectionLabel, isArray: true, instances, displayMode });
    } else {
      const fieldList = (fieldConfigs ?? []).map((fc) => {
        const key = `${groupId}__${fc.fieldId}`;
        const r = claudeFields.get(key);
        return r
          ? makeField(fc, r)
          : makeField(fc, { value: "", confidence: 0.1, confidenceReason: "Nicht gefunden" });
      });

      fieldGroups.push({ groupId, label, anlageName, sectionLabel, fields: fieldList, displayMode });
    }
  }

  const allFields = fieldGroups.flatMap((g) =>
    g.isArray && g.instances ? g.instances.flat() : g.fields ?? []
  );
  const caseStatus = allFields.every((f) => f.status !== "extracted_unreviewed")
    ? "review_complete"
    : "review_in_progress";

  return { filename, uploadedAt: new Date().toISOString(), status: caseStatus, processingTimeMs, fieldGroups };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrahiert VInsO-Felder aus Seitenbildern eines eingescannten PDFs via Claude Vision.
 *
 * @param images            base64-kodierte PNG-Bilder (eine Eintrag pro Seite)
 * @param filename          Originaldateiname für Metadaten
 * @param processingStartMs Startzeit in ms (für processingTimeMs-Berechnung)
 */
export async function extractVInsOFromScannedPdf(
  images: string[],
  filename: string,
  processingStartMs: number
): Promise<Omit<CaseFile, "caseId">> {
  console.log(`[OCR] Starte Vision-Extraktion mit ${images.length} Seite(n).`);

  const { object } = await generateObject({
    model: await getModel("primary"),
    schema: VisionExtractionSchema,
    system: buildVisionPrompt(),
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            image: img,
            mimeType: "image/png" as const,
          })),
          {
            type: "text" as const,
            text: "Analysiere diese Formularseiten und extrahiere alle ausgefuellten Felder.",
          },
        ],
      },
    ],
  });

  const claudeFields = new Map(
    object.fields.map((f) => [
      f.fieldId,
      { value: f.value, confidence: f.confidence, confidenceReason: f.confidenceReason },
    ])
  );

  console.log(
    `[OCR] Claude hat ${object.fields.length} Felder gefunden, ${object.glaeubigerAnzahl} Gläubiger.`
  );

  const processingTimeMs = Date.now() - processingStartMs;
  return normalizeVisionExtraction(claudeFields, object.glaeubigerAnzahl, filename, processingTimeMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Allgemeiner OCR-Volltext (konfigurierbar: tesseract | claude | mistral)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrahiert den Volltext aus Seitenbildern eines eingescannten PDFs.
 * Verwendet den konfigurierten OCR-Provider (settings.ocrProvider).
 */
export async function extractTextFromScannedPdf(images: string[]): Promise<string> {
  const { ocrProvider } = await loadSettings();
  console.log(`[OCR] Allgemeine Texterkennung (${ocrProvider}) für ${images.length} Seite(n).`);
  switch (ocrProvider) {
    case "tesseract": return extractTextViaTesseract(images);
    case "mistral":   return extractTextViaMistral(images);
    default:          return extractTextViaClaude(images);
  }
}

async function extractTextViaClaude(images: string[]): Promise<string> {
  const { text } = await generateText({
    model: await getModel("primary"),
    messages: [{
      role: "user",
      content: [
        ...images.map((img) => ({
          type: "image" as const,
          image: img,
          mimeType: "image/png" as const,
        })),
        {
          type: "text" as const,
          text: "Gib den vollständigen Text dieser Seiten wieder. Behalte die Struktur (Absätze, Aufzählungen) bei. Keine Erklärungen, nur der extrahierte Text.",
        },
      ],
    }],
  });
  return text;
}

async function extractTextViaTesseract(images: string[]): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("deu");
  const parts: string[] = [];
  try {
    for (const img of images) {
      const { data: { text } } = await worker.recognize(Buffer.from(img, "base64"));
      if (text.trim()) parts.push(text.trim());
    }
  } finally {
    await worker.terminate();
  }
  return parts.join("\n\n");
}

async function extractTextViaMistral(images: string[]): Promise<string> {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const settings = await loadSettings();
  const apiKey = settings.mistral.apiKey || process.env.MISTRAL_API_KEY || "";
  const mistral = createOpenAI({ baseURL: "https://api.mistral.ai/v1", apiKey });
  const { text } = await generateText({
    model: mistral("pixtral-12b-2409"),
    messages: [{
      role: "user",
      content: [
        ...images.map((img) => ({
          type: "image" as const,
          image: img,
          mimeType: "image/png" as const,
        })),
        {
          type: "text" as const,
          text: "Gib den vollständigen Text dieser Seiten wieder. Behalte die Struktur bei. Nur der extrahierte Text.",
        },
      ],
    }],
  });
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// VInsO-Dispatch (konfigurierbar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch-Wrapper für die VInsO-Extraktion aus gescannten PDFs.
 * Tesseract → Text-Pfad; Claude/Mistral → Vision-Pfad.
 */
export async function dispatchScannedPdfExtraction(
  buffer: Buffer,
  images: string[],
  filename: string,
  startMs: number
): Promise<Omit<CaseFile, "caseId">> {
  const { ocrProvider } = await loadSettings();
  if (ocrProvider === "tesseract") {
    const { extractFromPdf } = await import("@/lib/extraction/extract-pdf");
    const { extractVInsOFromText } = await import("@/lib/extraction/claude-extractor");
    const { acroFields } = await extractFromPdf(buffer);
    const ocrText = await extractTextViaTesseract(images);
    return extractVInsOFromText(ocrText, acroFields, filename, startMs);
  }
  return extractVInsOFromScannedPdf(images, filename, startMs);
}
