/**
 * Statisches Mapping: CaseField-IDs → Template-Variablen für den Gläubiger-Serienbrief.
 *
 * Quellgruppen:
 *  - schuldner_person          → Personaldaten des Schuldners
 *  - verfahrensangaben         → Verfahrensdaten (Aktenzeichen, Amtsgericht, Datum)
 *  - glaeubigeranlage6         → Forderungsdaten pro Gläubiger-Instanz (isArray)
 *  - glaeubigerAdressenAnlage7 → Adresse, Geschäftszeichen, Bevollmächtigte (isArray, gleicher Index)
 */

import type { CaseFile, CaseField } from "@/lib/extraction/types";

// ─── Mapping-Definitionen ─────────────────────────────────────────────────────

/** Felder aus nicht-Array-Gruppen → Template-Variablenname */
export const STATIC_FIELD_MAPPING: Array<{
  groupId: string;
  fieldId: string;
  templateVar: string;
}> = [
  // Schuldner-Personaldaten
  { groupId: "schuldner_person", fieldId: "vorname",       templateVar: "schuldnerVorname"  },
  { groupId: "schuldner_person", fieldId: "nachname",      templateVar: "schuldnerNachname" },
  { groupId: "schuldner_person", fieldId: "strasseHausnr", templateVar: "schuldnerAdresse"  },
  { groupId: "schuldner_person", fieldId: "plzOrt",        templateVar: "schuldnerPlzOrt"   },

  // Verfahrensangaben
  { groupId: "verfahrensangaben", fieldId: "aktenzeichen",            templateVar: "aktenzeichen"           },
  { groupId: "verfahrensangaben", fieldId: "zustaendigesAmtsgericht", templateVar: "zustaendigesAmtsgericht" },
  { groupId: "verfahrensangaben", fieldId: "antragsDatum",            templateVar: "antragsDatum"            },
];

/** Felder aus glaeubigeranlage6 (pro Instanz) → Template-Variablenname */
export const GLAEUBIGER_FIELD_MAPPING: Array<{
  fieldId: string;
  templateVar: string;
  format?: "currency" | "date" | "percent";
}> = [
  { fieldId: "nameOderFirma",               templateVar: "glaeubigerName"      },
  { fieldId: "forderungsgrund",             templateVar: "forderungsgrund"     },
  { fieldId: "hauptforderungEur",           templateVar: "hauptforderungEur",  format: "currency" },
  { fieldId: "zinsenEur",                   templateVar: "zinsenEur",          format: "currency" },
  { fieldId: "zinsenBis",                   templateVar: "zinsenBis",          format: "date"     },
  { fieldId: "kostenEur",                   templateVar: "kostenEur",          format: "currency" },
  { fieldId: "summeForderungEur",           templateVar: "summeForderungEur",  format: "currency" },
  { fieldId: "anteilGesamtverschuldungPct", templateVar: "anteilPct",          format: "percent"  },
];

/** Felder aus glaeubigerAdressenAnlage7 (pro Instanz, gleicher Index wie anlage6) */
export const GLAEUBIGER_ADRESSE_MAPPING: Array<{
  fieldId: string;
  templateVar: string;
}> = [
  { fieldId: "adresse",             templateVar: "glaeubigerAdresse"          },
  { fieldId: "geschaeftszeichen",   templateVar: "glaeubigerGeschaeftszeichen"},
  { fieldId: "bevName",             templateVar: "bevollmaechtigterName"       },
  { fieldId: "bevGeschaeftszeichen",templateVar: "bevGeschaeftszeichen"       },
];

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function fieldValue(field: CaseField | undefined): string {
  if (!field) return "";
  return field.correctedValue !== undefined ? (field.correctedValue ?? "") : (field.extractedValue ?? "");
}

function formatCurrency(raw: string): string {
  const n = parseFloat(raw.replace(",", "."));
  if (isNaN(n)) return raw || "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatDate(raw: string): string {
  if (!raw) return "—";
  // ISO date (YYYY-MM-DD) → DD.MM.YYYY
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return raw;
}

function formatPercent(raw: string): string {
  if (!raw) return "—";
  return `${raw} %`;
}

function applyFormat(raw: string, format?: "currency" | "date" | "percent"): string {
  if (format === "currency") return formatCurrency(raw);
  if (format === "date")     return formatDate(raw);
  if (format === "percent")  return formatPercent(raw);
  return raw || "—";
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * Extrahiert alle Template-Variablen für einen einzelnen Gläubiger-Brief.
 *
 * @param caseData  Das vollständige CaseFile-Objekt
 * @param instanceIndex  Index der Gläubiger-Instanz in glaeubigeranlage6 (0-basiert)
 * @returns Record<string, string> — bereit für docxtemplater
 */
export function extractLetterData(
  caseData: CaseFile,
  instanceIndex: number
): Record<string, string> {
  const data: Record<string, string> = {};

  // Statische Felder aus nicht-Array-Gruppen
  for (const mapping of STATIC_FIELD_MAPPING) {
    const group = caseData.fieldGroups.find((g) => g.groupId === mapping.groupId);
    const field = group?.fields?.find((f) => f.fieldId === mapping.fieldId);
    data[mapping.templateVar] = fieldValue(field);
  }

  // Forderungsfelder aus glaeubigeranlage6
  const glaeubigerGroup = caseData.fieldGroups.find((g) => g.groupId === "glaeubigeranlage6");
  const instance = glaeubigerGroup?.instances?.[instanceIndex] ?? [];
  for (const mapping of GLAEUBIGER_FIELD_MAPPING) {
    const field = instance.find((f) => f.fieldId === mapping.fieldId);
    data[mapping.templateVar] = applyFormat(fieldValue(field), mapping.format);
  }

  // Adress- und Bevollmächtigten-Felder aus glaeubigerAdressenAnlage7 (gleicher Index)
  const adressenGroup = caseData.fieldGroups.find((g) => g.groupId === "glaeubigerAdressenAnlage7");
  const adressenInstance = adressenGroup?.instances?.[instanceIndex] ?? [];
  for (const mapping of GLAEUBIGER_ADRESSE_MAPPING) {
    const field = adressenInstance.find((f) => f.fieldId === mapping.fieldId);
    data[mapping.templateVar] = fieldValue(field);
  }

  // Personalisierte Anrede: Bevollmächtigter wenn vorhanden, sonst allgemein
  const bev = data["bevollmaechtigterName"];
  data["anrede"] = bev ? `Sehr geehrte/r ${bev},` : "Sehr geehrte Damen und Herren,";

  // Zeichen-Zeile: Geschäftszeichen des Bevollmächtigten, sonst des Gläubigers
  data["ihrZeichen"] = data["bevGeschaeftszeichen"] || data["glaeubigerGeschaeftszeichen"] || "—";

  // Laufende Nummer (1-basiert)
  data["glaeubigerNummer"] = String(instanceIndex + 1);

  // Heutiges Datum
  data["datumHeute"] = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return data;
}
