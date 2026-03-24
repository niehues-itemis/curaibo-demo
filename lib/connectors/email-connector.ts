import type { Connector, EmailConnectorConfig, SyncResult } from "@/lib/connectors/types";
import { classifyDocumentText, classifyDocumentImages } from "@/lib/connectors/document-classifier";
import {
  saveCase,
  savePdf,
  saveIncomingDocument,
  saveUnassignedDocument,
  saveDocumentMetadata,
  listCases,
} from "@/lib/storage/case-store";
import { extractFromPdf } from "@/lib/extraction/extract-pdf";
import { extractVInsOFromText } from "@/lib/extraction/claude-extractor";
import { isScannedPdf, renderPdfToImages, dispatchScannedPdfExtraction } from "@/lib/extraction/scanned-extractor";
import { convertToMarkdown, isSupported } from "@/lib/extraction/document-to-markdown";
import { triggerDocumentAnalysis } from "@/lib/connectors/trigger-analysis";

/** Maximal 5 Mails pro Sync-Lauf */
const MAX_PER_SYNC = 5;

// ─── E-Mail als PDF rendern ───────────────────────────────────────────────────

/**
 * Rendert eine E-Mail (Metadaten + Textinhalt) als PDF mit pdfkit.
 * Das erzeugte PDF landet im "eingehend"-Ordner der zugeordneten Akte.
 */
async function renderEmailToPdf(meta: {
  subject: string;
  from: string;
  to: string;
  date: string;
  textBody: string;
  htmlBody?: string;
}): Promise<Buffer> {
  // pdfkit dynamisch importieren (serverExternalPackage)
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header ────────────────────────────────────────────────────────────────
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("E-Mail", { align: "left" })
      .moveDown(0.5);

    doc.fontSize(9).font("Helvetica").fillColor("#555555");

    const metaLines: [string, string][] = [
      ["Von:", meta.from],
      ["An:", meta.to],
      ["Betreff:", meta.subject],
      ["Datum:", meta.date],
    ];

    for (const [label, value] of metaLines) {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(label, 50, y, { continued: true, width: 60 });
      doc.font("Helvetica").text(` ${value}`, { width: 460 });
    }

    // ── Trennlinie ────────────────────────────────────────────────────────────
    doc.moveDown(0.8);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.8);

    // ── Body ──────────────────────────────────────────────────────────────────
    doc.fontSize(10).font("Helvetica").fillColor("#000000");

    // Plain-text bevorzugen; bei HTML-only: Tags entfernen
    let body = meta.textBody.trim();
    if (!body && meta.htmlBody) {
      body = meta.htmlBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    if (body) {
      doc.text(body, { lineGap: 2 });
    } else {
      doc.fillColor("#999999").text("(Kein Textinhalt)");
    }

    doc.end();
  });
}

// ─── Verbindungstest ──────────────────────────────────────────────────────────

export async function testEmailConnection(config: EmailConnectorConfig): Promise<boolean> {
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  try {
    await client.connect();
    await client.noop();
    return true;
  } catch {
    return false;
  } finally {
    try { await client.logout(); } catch { /* ignorieren */ }
  }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Verarbeitet ungelesene E-Mails eines IMAP-Postfachs.
 *
 * Pro Mail:
 *  1. Mail selbst → PDF (Metadaten + Body) → Klassifikation → Akte
 *  2. Jeder PDF-Anhang → Klassifikation → Akte (wie Filesystem-Connector)
 *  3. Mail als gelesen markieren
 */
export async function syncEmailConnector(connector: Connector): Promise<SyncResult> {
  const config = connector.config as EmailConnectorConfig;
  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    errors: [],
    newCaseIds: [],
    assignedToCaseIds: [],
  };

  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.mailbox);

    try {
      // Ungelesene Mails suchen
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchResult = await (client as any).search({ seen: false }, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        return result;
      }

      const toProcess = uids.slice(0, MAX_PER_SYNC);
      result.skipped = Math.max(0, uids.length - MAX_PER_SYNC);

      const existingCases = await listCases();

      for (const uid of toProcess) {
        try {
          // Rohe Mail-Daten laden
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = await (client as any).fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg?.source) {
            result.errors.push(`UID ${uid}: Keine Nachrichtendaten`);
            continue;
          }

          // Sofort als gelesen markieren – vor jeder Verarbeitung.
          // Verhindert, dass ein parallel laufender Sync dieselbe Mail nochmals abholt.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any).messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

          const parsed = await simpleParser(msg.source as Buffer);

          const subject = parsed.subject ?? "(Kein Betreff)";
          const from = parsed.from?.text ?? "Unbekannt";
          const to = parsed.to
            ? Array.isArray(parsed.to)
              ? parsed.to.map((a) => a.text).join(", ")
              : parsed.to.text
            : "";
          const date = parsed.date
            ? parsed.date.toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })
            : new Date().toLocaleString("de-DE");

          const safeSubject = subject.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
          const emailPdfName = `Email_${date.replace(/[.:, ]/g, "-")}_${safeSubject}.pdf`;
          const emailMarkdown = buildEmailMarkdown({ subject, from, to, date, textBody: parsed.text ?? "", htmlBody: parsed.html || undefined });

          // Pro Mail wird höchstens eine neue Akte angelegt – via diesem Flag verfolgt
          let assignedCaseId: string | null = null;

          // ── 1. PDF-Anhänge: VInsO-Prüfung und Routing ─────────────────────
          // Nur Anhänge werden auf VInsO geprüft, nicht der E-Mail-Body selbst.
          const supportedAttachments = (parsed.attachments ?? []).filter((a) =>
            isSupported(a.filename ?? "")
          );

          for (const attachment of supportedAttachments) {
            try {
              const buffer = Buffer.isBuffer(attachment.content)
                ? attachment.content
                : Buffer.from(attachment.content);

              const filename = attachment.filename ?? `Anhang_${Date.now()}`;
              const isPdf = filename.toLowerCase().endsWith(".pdf");

              // Für PDFs: zuerst Text-Layer prüfen, um gescannte PDFs früh zu erkennen
              // und doppeltes OCR (convertToMarkdown + dispatchScannedPdfExtraction) zu vermeiden.
              let attMarkdown: string;
              let cachedImages: string[] | null = null;
              let cachedPdfText: Awaited<ReturnType<typeof extractFromPdf>> | null = null;

              if (isPdf) {
                const extracted = await extractFromPdf(buffer);
                if (isScannedPdf(extracted.text)) {
                  // Bilder einmal rendern – für Klassifikation UND Extraktion wiederverwenden
                  cachedImages = renderPdfToImages(buffer);
                  attMarkdown = ""; // kein OCR-Markdown hier; Klassifikation läuft via Vision
                } else {
                  cachedPdfText = extracted;
                  ({ markdown: attMarkdown } = await convertToMarkdown(buffer, filename));
                }
              } else {
                ({ markdown: attMarkdown } = await convertToMarkdown(buffer, filename));
              }

              const classification = await (
                cachedImages !== null
                  ? classifyDocumentImages(cachedImages, existingCases)
                  : classifyDocumentText(attMarkdown, existingCases)
              ).catch(() => ({ isVInsOForm: false, suggestedCaseId: null, confidence: 0, reason: "Klassifikation fehlgeschlagen" }));

              if (classification.isVInsOForm && isPdf && !assignedCaseId) {
                // Neue Akte anlegen (max. eine pro Mail)
                const startMs = Date.now();

                let caseData;
                if (cachedImages !== null) {
                  // Gescannt: bereits gerenderte Bilder direkt verwenden – kein zweites renderPdfToImages
                  caseData = await dispatchScannedPdfExtraction(buffer, cachedImages, filename, startMs);
                } else {
                  const { text: pdfText, acroFields } = cachedPdfText ?? await extractFromPdf(buffer);
                  caseData = await extractVInsOFromText(pdfText, acroFields, filename, startMs);
                }

                const caseId = await saveCase(caseData);
                await savePdf(caseId, buffer);
                await saveIncomingDocument(caseId, filename, buffer);
                await saveDocumentMetadata(caseId, "eingehend", filename, attMarkdown);
                triggerDocumentAnalysis(caseId, "eingehend", filename);

                assignedCaseId = caseId;
                result.newCaseIds.push(caseId);
                existingCases.push({ caseId, filename, uploadedAt: new Date().toISOString(), status: "review_in_progress" });

              } else if (!classification.isVInsOForm && classification.suggestedCaseId) {
                // Anhang zu bestehender Akte zuordnen
                const targetId = classification.suggestedCaseId;
                await saveIncomingDocument(targetId, filename, buffer);
                await saveDocumentMetadata(targetId, "eingehend", filename, attMarkdown);
                triggerDocumentAnalysis(targetId, "eingehend", filename);
                if (!assignedCaseId) assignedCaseId = targetId;
                if (!result.assignedToCaseIds.includes(targetId)) result.assignedToCaseIds.push(targetId);

              } else {
                await saveUnassignedDocument(filename, buffer);
              }
            } catch (err) {
              result.errors.push(`UID ${uid} – Anhang fehlgeschlagen: ${err}`);
              // Dokument trotzdem speichern, damit es nicht verloren geht
              try {
                const buffer = Buffer.isBuffer(attachment.content)
                  ? attachment.content
                  : Buffer.from(attachment.content);
                const filename = attachment.filename ?? `Anhang_${Date.now()}`;
                await saveUnassignedDocument(filename, buffer);
              } catch { /* ignorieren */ }
            }
          }

          // ── 2. E-Mail-Body als PDF in die Akte (nie neue Akte) ────────────
          try {
            const emailPdfBuffer = await renderEmailToPdf({
              subject, from, to, date,
              textBody: parsed.text ?? "",
              htmlBody: parsed.html || undefined,
            });

            if (assignedCaseId) {
              await saveIncomingDocument(assignedCaseId, emailPdfName, emailPdfBuffer);
              await saveDocumentMetadata(assignedCaseId, "eingehend", emailPdfName, emailMarkdown);
            } else {
              await saveUnassignedDocument(emailPdfName, emailPdfBuffer);
            }
          } catch (err) {
            result.errors.push(`UID ${uid} – E-Mail-Body-PDF fehlgeschlagen: ${err}`);
          }

          result.processed++;
        } catch (err) {
          result.errors.push(`UID ${uid}: ${err}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    result.errors.push(`IMAP-Verbindungsfehler: ${err}`);
  } finally {
    try { await client.logout(); } catch { /* ignorieren */ }
  }

  return result;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function buildEmailMarkdown(meta: {
  subject: string;
  from: string;
  to: string;
  date: string;
  textBody: string;
  htmlBody?: string;
}): string {
  let md = `# ${meta.subject}\n\n`;
  md += `**Von:** ${meta.from}  \n`;
  md += `**An:** ${meta.to}  \n`;
  md += `**Datum:** ${meta.date}  \n\n---\n\n`;

  const body = meta.textBody.trim();
  if (body) {
    md += body;
  } else if (meta.htmlBody) {
    md += meta.htmlBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    md += "*Kein Textinhalt*";
  }
  return md;
}

