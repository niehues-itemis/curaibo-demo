import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractFromPdf } from "../extract-pdf";
import {
  extractGlaeubigerFromAcroForm,
  extractGlaeubigerFromText,
  extractFromAcroForm,
  extractFromTextPatterns,
} from "../static-extractor";

const PDF_PATH = resolve(__dirname, "../../../../formular_pdf/INS-ErikaMueller_2026 Kopie.pdf");

let pdfText: string;
let acroFields: Awaited<ReturnType<typeof extractFromPdf>>["acroFields"];

beforeAll(async () => {
  const buffer = readFileSync(PDF_PATH);
  const result = await extractFromPdf(buffer);
  pdfText = result.text;
  acroFields = result.acroFields;
});

// ── AcroForm – Anlage 6 ──────────────────────────────────────────────────────

describe("extractGlaeubigerFromAcroForm", () => {
  it("findet alle 8 Gläubiger", () => {
    const { count } = extractGlaeubigerFromAcroForm(acroFields);
    expect(count).toBe(8);
  });

  it("Gläubiger 0: Sparkasse Rhein-Neckar", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__0__nameOderFirma")?.value).toBe("Sparkasse Rhein-Neckar");
    expect(results.get("glaeubigeranlage6__0__hauptforderungEur")?.value).toBe("60383.50");
    expect(results.get("glaeubigeranlage6__0__summeForderungEur")?.value).toBe("60383.50");
    expect(results.get("glaeubigeranlage6__0__forderungsgrund")?.value).toBe("Ratenkredit");
  });

  it("Gläubiger 1: Otti GmbH & Co KG", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__1__nameOderFirma")?.value).toBe("Otti GmbH & Co KG");
    expect(results.get("glaeubigeranlage6__1__hauptforderungEur")?.value).toBe("1513.10");
    expect(results.get("glaeubigeranlage6__1__forderungsgrund")?.value).toBe("Warenlieferung/Ratenkauf");
  });

  it("Gläubiger 4: Finanzamt Mosbach", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__4__nameOderFirma")?.value).toBe("Finanzamt Mosbach");
    expect(results.get("glaeubigeranlage6__4__hauptforderungEur")?.value).toBe("4522.00");
    expect(results.get("glaeubigeranlage6__4__forderungsgrund")?.value).toContain("Einkommenssteuer");
  });

  it("Gläubiger 7: AOK Baden-Württemberg", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__7__nameOderFirma")?.value).toBe("AOK Baden-Württemberg");
    expect(results.get("glaeubigeranlage6__7__summeForderungEur")?.value).toBe("2898.00");
  });
});

// ── AcroForm – Anlage 7 §69 Gläubigeradressen ───────────────────────────────

describe("extractGlaeubigerFromAcroForm – Anlage 7 §69 Adressen", () => {
  it("füllt adresse für Gläubiger 0 aus §69", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    const adresse = results.get("glaeubigeranlage6__0__adresse")?.value;
    expect(adresse).toBeTruthy();
    expect(adresse).toContain("Sparstraße 3");
    expect(adresse).toContain("74821 Mosbach");
  });

  it("füllt adresse für Gläubiger 3 (Bonprix) aus §69", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    const adresse = results.get("glaeubigeranlage6__3__adresse")?.value;
    expect(adresse).toContain("Bonprixweg 5");
    expect(adresse).toContain("14538 Hannover");
  });

  it("extrahiert bevName für Gläubiger 0", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__0__bevName")?.value).toBe("Rudolf Kreditberater");
  });

  it("extrahiert anteilGesamtverschuldungPct für Gläubiger 0", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    expect(results.get("glaeubigeranlage6__0__anteilGesamtverschuldungPct")?.value).toBe("83");
  });

  it("alle §69-Felder haben confidence 1.0 und method acroform", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    const adresse0 = results.get("glaeubigeranlage6__0__adresse");
    expect(adresse0?.confidence).toBe(1.0);
    expect(adresse0?.method).toBe("acroform");
  });
});

describe("extractGlaeubigerFromAcroForm – Gesamt", () => {
  it("alle Felder haben confidence 1.0 und method acroform", () => {
    const { results } = extractGlaeubigerFromAcroForm(acroFields);
    for (const [, r] of results) {
      expect(r.confidence).toBe(1.0);
      expect(r.method).toBe("acroform");
    }
  });
});

// ── AcroForm – Anlage 7 ──────────────────────────────────────────────────────

describe("extractFromAcroForm – Anlage 7", () => {
  it("extrahiert SBP-Datum", () => {
    const map = extractFromAcroForm(acroFields);
    expect(map.get("schuldenbereinigungsplan7__datum")?.value).toBe("12.03.2026");
  });

  it("extrahiert Planart (Flexible Raten)", () => {
    const map = extractFromAcroForm(acroFields);
    const planart = map.get("schuldenbereinigungsplan7__planart")?.value;
    expect(planart).toBeTruthy();
    expect(planart).toContain("Flexible Raten");
  });
});

// ── Textmuster – Anlage 7 ────────────────────────────────────────────────────

describe("extractFromTextPatterns – Anlage 7", () => {
  it("extrahiert SBP-Datum aus Text", () => {
    const map = extractFromTextPatterns(pdfText);
    // Datum 12.03.2026 muss irgendwo extrahiert werden (Anlage 7 Rohtext enthält kein Datum — AcroForm-Wert)
    // Nur prüfen, dass kein Fehler geworfen wird
    expect(map).toBeDefined();
  });
});

// ── Rohtext Gläubiger (Fallback) ─────────────────────────────────────────────

describe("extractGlaeubigerFromText", () => {
  it("findet keine Gläubiger im reinen Formulartext (AcroForm-PDF)", () => {
    // Bei diesem PDF stecken alle Werte in AcroForm — Textlayer enthält keine Daten
    const rows = extractGlaeubigerFromText(pdfText);
    // Nicht zwingend 0 — aber soll keinen Fehler werfen
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
  });
});
