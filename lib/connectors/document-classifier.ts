import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { z } from "zod";
import { extractFromPdf } from "@/lib/extraction/extract-pdf";
import type { AkteListItem } from "@/lib/extraction/types";
import type { ClassificationResult } from "@/lib/connectors/types";

function buildCaseListText(existingCases: AkteListItem[]): string {
  return existingCases.length > 0
    ? existingCases
        .map(
          (c) =>
            `- ID: ${c.caseId} | AZ: ${c.aktenzeichenDisplay ?? c.aktenzeichen ?? "—"} | Schuldner: ${c.schuldnerName ?? "—"}`
        )
        .join("\n")
    : "Keine Akten vorhanden";
}

const ClassificationSchema = z.object({
  isVInsOForm: z.boolean().describe("true wenn es sich um ein VInsO-Verbraucherinsolvenzformular handelt"),
  suggestedCaseId: z.string().nullable().describe("caseId der passenden Akte oder null"),
  confidence: z.number().min(0).max(1).describe("Konfidenz der Zuordnung (0–1)"),
  reason: z.string().describe("Kurze Begründung der Klassifikation"),
  extractedAktenzeichen: z.string().optional().describe("Im Dokument gefundenes Aktenzeichen"),
  extractedSchuldnerName: z.string().optional().describe("Im Dokument gefundener Schuldnername"),
});

function buildPrompt(documentText: string, existingCases: AkteListItem[]): string {
  const caseListText = buildCaseListText(existingCases);

  return `Analysiere das folgende Dokument und beantworte diese Fragen:
1. Handelt es sich um ein VInsO-Verbraucherinsolvenzformular (amtliches Formular nach § 305 InsO)?
   Erkennungsmerkmale: "Verbraucherinsolvenz", "Restschuldbefreiung", "Schuldner", "Gläubiger", "Anlage 1-7", "VInsO"
2. Falls ja oder falls ein anderes Insolvenz-Dokument: Welcher der vorhandenen Akten gehört dieses Dokument?
   Vergleiche Aktenzeichen und Schuldnernamen im Dokument mit der Aktenliste.

Vorhandene Akten:
${caseListText}

Dokument-Inhalt (Auszug):
${documentText}

Antworte mit dem JSON-Schema.`;
}

/**
 * Klassifiziert ein PDF-Dokument anhand seines Buffers.
 * Für andere Formate: classifyDocumentText() mit vorextrahiertem Text verwenden.
 */
export async function classifyDocument(
  pdfBuffer: Buffer,
  existingCases: AkteListItem[]
): Promise<ClassificationResult> {
  let documentText = "";
  try {
    const extracted = await extractFromPdf(pdfBuffer);
    documentText = extracted.text.slice(0, 3000);
  } catch {
    return {
      isVInsOForm: false,
      suggestedCaseId: null,
      confidence: 0,
      reason: "PDF-Text konnte nicht extrahiert werden",
    };
  }

  return classifyDocumentText(documentText, existingCases);
}

/**
 * Klassifiziert ein gescanntes PDF anhand von Seitenbildern via Claude Vision.
 * Wird verwendet wenn kein verwertbarer Textlayer vorhanden ist (handschriftliche Formulare).
 *
 * @param images  base64-kodierte PNG-Bilder der ersten Seiten (max. 2 genügen für Klassifikation)
 */
export async function classifyDocumentImages(
  images: string[],
  existingCases: AkteListItem[]
): Promise<ClassificationResult> {
  const caseListText = buildCaseListText(existingCases);

  const { object } = await generateObject({
    model: await getModel("primary"),
    schema: ClassificationSchema,
    messages: [
      {
        role: "user",
        content: [
          ...images.slice(0, 2).map((img) => ({
            type: "image" as const,
            image: img,
            mimeType: "image/png" as const,
          })),
          {
            type: "text" as const,
            text: `Analysiere das abgebildete Dokument und beantworte diese Fragen:
1. Handelt es sich um ein VInsO-Verbraucherinsolvenzformular (amtliches Formular nach § 305 InsO)?
   Erkennungsmerkmale: "Verbraucherinsolvenz", "Restschuldbefreiung", "Schuldner", "Gläubiger", "Anlage 1-7", "VInsO"
2. Falls ja oder falls ein anderes Insolvenz-Dokument: Welcher der vorhandenen Akten gehört dieses Dokument?
   Vergleiche Aktenzeichen und Schuldnernamen im Dokument mit der Aktenliste.

Vorhandene Akten:
${caseListText}

Antworte mit dem JSON-Schema.`,
          },
        ],
      },
    ],
  });

  return {
    isVInsOForm: object.isVInsOForm,
    suggestedCaseId: object.suggestedCaseId,
    confidence: object.confidence,
    reason: object.reason,
    extractedAktenzeichen: object.extractedAktenzeichen,
    extractedSchuldnerName: object.extractedSchuldnerName,
  };
}

/**
 * Klassifiziert ein Dokument anhand von vorextrahiertem Text (z.B. Markdown).
 * Wird für alle Nicht-PDF-Formate verwendet.
 */
export async function classifyDocumentText(
  documentText: string,
  existingCases: AkteListItem[]
): Promise<ClassificationResult> {
  if (!documentText.trim()) {
    return {
      isVInsOForm: false,
      suggestedCaseId: null,
      confidence: 0,
      reason: "Kein Textinhalt vorhanden",
    };
  }

  const { object } = await generateObject({
    model: await getModel("fast"),
    schema: ClassificationSchema,
    prompt: buildPrompt(documentText.slice(0, 3000), existingCases),
  });

  return {
    isVInsOForm: object.isVInsOForm,
    suggestedCaseId: object.suggestedCaseId,
    confidence: object.confidence,
    reason: object.reason,
    extractedAktenzeichen: object.extractedAktenzeichen,
    extractedSchuldnerName: object.extractedSchuldnerName,
  };
}
