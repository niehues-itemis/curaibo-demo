/**
 * Statischer Extraktor für VInsO-Formulare.
 *
 * Stufe 1: AcroForm-Extraktion  — liest interaktive PDF-Formularfelder direkt aus.
 * Stufe 2: Textmuster-Extraktion — wendet Regex-Muster auf extrahierten Rohtext an.
 *
 * Rückgabe: Map<fieldId, {value, confidence, method}>
 * Die aufrufende Schicht entscheidet, welche Felder danach noch an Claude gehen.
 */

import {
  ACROFORM_FIELD_MAP,
  TEXT_FIELD_PATTERNS,
  CHECKED_MARKERS,
  UNCHECKED_MARKERS,
} from "./vinso-static-mapping";

export interface StaticExtractionResult {
  value: string;
  confidence: number;
  /** "acroform" = direkt aus PDF-Feld | "text" = Regex auf Rohtext | "none" = nicht gefunden */
  method: "acroform" | "text" | "none";
}

export interface AcroField {
  /** Feldname im PDF */
  name: string;
  /** Feldwert (leer wenn nicht ausgefüllt) */
  value: string;
  /** AcroForm-Feldtyp: "Tx" (Text), "Btn" (Checkbox/Radio), "Ch" (Choice) */
  fieldType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AcroForm-Extraktion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mehrere PDF-Felder werden zu einem fieldId zusammengesetzt (z.B. Straße + Hausnr.).
 * Felder mit gleicher fieldId werden in Reihenfolge ihres Auftretens konkateniert.
 */
const COMBINATION_PARTS: Record<string, string> = {
  // Schuldner Adresse
  "Textfeld 32": "schuldner_person__strasseHausnr",   // Straße
  "Textfeld 33": "schuldner_person__strasseHausnr",   // Hausnummer
  "Textfeld 34": "schuldner_person__plzOrt",           // PLZ
  "Textfeld 35": "schuldner_person__plzOrt",           // Ort
  // Bevollmächtigte Adresse
  "Textfeld 60": "verfahrensbevollmaechtigte__strasseHausnr",
  "Textfeld 61": "verfahrensbevollmaechtigte__strasseHausnr",
  "Textfeld 62": "verfahrensbevollmaechtigte__plzOrt",
  "Textfeld 63": "verfahrensbevollmaechtigte__plzOrt",
  // Arbeitgeber Adresse (Anlage 5G) — Seite 17
  "Textfeld 280": "arbeitgeber_5g__strasseHausnr",
  "Textfeld 281": "arbeitgeber_5g__strasseHausnr",
  "Textfeld 282": "arbeitgeber_5g__plzOrt",
  "Textfeld 283": "arbeitgeber_5g__plzOrt",
  // Legacy / alternative Feldnamen (selbst erstellte PDFs)
  "Strasse":     "schuldner_person__strasseHausnr",
  "Strae":       "schuldner_person__strasseHausnr",
  "Hausnummer":  "schuldner_person__strasseHausnr",
  "PLZ":         "schuldner_person__plzOrt",
  "Ort":         "schuldner_person__plzOrt",
};

/**
 * Radio-Button-Textwerte → boolean (für ja/nein Felder und RSB-Radios).
 * Alle anderen Textwerte werden unverändert übernommen (z.B. "ledig", "Angestellte(r)").
 */
const RADIO_BOOL_VALUES: Record<string, string> = {
  "ja": "true",
  "Ja": "true",
  "nein": "false",
  "Nein": "false",
  "bisher nicht gestellt": "false",
};

/**
 * Mappt AcroForm-Felder direkt auf unsere fieldIds.
 * @param acroFields  Aus extract-pdf.ts extrahierte AcroForm-Felder
 */
export function extractFromAcroForm(
  acroFields: AcroField[]
): Map<string, StaticExtractionResult> {
  const results = new Map<string, StaticExtractionResult>();
  // Kombinierte Felder: Teile nach fieldId gesammelt
  const combinationBuffers = new Map<string, string[]>();

  for (const field of acroFields) {
    let value = (field.value ?? "").trim();
    if (!value) continue; // Leere Felder überspringen

    // Kombinierte Felder (Straße + Hausnr, PLZ + Ort etc.)
    const combinedFieldId = COMBINATION_PARTS[field.name];
    if (combinedFieldId) {
      if (!combinationBuffers.has(combinedFieldId)) {
        combinationBuffers.set(combinedFieldId, []);
      }
      combinationBuffers.get(combinedFieldId)!.push(value);
      continue;
    }

    const fieldId = ACROFORM_FIELD_MAP[field.name];
    if (!fieldId) {
      // Anlage 6/7 Felder werden separat verarbeitet — kein Log-Rauschen
      const isKnownDynamic =
        /^Textfeld (4[2-9]\d|[5-9]\d{2}|[1-9]\d{3})$/.test(field.name) ||
        /^Kontrollkästchen (2[6-9]\d|[3-9]\d{2})$/.test(field.name);
      if (!isKnownDynamic && value !== "false" && value !== "true") {
        console.log(`[AcroForm] Unbekanntes Feld: "${field.name}" = "${value}"`);
      }
      continue;
    }

    // Radio-Gruppen (Btn-Typ): Erst-Treffer mit nicht-"false" Wert gewinnt.
    // Text-Felder: letzter Wert gewinnt (spätere / spezifischere Felder überschreiben).
    if (field.fieldType === "Btn") {
      const existing = results.get(fieldId);
      if (existing && existing.value !== "false") {
        continue; // Radio: Bereits einen echten Wert → nicht überschreiben
      }
    }

    // Deutsche ja/nein Radio-Werte → boolean
    if (value in RADIO_BOOL_VALUES) {
      value = RADIO_BOOL_VALUES[value];
    }

    results.set(fieldId, { value, confidence: 1.0, method: "acroform" });
  }

  // Kombinierte Felder zusammensetzen
  for (const [fieldId, parts] of combinationBuffers) {
    results.set(fieldId, {
      value: parts.join(" ").trim(),
      confidence: 1.0,
      method: "acroform",
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Textmuster-Extraktion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wendet die Regex-Muster aus vinso-static-mapping.ts auf den PDF-Rohtext an.
 * Nur Felder, die noch nicht per AcroForm gefunden wurden (oder konfidenzarm sind).
 *
 * @param text          Vollständiger extrahierter PDF-Text
 * @param skipFieldIds  Set von fieldIds, die bereits per AcroForm gefunden wurden
 */
export function extractFromTextPatterns(
  text: string,
  skipFieldIds: Set<string> = new Set()
): Map<string, StaticExtractionResult> {
  const results = new Map<string, StaticExtractionResult>();

  for (const [fieldId, patterns] of Object.entries(TEXT_FIELD_PATTERNS)) {
    // Template-Einträge überspringen (werden dynamisch behandelt)
    if (fieldId.includes("__TEMPLATE__")) continue;
    // Bereits per AcroForm gefunden
    if (skipFieldIds.has(fieldId)) continue;

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (!match) continue;

      const rawValue = (match[pattern.group ?? 1] ?? "").trim();
      if (!rawValue) continue;

      let value: string;

      if (pattern.isCheckbox) {
        // Checkbox/Radio: Prüfe ob der Marker checked ist
        const fullMatch = match[0];
        const hasChecked = CHECKED_MARKERS.some((m) => fullMatch.includes(m));
        const hasUnchecked = UNCHECKED_MARKERS.some((m) => fullMatch.includes(m));

        if (hasChecked) {
          value = "true";
        } else if (hasUnchecked) {
          value = "false";
        } else {
          // Muster hat getroffen aber kein klarer Marker → niedrige Konfidenz
          value = "true"; // Annahme: Feld wurde wegen Erwähnung gefunden
        }
      } else {
        value = cleanExtractedValue(rawValue);
      }

      results.set(fieldId, {
        value,
        confidence: pattern.confidence,
        method: "text",
      });
      break; // Erstes passendes Muster gewinnt
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gläubiger-AcroForm-Extraktion (Anlage 6, amtl. Fassung 1/2021)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bekannte Feldmuster für Anlage 6 + Anlage 7 §69 (amtl. Fassung 1/2021).
 * Ermittelt durch Log-Analyse der offiziellen VInsO-PDF.
 *
 * Anlage 6 – Feldfolge (Offset 0–6):
 *   +0 nameOderFirma, +1 hauptforderungEur, +2 zinsenEur, +3 zinsenBis,
 *   +4 kostenEur, +5 forderungsgrund, +6 summeForderungEur
 *
 * Anlage 7 §69 – Feldfolge (Offset 0–10):
 *   +0 name(Gläubiger), +1 strasseHausnr, +2 plzOrt, +3 geschaeftszeichen,
 *   +4 gesetzlVertreten, +5 bevName, +6 bevStrasseHausnr, +7 bevPlzOrt,
 *   +8 bevGeschaeftszeichen, +9 summeForderungEur, +10 anteilGesamtverschuldungPct
 */
interface GlaeubigerPattern {
  baseTextfeld: number;
  step: number;
  maxRows: number;
  /** Direkte 1:1-Mappings: Index → fieldId. Leerstring = überspringen */
  fields: string[];
  amountIndices: number[];
  /** Felder aus mehreren Offsets zusammensetzen */
  combinedFields?: Array<{ targetField: string; offsets: number[]; separator: string }>;
  /** Nur schreiben wenn das Zielfeld noch nicht belegt ist */
  fallbackFields?: Array<{ targetField: string; offset: number; isAmount?: boolean }>;
  /**
   * Bei supplementären Patterns (z.B. Anlage 7 §69): Gläubiger-Index aus dem
   * lfd.Nr.-Feld ableiten (0-basiert = lfdNr - 1). Wenn gesetzt, wird dieser
   * Offset für die Zeilen-Erkennung UND für den Index genutzt.
   */
  lfdNrOffset?: number;
  /** Welcher Offset enthält den Namen (für Zeilen-Erkennung wenn kein lfdNrOffset) */
  nameCheckOffset?: number;
  /**
   * Supplementäre Patterns reichern bestehende Gläubiger an (kein count-Increment).
   * Wird automatisch gesetzt wenn lfdNrOffset vorhanden.
   */
  supplementary?: boolean;
  tituliertKkBase?: number;
  tituliertKkStep?: number;
}

const GLAEUBIGERACROFORM_PATTERNS: GlaeubigerPattern[] = [
  {
    // Amtliche Fassung 1/2021 – Anlage 6 (Hauptforderungen)
    baseTextfeld: 424,
    step: 8,
    maxRows: 20,
    fields: ["nameOderFirma", "hauptforderungEur", "zinsenEur", "zinsenBis", "kostenEur", "forderungsgrund", "summeForderungEur"],
    amountIndices: [1, 2, 4, 6],
    tituliertKkBase: 271,
    tituliertKkStep: 2,
  },
  {
    // Amtliche Fassung 1/2021 – Anlage 7 §69 Seite 1 (Gläubiger 1–3, ohne lfd.Nr.-Feld)
    // Struktur: +0 Name, +1 Straße, +2 PLZ/Ort, +3 GZ, +4 gesetzlVertr.,
    //           +5 BevName, +6 BevStraße, +7 BevPLZ, +8 BevGZ, +9 Summe, +10 Anteil
    baseTextfeld: 643,
    step: 11,
    maxRows: 3, // Nur Zeilen auf Seite 1
    supplementary: true, // reichert Anlage-6-Daten an, kein count-Increment
    fields: [
      "",                              // +0 Name (nur Zeilen-Erkennung)
      "",                              // +1 Straße → combinedFields
      "",                              // +2 PLZ/Ort → combinedFields
      "geschaeftszeichen",             // +3
      "gesetzlVertreten",              // +4
      "bevName",                       // +5
      "bevStrasseHausnr",              // +6
      "bevPlzOrt",                     // +7
      "bevGeschaeftszeichen",          // +8
      "",                              // +9 Summe → fallback
      "anteilGesamtverschuldungPct",   // +10
    ],
    amountIndices: [],
    combinedFields: [
      { targetField: "adresse", offsets: [1, 2], separator: "\n" },
    ],
    fallbackFields: [
      { targetField: "summeForderungEur", offset: 9, isAmount: true },
    ],
  },
  {
    // Amtliche Fassung 1/2021 – Anlage 7 §69 Seite 2 (Gläubiger 4–N, MIT lfd.Nr.-Feld)
    // Struktur: +0 lfd.Nr., +1 Name, +2 Straße, +3 PLZ/Ort, +4 GZ, +5 gesetzlVertr.,
    //           +6 BevName, +7 BevStraße, +8 BevPLZ, +9 BevGZ, +10 Summe, +11 Anteil
    baseTextfeld: 676,
    step: 12,
    maxRows: 20,
    lfdNrOffset: 0, // lfd.Nr. bei Offset 0 → bestimmt glaeubigeranlage6-Index
    fields: [
      "",                              // +0 lfd.Nr. → Index-Bestimmung
      "",                              // +1 Name → skip (Anlage 6 hat Name)
      "",                              // +2 Straße → combinedFields
      "",                              // +3 PLZ/Ort → combinedFields
      "geschaeftszeichen",             // +4
      "gesetzlVertreten",              // +5
      "bevName",                       // +6
      "bevStrasseHausnr",              // +7
      "bevPlzOrt",                     // +8
      "bevGeschaeftszeichen",          // +9
      "",                              // +10 Summe → fallback
      "anteilGesamtverschuldungPct",   // +11
    ],
    amountIndices: [],
    combinedFields: [
      { targetField: "adresse", offsets: [2, 3], separator: "\n" },
    ],
    fallbackFields: [
      { targetField: "summeForderungEur", offset: 10, isAmount: true },
    ],
  },
];

/**
 * Extrahiert Gläubigerzeilen direkt aus AcroForm-Feldern (Anlage 6).
 * Gibt staticMap-kompatible Einträge (glaeubigeranlage6__idx__feldId) zurück.
 */
export function extractGlaeubigerFromAcroForm(
  acroFields: AcroField[]
): { count: number; results: Map<string, StaticExtractionResult> } {
  const fieldMap = new Map(acroFields.map((f) => [f.name, f]));
  const results = new Map<string, StaticExtractionResult>();
  let count = 0;

  for (const pattern of GLAEUBIGERACROFORM_PATTERNS) {
    const { baseTextfeld, step, maxRows, fields, amountIndices, combinedFields, fallbackFields, tituliertKkBase, tituliertKkStep } = pattern;
    const isSupplementary = pattern.supplementary === true || pattern.lfdNrOffset !== undefined;

    for (let i = 0; i < maxRows; i++) {
      let glaeubigerIndex: number;

      if (pattern.lfdNrOffset !== undefined) {
        // Supplementär mit lfd.Nr.: Index aus dem lfd.Nr.-Feld ableiten (1-basiert → 0-basiert)
        const lfdNrField = fieldMap.get(`Textfeld ${baseTextfeld + i * step + pattern.lfdNrOffset}`);
        const lfdNr = parseInt(lfdNrField?.value ?? "");
        if (isNaN(lfdNr) || lfdNr <= 0) continue;
        glaeubigerIndex = lfdNr - 1;
      } else {
        // Primäres oder supplementäres Pattern ohne lfd.Nr.: Offset nameCheckOffset prüfen
        const nameCheckOffset = pattern.nameCheckOffset ?? 0;
        const nameField = fieldMap.get(`Textfeld ${baseTextfeld + i * step + nameCheckOffset}`);
        if (!nameField?.value) continue;
        glaeubigerIndex = i;
      }

      if (!isSupplementary) {
        count = Math.max(count, glaeubigerIndex + 1);
      }

      const prefix = `glaeubigeranlage6__${glaeubigerIndex}__`;

      // Direkte 1:1-Mappings
      for (let j = 0; j < fields.length; j++) {
        if (!fields[j]) continue; // leerer String = überspringen
        const field = fieldMap.get(`Textfeld ${baseTextfeld + i * step + j}`);
        if (!field?.value) continue;

        const value = amountIndices.includes(j) ? normalizeAmount(field.value) : field.value;
        results.set(prefix + fields[j], { value, confidence: 1.0, method: "acroform" });
      }

      // Kombinierte Felder (z.B. Straße + PLZ/Ort → adresse)
      if (combinedFields) {
        for (const cf of combinedFields) {
          const parts = cf.offsets
            .map((off) => fieldMap.get(`Textfeld ${baseTextfeld + i * step + off}`)?.value ?? "")
            .filter(Boolean);
          if (parts.length === 0) continue;
          results.set(prefix + cf.targetField, {
            value: parts.join(cf.separator),
            confidence: 1.0,
            method: "acroform",
          });
        }
      }

      // Fallback-Felder (nur setzen wenn Feld noch nicht belegt)
      if (fallbackFields) {
        for (const ff of fallbackFields) {
          if (results.has(prefix + ff.targetField)) continue;
          const field = fieldMap.get(`Textfeld ${baseTextfeld + i * step + ff.offset}`);
          if (!field?.value) continue;
          const value = ff.isAmount ? normalizeAmount(field.value) : field.value;
          results.set(prefix + ff.targetField, { value, confidence: 1.0, method: "acroform" });
        }
      }

      if (tituliertKkBase !== undefined && tituliertKkStep !== undefined) {
        const kk = fieldMap.get(`Kontrollkästchen ${tituliertKkBase + i * tituliertKkStep}`);
        if (kk !== undefined) {
          results.set(prefix + "forderungTituliert", {
            value: kk.value === "true" ? "true" : "false",
            confidence: 1.0,
            method: "acroform",
          });
        }
      }
    }
  }

  return { count, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gläubiger-Tabellen-Extraktion aus Rohtext (Fallback für nicht-AcroForm PDFs)
// ─────────────────────────────────────────────────────────────────────────────

export interface GlaeubigerRow {
  nameOderFirma: string;
  adresse: string;
  hauptforderungEur: string;
  forderungsgrund: string;
  summeForderungEur: string;
}

/**
 * Versucht Gläubigerzeilen aus dem Rohtext zu extrahieren.
 * Funktioniert nur wenn Tabellendaten im Textlayer stehen (kein AcroForm-PDF).
 * Bei AcroForm-PDFs ist extractGlaeubigerFromAcroForm der richtige Weg.
 *
 * Anlage 6 hat KEINE Adressspalte — adresse bleibt leer.
 */
export function extractGlaeubigerFromText(text: string): GlaeubigerRow[] {
  const rows: GlaeubigerRow[] = [];

  const anlage6Start = text.search(/Anlage\s+6|Gl[äa]ubiger(?:verzeichnis|liste)/i);
  if (anlage6Start === -1) return rows;

  const anlage6Text = text.slice(anlage6Start);

  // Nummerierte Zeilen: Nr. | Name | Hauptforderung | Forderungsgrund | Summe
  const numberedPattern =
    /^(\d{1,2})\s+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d &.,\-]+?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s+(.*?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = numberedPattern.exec(anlage6Text)) !== null) {
    rows.push({
      nameOderFirma: match[2].trim(),
      adresse: "",
      hauptforderungEur: normalizeAmount(match[3]),
      forderungsgrund: match[4].trim(),
      summeForderungEur: normalizeAmount(match[5]),
    });
    if (rows.length >= 20) break;
  }

  // Fallback: Firma + Forderungsgrund + Betrag ohne Nummerierung
  if (rows.length === 0) {
    const firmPattern =
      /([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d &.,\-]+(?:GmbH|AG|KG|eG|Ltd|SE|e\.V\.|mbH|Finanzamt|Sparkasse|Telekom|AOK|EnBW)[^\n]*?)\s+([^\n]+?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*$/gm;

    while ((match = firmPattern.exec(anlage6Text)) !== null) {
      rows.push({
        nameOderFirma: match[1].trim(),
        adresse: "",
        hauptforderungEur: "",
        forderungsgrund: match[2].trim(),
        summeForderungEur: normalizeAmount(match[3]),
      });
      if (rows.length >= 20) break;
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function cleanExtractedValue(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–:]+|[\s\-–:]+$/g, "")
    .trim();
}

/** Normalisiert deutsches Zahlenformat "1.234,56" oder "1234.56" → "1234.56" */
function normalizeAmount(raw: string): string {
  const cleaned = raw.replace(/\s|€/g, "");
  if (cleaned.includes(",")) {
    return cleaned.replace(/\./g, "").replace(",", ".");
  }
  return cleaned;
}
