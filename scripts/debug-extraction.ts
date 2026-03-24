/**
 * Diagnostik-Script: Zeigt Rohtext + AcroForm-Felder eines PDFs.
 * Ausführen: npm run debug:extraction
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { extractFromPdf } from "../lib/extraction/extract-pdf";
import { extractGlaeubigerFromText } from "../lib/extraction/static-extractor";

const PDF_PATH = resolve(__dirname, "../../formular_pdf/INS-ErikaMueller_2026 Kopie.pdf");

async function main() {
  console.log("=== Lade PDF ===");
  const buffer = readFileSync(PDF_PATH);
  console.log(`Dateigröße: ${buffer.length} Bytes\n`);

  const { text, acroFields } = await extractFromPdf(buffer);

  // ── AcroForm-Felder ──────────────────────────────────────────────────────
  console.log("=== AcroForm-Felder ===");
  if (acroFields.length === 0) {
    console.log("(keine AcroForm-Felder gefunden — reines Text-PDF)");
  } else {
    for (const f of acroFields) {
      if (f.value && f.value !== "false") {
        console.log(`  [${f.fieldType ?? "??"}] "${f.name}" = "${f.value}"`);
      }
    }
    console.log(`\nGesamt AcroForm-Felder: ${acroFields.length}, davon ausgefüllt: ${acroFields.filter(f => f.value && f.value !== "false").length}`);
  }

  // ── Rohtext ─────────────────────────────────────────────────────────────
  console.log("\n=== Rohtext (vollständig) ===");
  console.log(text);

  // ── Gläubiger-Extraktion ─────────────────────────────────────────────────
  console.log("\n=== extractGlaeubigerFromText Ergebnis ===");
  const rows = extractGlaeubigerFromText(text);
  if (rows.length === 0) {
    console.log("(0 Gläubiger gefunden)");
  } else {
    rows.forEach((r, i) => {
      console.log(`  [${i}] name="${r.nameOderFirma}" | hauptforderung="${r.hauptforderungEur ?? "?"}" | summe="${r.summeForderungEur}" | grund="${r.forderungsgrund}"`);
    });
  }
}

main().catch(console.error);
