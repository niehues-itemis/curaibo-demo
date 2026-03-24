/**
 * Generiert einen befüllten Gläubiger-Serienbrief pro Gläubiger-Instanz
 * und gibt alle Dokumente als ZIP-Archiv zurück.
 */

import { readFileSync } from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import JSZip from "jszip";
import type { CaseFile } from "@/lib/extraction/types";
import { ensureTemplate, TEMPLATE_PATH } from "./template-builder";
import { extractLetterData } from "./glaeubiger-mapping";

/**
 * Erzeugt ein einzelnes befülltes .docx für einen Gläubiger.
 */
function generateSingleBrief(data: Record<string, string>): Buffer {
  const templateBuffer = readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Erstellt einen sicheren Dateinamen aus dem Gläubiger-Namen.
 */
function safeFilename(name: string, index: number): string {
  const clean = name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 40);
  const num = String(index + 1).padStart(2, "0");
  return `Glaeubigerbrief_${num}_${clean || "Unbekannt"}.docx`;
}

/**
 * Generiert alle Gläubiger-Briefe und gibt sie als benannte Buffer-Liste zurück.
 *
 * @throws Error wenn keine Gläubiger-Instanzen vorhanden sind
 */
export function generateGlaeubigerBriefeFiles(
  caseData: CaseFile
): Array<{ filename: string; buffer: Buffer }> {
  ensureTemplate();

  const glaeubigerGroup = caseData.fieldGroups.find((g) => g.groupId === "glaeubigeranlage6");
  const instances = glaeubigerGroup?.instances ?? [];

  if (instances.length === 0) {
    throw new Error("Keine Gläubiger-Daten im Fall vorhanden.");
  }

  const results: Array<{ filename: string; buffer: Buffer }> = [];
  for (let i = 0; i < instances.length; i++) {
    const letterData = extractLetterData(caseData, i);
    const buffer = generateSingleBrief(letterData);
    const filename = safeFilename(letterData["glaeubigerName"] ?? "", i);
    results.push({ filename, buffer });
  }
  return results;
}

/**
 * Generiert alle Gläubiger-Briefe und gibt sie als ZIP-Buffer zurück.
 *
 * @throws Error wenn keine Gläubiger-Instanzen vorhanden sind
 */
export async function generateGlaeubigerBriefe(caseData: CaseFile): Promise<Buffer> {
  ensureTemplate();

  const glaeubigerGroup = caseData.fieldGroups.find((g) => g.groupId === "glaeubigeranlage6");
  const instances = glaeubigerGroup?.instances ?? [];

  if (instances.length === 0) {
    throw new Error("Keine Gläubiger-Daten im Fall vorhanden.");
  }

  const outputZip = new JSZip();

  for (let i = 0; i < instances.length; i++) {
    const letterData = extractLetterData(caseData, i);
    const docxBuffer = generateSingleBrief(letterData);
    const filename = safeFilename(letterData["glaeubigerName"] ?? "", i);
    outputZip.file(filename, docxBuffer);
  }

  return outputZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
