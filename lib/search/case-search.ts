import type { CaseFile, CaseField, CaseFieldGroup } from "@/lib/extraction/types";
import type { AkteListItem } from "@/lib/extraction/types";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface SearchTreffer {
  /** Beteiligungs-Rolle, z.B. "Gläubiger", "Schuldner", "Arbeitgeber" */
  rolle: string;
  /** Primärer Anzeigename, z.B. "Sparkasse Köln" */
  anzeigeName: string;
  /** Zusatzinformationen, z.B. "Forderung: 12.500 EUR | Forderungsgrund: Kredit" */
  details: string[];
  /** Welches Feld hat gematcht, z.B. "Name/Firma" */
  matchedFeld: string;
  /** Der gematchte Feldwert */
  matchedWert: string;
}

export interface CaseSearchResult extends AkteListItem {
  treffer: SearchTreffer[];
}

// ─── Rollen-Konfiguration pro Gruppe ─────────────────────────────────────────

/** Definiert wie eine Feldgruppe in den Suchergebnissen dargestellt wird */
interface GruppenConfig {
  rolle: string;
  /** Feldid des primären Anzeigenamens */
  nameFeldId?: string;
  /** Feldids die als Zusatzdetails angezeigt werden */
  detailFeldIds?: string[];
  /** Nur diese Felder in der Suche berücksichtigen (undefined = alle) */
  suchFeldIds?: string[];
}

const GRUPPEN_CONFIG: Record<string, GruppenConfig> = {
  schuldner_person: {
    rolle: "Schuldner",
    nameFeldId: undefined, // wird aus nachname+vorname zusammengesetzt
    suchFeldIds: ["nachname", "vorname", "geburtsname", "fruehererName", "strasseHausnr", "plzOrt", "email"],
    detailFeldIds: ["geburtsdatum", "strasseHausnr", "plzOrt"],
  },
  schuldner_beschaeftigung: {
    rolle: "Arbeitgeber (Schuldner)",
    nameFeldId: "arbeitgeberName",
    suchFeldIds: ["arbeitgeberName", "arbeitgeberAdresse", "ehemSelbstaendigAls", "zuletztTaetigAls"],
    detailFeldIds: ["arbeitgeberAdresse", "zuletztTaetigAls"],
  },
  verfahrensbevollmaechtigte: {
    rolle: "Verfahrensbevollmächtigte(r)",
    nameFeldId: "nachname",
    suchFeldIds: ["nachname", "vorname", "beruf", "strasseHausnr", "plzOrt", "email"],
    detailFeldIds: ["beruf", "plzOrt"],
  },
  arbeitgeber_5g: {
    rolle: "Arbeitgeber (Anlage 5G)",
    nameFeldId: "nameOderFirma",
    suchFeldIds: ["nameOderFirma", "strasseHausnr", "plzOrt"],
    detailFeldIds: ["plzOrt"],
  },
  verfahrensangaben: {
    rolle: "Gericht",
    nameFeldId: "zustaendigesAmtsgericht",
    suchFeldIds: ["zustaendigesAmtsgericht", "aktenzeichen"],
    detailFeldIds: ["aktenzeichen"],
  },
  glaeubigeranlage6: {
    rolle: "Gläubiger",
    nameFeldId: "nameOderFirma",
    suchFeldIds: ["nameOderFirma", "forderungsgrund"],
    detailFeldIds: ["forderungsgrund", "hauptforderungEur", "summeForderungEur"],
  },
  glaeubigerAdressenAnlage7: {
    rolle: "Gläubiger",
    nameFeldId: "nameOderFirma",
    suchFeldIds: ["nameOderFirma", "adresse", "bevName", "gesetzlVertreten"],
    detailFeldIds: ["adresse", "bevName"],
  },
};

// ─── Such-Logik ───────────────────────────────────────────────────────────────

function getFieldValue(field: CaseField): string {
  return (field.correctedValue ?? field.extractedValue ?? "").trim();
}

function getFieldMap(fields: CaseField[]): Map<string, CaseField> {
  return new Map(fields.map((f) => [f.fieldId, f]));
}

/** Gibt den primären Anzeigenamen einer Instanz zurück */
function buildAnzeigeName(
  config: GruppenConfig,
  fieldMap: Map<string, CaseField>,
  groupId: string
): string {
  if (groupId === "schuldner_person") {
    const nachname = getFieldValue(fieldMap.get("nachname") ?? { fieldId: "", label: "", fieldType: "text", extractedValue: "", confidence: 0, confidenceReason: "", status: "extracted_unreviewed" });
    const vorname = getFieldValue(fieldMap.get("vorname") ?? { fieldId: "", label: "", fieldType: "text", extractedValue: "", confidence: 0, confidenceReason: "", status: "extracted_unreviewed" });
    return [nachname, vorname].filter(Boolean).join(", ");
  }

  if (config.nameFeldId) {
    const field = fieldMap.get(config.nameFeldId);
    return field ? getFieldValue(field) : "";
  }

  return "";
}

/** Erstellt Detail-Strings für eine Instanz */
function buildDetails(
  config: GruppenConfig,
  fieldMap: Map<string, CaseField>
): string[] {
  const details: string[] = [];
  for (const fieldId of config.detailFeldIds ?? []) {
    const field = fieldMap.get(fieldId);
    if (!field) continue;
    const value = getFieldValue(field);
    if (!value || value === "false" || value === "0") continue;
    // Formatierung für Beträge
    if (field.fieldType === "number" && value && !isNaN(Number(value))) {
      details.push(`${field.label}: ${Number(value).toLocaleString("de-DE")} EUR`);
    } else {
      details.push(`${field.label}: ${value}`);
    }
  }
  return details;
}

/** Sucht in einer Feldinstanz (flat oder Array-Instanz) */
function searchInFields(
  query: string,
  fields: CaseField[],
  config: GruppenConfig,
  groupId: string
): SearchTreffer | null {
  const q = query.toLowerCase();
  const fieldMap = getFieldMap(fields);

  // Nur in konfigurierten Feldern suchen (oder alle wenn nicht konfiguriert)
  const searchFields = config.suchFeldIds
    ? fields.filter((f) => config.suchFeldIds!.includes(f.fieldId))
    : fields;

  let matchedFeld = "";
  let matchedWert = "";

  for (const field of searchFields) {
    const value = getFieldValue(field);
    if (!value) continue;
    if (value.toLowerCase().includes(q)) {
      matchedFeld = field.label;
      matchedWert = value;
      break;
    }
  }

  if (!matchedWert) return null;

  const anzeigeName = buildAnzeigeName(config, fieldMap, groupId);
  const details = buildDetails(config, fieldMap);

  return {
    rolle: config.rolle,
    anzeigeName: anzeigeName || matchedWert,
    details,
    matchedFeld,
    matchedWert,
  };
}

/** Sucht in einer Feldgruppe (flat oder Array) */
function searchInGroup(
  query: string,
  group: CaseFieldGroup
): SearchTreffer[] {
  const config = GRUPPEN_CONFIG[group.groupId];
  if (!config) return [];

  const treffer: SearchTreffer[] = [];

  if (group.isArray && group.instances) {
    for (const instance of group.instances) {
      const hit = searchInFields(query, instance, config, group.groupId);
      if (hit) treffer.push(hit);
    }
  } else if (group.fields) {
    const hit = searchInFields(query, group.fields, config, group.groupId);
    if (hit) treffer.push(hit);
  }

  return treffer;
}

/** Dedupliziert Treffer: gleiche Rolle + gleicher Anzeigename = ein Eintrag */
function deduplicate(treffer: SearchTreffer[]): SearchTreffer[] {
  const seen = new Set<string>();
  return treffer.filter((t) => {
    const key = `${t.rolle}::${t.anzeigeName.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Sucht in einem einzelnen Fall */
export function searchInCase(query: string, caseData: CaseFile): SearchTreffer[] {
  if (!query.trim()) return [];

  const allTreffer: SearchTreffer[] = [];
  for (const group of caseData.fieldGroups) {
    const groupTreffer = searchInGroup(query, group);
    allTreffer.push(...groupTreffer);
  }

  return deduplicate(allTreffer);
}

/** Sucht über alle Fälle */
export function searchAllCases(
  query: string,
  cases: CaseFile[]
): CaseSearchResult[] {
  if (!query.trim()) return [];

  const results: CaseSearchResult[] = [];

  for (const caseData of cases) {
    const treffer = searchInCase(query, caseData);
    if (treffer.length > 0) {
      results.push({
        caseId: caseData.caseId,
        filename: caseData.filename,
        uploadedAt: caseData.uploadedAt,
        status: caseData.status,
        aktenzeichen: caseData.aktenzeichen,
        aktenzeichenDisplay: caseData.aktenzeichenDisplay,
        schuldnerName: caseData.schuldnerName,
        verfahrensart: caseData.verfahrensart,
        treffer,
      });
    }
  }

  return results;
}
