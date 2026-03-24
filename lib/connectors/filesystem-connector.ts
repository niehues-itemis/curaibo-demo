import { readdir, readFile, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { extractFromPdf } from "@/lib/extraction/extract-pdf";
import { extractVInsOFromText } from "@/lib/extraction/claude-extractor";
import { isScannedPdf, renderPdfToImages, extractVInsOFromScannedPdf } from "@/lib/extraction/scanned-extractor";
import {
  saveCase,
  savePdf,
  saveIncomingDocument,
  saveUnassignedDocument,
  listCases,
  saveDocumentMetadata,
} from "@/lib/storage/case-store";
import { classifyDocumentText } from "@/lib/connectors/document-classifier";
import { saveSyncState } from "@/lib/connectors/connector-store";
import { convertToMarkdown, getSupportedExtensions } from "@/lib/extraction/document-to-markdown";
import { triggerDocumentAnalysis } from "@/lib/connectors/trigger-analysis";
import type { Connector, FilesystemConnectorConfig, SyncResult } from "@/lib/connectors/types";

/** Maximal 3 Dokumente pro Sync-Lauf (Timeout-Schutz bei langer KI-Extraktion) */
const MAX_PER_SYNC = 3;

const SUPPORTED_EXTENSIONS = new Set(getSupportedExtensions());

export async function syncFilesystemConnector(
  connector: Connector,
  processedSet: Set<string>
): Promise<SyncResult> {
  const config = connector.config as FilesystemConnectorConfig;
  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    errors: [],
    newCaseIds: [],
    assignedToCaseIds: [],
  };

  if (!existsSync(config.watchPath)) {
    result.errors.push(`Watchpfad nicht gefunden: ${config.watchPath}`);
    return result;
  }

  let files: string[];
  try {
    files = await readdir(config.watchPath);
  } catch (err) {
    result.errors.push(`Ordner konnte nicht gelesen werden: ${err}`);
    return result;
  }

  // Alle unterstützten Formate, die noch nicht verarbeitet wurden
  const newFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext) && !processedSet.has(f);
  });

  if (newFiles.length === 0) return result;

  const existingCases = await listCases();

  let processCount = 0;
  for (const filename of newFiles) {
    if (processCount >= MAX_PER_SYNC) {
      result.skipped += newFiles.length - processCount;
      break;
    }

    const filePath = path.join(config.watchPath, filename);
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const buffer = await readFile(filePath);

      // 1. Dokument → Markdown konvertieren
      const { markdown } = await convertToMarkdown(buffer, filename);

      // 2. KI-Klassifikation auf Basis des Markdowns
      let classification;
      try {
        classification = await classifyDocumentText(markdown, existingCases);
      } catch {
        classification = {
          isVInsOForm: false,
          suggestedCaseId: null,
          confidence: 0,
          reason: "Klassifikation nicht möglich",
        };
      }

      // 3. Routing: VInsO-Formular (nur PDFs), bekannte Akte, oder unbekannt
      const isPdf = path.extname(filename).toLowerCase() === ".pdf";

      if (classification.isVInsOForm && isPdf) {
        // Vollständige VInsO-Extraktion
        const startMs = Date.now();
        const { text: pdfText, acroFields } = await extractFromPdf(buffer);

        let caseData;
        if (isScannedPdf(pdfText)) {
          const images = renderPdfToImages(buffer);
          caseData = await extractVInsOFromScannedPdf(images, filename, startMs);
        } else {
          caseData = await extractVInsOFromText(pdfText, acroFields, filename, startMs);
        }

        const caseId = await saveCase(caseData);
        await savePdf(caseId, buffer);
        await saveIncomingDocument(caseId, filename, buffer);
        await saveDocumentMetadata(caseId, "eingehend", filename, markdown);
        triggerDocumentAnalysis(caseId, "eingehend", filename);

        result.newCaseIds.push(caseId);
        existingCases.push({
          caseId,
          filename,
          uploadedAt: new Date().toISOString(),
          status: "review_in_progress",
        });
      } else if (classification.suggestedCaseId) {
        // Bekannte Akte gefunden
        try {
          await saveIncomingDocument(classification.suggestedCaseId, filename, buffer);
          await saveDocumentMetadata(classification.suggestedCaseId, "eingehend", filename, markdown);
          triggerDocumentAnalysis(classification.suggestedCaseId, "eingehend", filename);
          result.assignedToCaseIds.push(classification.suggestedCaseId);
        } catch {
          await saveUnassignedDocument(filename, buffer);
        }
      } else {
        // Keine Zuordnung möglich → globaler Eingang
        await saveUnassignedDocument(filename, buffer);
      }

      // Datei nach erfolgreicher Verarbeitung löschen
      try {
        await unlink(filePath);
      } catch (unlinkErr) {
        console.warn(`[filesystem-connector] Konnte ${filename} nicht löschen:`, unlinkErr);
      }

      processedSet.add(filename);
      processCount++;
      result.processed++;
    } catch (err) {
      result.errors.push(`Fehler bei ${filename}: ${err}`);
      processCount++;
    }
  }

  await saveSyncState(connector.id, processedSet);
  return result;
}
