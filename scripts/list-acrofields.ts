/**
 * Listet alle AcroForm-Felder aus dem VInsO-PDF mit Seitennummer und Position.
 * Hilft beim Zuordnen der Feldnummern zu den Formular-Abschnitten.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import path from "path";

const PDF_PATH = resolve(__dirname, "../../formular_pdf/vinso_12_2020.pdf");

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

async function main() {
  const pdfjsLib = await getPdfjsLib();
  const buffer = readFileSync(PDF_PATH);
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib
    .getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true })
    .promise;

  console.log(`PDF: ${doc.numPages} Seiten\n`);

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const annotations = await page.getAnnotations();
    const fields = annotations.filter(
      (a: Record<string, unknown>) => a.subtype === "Widget" && a.fieldName
    );

    // Erste 120 Zeichen des Seitentexts
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preview = content.items.map((i: any) => i.str ?? "").join(" ").replace(/\s+/g, " ").slice(0, 120).trim();

    console.log(`\n=== Seite ${pageNum} (${fields.length} Felder) ===`);
    console.log(`  Text: ${preview}`);
    for (const f of fields) {
      const type = f.fieldType === "Tx" ? "Text" : f.fieldType === "Btn" ? "Btn " : f.fieldType;
      const y = f.rect ? Math.round(f.rect[1]) : 0;
      console.log(`  [${type}] "${f.fieldName}"  y=${y}`);
    }
  }

  await doc.destroy();
}

main().catch(console.error);
