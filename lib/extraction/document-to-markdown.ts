/**
 * Konvertiert gängige Dokumentformate in Markdown-Text.
 * Wird für die .metadata-Ablage in Akten-Ordnern genutzt:
 *   data/akten/[slug]/.metadata/[folder]/[filename].md
 *
 * Unterstützte Formate:
 *   PDF        → pdfjs-dist (Text-Extraktion)
 *   DOCX/DOC   → mammoth
 *   XLSX/XLS   → xlsx (als Markdown-Tabelle)
 *   TXT/MD/CSV → Direktübernahme
 *   HTML/HTM   → Tag-Stripping
 *   EML        → mailparser (Metadaten + Body)
 *   Bilder     → Platzhalter (kein Text extrahierbar ohne OCR)
 */

import path from "path";

export interface MarkdownResult {
  markdown: string;
  /** Tatsächlich verwendete Extraktionsmethode */
  method: string;
}

// ─── Format-Erkennung ─────────────────────────────────────────────────────────

const EXT_MAP: Record<string, string> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".doc": "docx",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".txt": "text",
  ".md": "text",
  ".csv": "csv",
  ".html": "html",
  ".htm": "html",
  ".eml": "eml",
  ".msg": "eml",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".tiff": "image",
  ".tif": "image",
  ".gif": "image",
  ".webp": "image",
};

export function getSupportedExtensions(): string[] {
  return Object.keys(EXT_MAP);
}

export function isSupported(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext in EXT_MAP;
}

export function getFormatType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return EXT_MAP[ext] ?? "unknown";
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export async function convertToMarkdown(
  buffer: Buffer,
  filename: string
): Promise<MarkdownResult> {
  const format = getFormatType(filename);
  const name = path.basename(filename);

  const header = `# ${name}\n\n*Quelle: ${filename}*\n\n---\n\n`;

  switch (format) {
    case "pdf":
      return extractPdfMarkdown(buffer, name, header);

    case "docx":
      return extractDocxMarkdown(buffer, name, header);

    case "xlsx":
      return extractXlsxMarkdown(buffer, name, header);

    case "text":
      return {
        markdown: header + buffer.toString("utf-8"),
        method: "text",
      };

    case "csv":
      return {
        markdown: header + csvToMarkdownTable(buffer.toString("utf-8")),
        method: "csv",
      };

    case "html":
      return {
        markdown: header + stripHtml(buffer.toString("utf-8")),
        method: "html",
      };

    case "eml":
      return extractEmlMarkdown(buffer, name, header);

    case "image":
      return {
        markdown: header + `*Bilddatei – Textextraktion nicht verfügbar.*\n\nDateiname: \`${name}\`\n`,
        method: "image-placeholder",
      };

    default:
      return {
        markdown: header + `*Format nicht unterstützt: \`${path.extname(filename)}\`*\n`,
        method: "unsupported",
      };
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function extractPdfMarkdown(
  buffer: Buffer,
  name: string,
  header: string
): Promise<MarkdownResult> {
  try {
    const { extractFromPdf } = await import("@/lib/extraction/extract-pdf");
    const { text, acroFields } = await extractFromPdf(buffer);

    let md = header;

    // AcroForm-Felder als Tabelle (bei Formularen wertvoll)
    if (acroFields.length > 0) {
      md += `## Formularfelder (${acroFields.length})\n\n`;
      md += "| Feld | Wert |\n|------|------|\n";
      for (const f of acroFields) {
        if (f.value) {
          md += `| ${escape(f.name)} | ${escape(f.value)} |\n`;
        }
      }
      md += "\n## Volltext\n\n";
    }

    const bodyText = text.trim();
    if (bodyText) {
      md += bodyText;
      return { markdown: md, method: "pdf" };
    }

    // Kein Textlayer → OCR via Claude Vision
    try {
      const { isScannedPdf, renderPdfToImages, extractTextFromScannedPdf } =
        await import("@/lib/extraction/scanned-extractor");
      if (isScannedPdf(text)) {
        const images = renderPdfToImages(buffer);
        const ocrText = await extractTextFromScannedPdf(images);
        md += ocrText.trim() || "*OCR hat keinen Text erkannt.*";
        return { markdown: md, method: "pdf-ocr" };
      }
    } catch (ocrErr) {
      console.warn(`[document-to-markdown] OCR fehlgeschlagen für ${name}:`, ocrErr);
    }

    md += "*Kein Text extrahierbar (möglicherweise gescanntes PDF)*";
    return { markdown: md, method: "pdf" };
  } catch (err) {
    return {
      markdown: header + `*PDF-Extraktion fehlgeschlagen: ${err}*\n`,
      method: "pdf-error",
    };
  }
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

async function extractDocxMarkdown(
  buffer: Buffer,
  name: string,
  header: string
): Promise<MarkdownResult> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      const warnings = result.messages
        .filter((m) => m.type === "warning")
        .map((m) => m.message)
        .join(", ");
      if (warnings) {
        console.warn(`[document-to-markdown] ${name}: ${warnings}`);
      }
    }

    return {
      markdown: header + (result.value.trim() || "*Kein Text im Dokument*"),
      method: "docx",
    };
  } catch (err) {
    return {
      markdown: header + `*DOCX-Extraktion fehlgeschlagen: ${err}*\n`,
      method: "docx-error",
    };
  }
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

async function extractXlsxMarkdown(
  buffer: Buffer,
  name: string,
  header: string
): Promise<MarkdownResult> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let md = header;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      if (rows.length === 0) continue;

      md += `## Tabellenblatt: ${sheetName}\n\n`;

      // Erste Zeile als Header
      const [headerRow, ...dataRows] = rows as string[][];
      const cols = headerRow.length;

      md += "| " + headerRow.map((c) => escape(String(c))).join(" | ") + " |\n";
      md += "|" + " --- |".repeat(cols) + "\n";

      for (const row of dataRows.slice(0, 500)) {
        // Max 500 Zeilen
        md += "| " + row.map((c) => escape(String(c ?? ""))).join(" | ") + " |\n";
      }

      if (dataRows.length > 500) {
        md += `\n*... und ${dataRows.length - 500} weitere Zeilen*\n`;
      }

      md += "\n";
    }

    return { markdown: md, method: "xlsx" };
  } catch (err) {
    return {
      markdown: header + `*XLSX-Extraktion fehlgeschlagen: ${err}*\n`,
      method: "xlsx-error",
    };
  }
}

// ─── EML ──────────────────────────────────────────────────────────────────────

async function extractEmlMarkdown(
  buffer: Buffer,
  name: string,
  header: string
): Promise<MarkdownResult> {
  try {
    const { simpleParser } = await import("mailparser");
    const parsed = await simpleParser(buffer);

    const from = parsed.from?.text ?? "Unbekannt";
    const to = parsed.to
      ? Array.isArray(parsed.to)
        ? parsed.to.map((a) => a.text).join(", ")
        : parsed.to.text
      : "Unbekannt";
    const subject = parsed.subject ?? "(Kein Betreff)";
    const date = parsed.date
      ? parsed.date.toLocaleString("de-DE")
      : "Unbekannt";

    let md = header;
    md += `**Von:** ${from}  \n`;
    md += `**An:** ${to}  \n`;
    md += `**Betreff:** ${subject}  \n`;
    md += `**Datum:** ${date}  \n\n`;
    md += "---\n\n";

    const body = (parsed.text ?? "").trim();
    if (body) {
      md += body;
    } else if (parsed.html) {
      md += stripHtml(parsed.html);
    } else {
      md += "*Kein Textinhalt*";
    }

    // Anhänge auflisten
    if (parsed.attachments && parsed.attachments.length > 0) {
      md += "\n\n---\n\n## Anhänge\n\n";
      for (const att of parsed.attachments) {
        md += `- \`${att.filename ?? "Unbekannt"}\` (${att.contentType}, ${formatBytes(att.size ?? 0)})\n`;
      }
    }

    return { markdown: md, method: "eml" };
  } catch (err) {
    return {
      markdown: header + `*EML-Extraktion fehlgeschlagen: ${err}*\n`,
      method: "eml-error",
    };
  }
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function csvToMarkdownTable(csv: string): string {
  const lines = csv.trim().split("\n");
  if (lines.length === 0) return "*Leere CSV-Datei*";

  const parseRow = (line: string) =>
    line
      .split(",")
      .map((cell) => cell.replace(/^"(.*)"$/, "$1").trim());

  const rows = lines.map(parseRow);
  const cols = Math.max(...rows.map((r) => r.length));

  let md = "";
  md += "| " + rows[0].map(escape).join(" | ") + " |\n";
  md += "|" + " --- |".repeat(cols) + "\n";
  for (const row of rows.slice(1)) {
    md += "| " + row.map(escape).join(" | ") + " |\n";
  }
  return md;
}

/** Escapet Pipe-Zeichen in Markdown-Tabellenzellen */
function escape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
