import type { CaseFile, CaseField } from "@/lib/extraction/types";

export type BeteiligterRolle =
  | "Schuldner"
  | "Arbeitgeber"
  | "Gläubiger"
  | "Verfahrensbevollmächtigte(r)";

export interface BeteiligterDetail {
  label: string;
  value: string;
  /** Present when this detail maps directly to a single editable field */
  groupId?: string;
  fieldId?: string;
  instanceIndex?: number;
}

export interface Beteiligter {
  id: string;
  rolle: BeteiligterRolle;
  /** true wenn Forderungsgrund auf Miete/Wohnen hindeutet */
  isVermieter?: boolean;
  name: string;
  details: BeteiligterDetail[];
  /** Gesamtforderung in EUR — nur bei Gläubiger */
  forderungEur?: number;
}

const VERMIETER_REGEX = /miete|vermieter|wohnung|nebenkosten/i;

/** Gibt den effektiven Feldwert zurück (korrigiert > extrahiert). */
function fieldVal(fields: CaseField[], fieldId: string): string {
  const f = fields.find((x) => x.fieldId === fieldId);
  if (!f) return "";
  return (f.correctedValue ?? f.extractedValue ?? "").trim();
}

/** Baut eine editierbare Detail-Zeile (nur wenn Wert nicht leer). */
function det(
  label: string,
  value: string,
  groupId?: string,
  fieldId?: string,
  instanceIndex?: number
): BeteiligterDetail | null {
  if (!value) return null;
  return groupId && fieldId
    ? { label, value, groupId, fieldId, ...(instanceIndex !== undefined ? { instanceIndex } : {}) }
    : { label, value };
}

function compact<T>(arr: (T | null)[]): T[] {
  return arr.filter((x): x is T => x !== null);
}

export function extractBeteiligte(caseData: CaseFile): Beteiligter[] {
  const result: Beteiligter[] = [];

  const group = (id: string) => caseData.fieldGroups.find((g) => g.groupId === id);

  // ── Schuldner ──────────────────────────────────────────────────────────────
  const sp = group("schuldner_person");
  if (sp?.fields) {
    const f = sp.fields;
    const g = "schuldner_person";
    const nachname = fieldVal(f, "nachname");
    const vorname = fieldVal(f, "vorname");
    const name = [nachname, vorname].filter(Boolean).join(", ") || "Schuldner (unbekannt)";
    result.push({
      id: "schuldner",
      rolle: "Schuldner",
      name,
      details: compact([
        det("Nachname", nachname, g, "nachname"),
        det("Vorname", vorname, g, "vorname"),
        det("Straße/Nr.", fieldVal(f, "strasseHausnr"), g, "strasseHausnr"),
        det("PLZ/Ort", fieldVal(f, "plzOrt"), g, "plzOrt"),
        det("Geburtsdatum", fieldVal(f, "geburtsdatum"), g, "geburtsdatum"),
        det("Telefon", fieldVal(f, "telefon") || fieldVal(f, "mobil"), g, "telefon"),
        det("E-Mail", fieldVal(f, "email"), g, "email"),
      ]),
    });
  }

  // ── Arbeitgeber ────────────────────────────────────────────────────────────
  const ag5g = group("arbeitgeber_5g");
  const agBeschaeft = group("schuldner_beschaeftigung");

  let agName = "";
  let agDetails: BeteiligterDetail[] = [];

  if (ag5g?.fields) {
    const f = ag5g.fields;
    const g = "arbeitgeber_5g";
    agName = fieldVal(f, "nameOderFirma");
    if (agName) {
      agDetails = compact([
        det("Name/Firma", agName, g, "nameOderFirma"),
        det("Straße/Nr.", fieldVal(f, "strasseHausnr"), g, "strasseHausnr"),
        det("PLZ/Ort", fieldVal(f, "plzOrt"), g, "plzOrt"),
        det("Aufgabenbereich", fieldVal(f, "aufgabenbereich"), g, "aufgabenbereich"),
      ]);
    }
  }

  if (!agName && agBeschaeft?.fields) {
    const f = agBeschaeft.fields;
    const g = "schuldner_beschaeftigung";
    agName = fieldVal(f, "arbeitgeberName");
    if (agName) {
      agDetails = compact([
        det("Name", agName, g, "arbeitgeberName"),
        det("Adresse", fieldVal(f, "arbeitgeberAdresse"), g, "arbeitgeberAdresse"),
        det("Tätigkeit", fieldVal(f, "zuletztTaetigAls"), g, "zuletztTaetigAls"),
      ]);
    }
  }

  if (agName) {
    result.push({ id: "arbeitgeber", rolle: "Arbeitgeber", name: agName, details: agDetails });
  }

  // ── Gläubiger ──────────────────────────────────────────────────────────────
  const gl6 = group("glaeubigeranlage6");
  const gl7 = group("glaeubigerAdressenAnlage7");

  if (gl6?.isArray && gl6.instances) {
    gl6.instances.forEach((fields, i) => {
      const g6 = "glaeubigeranlage6";
      const g7 = "glaeubigerAdressenAnlage7";
      const name = fieldVal(fields, "nameOderFirma") || `Gläubiger ${i + 1}`;
      const forderungsgrund = fieldVal(fields, "forderungsgrund");
      const summeRaw = fieldVal(fields, "summeForderungEur") || fieldVal(fields, "hauptforderungEur");
      const forderungEur = summeRaw ? parseFloat(summeRaw.replace(",", ".")) : undefined;

      const adresse = gl7?.isArray && gl7.instances?.[i]
        ? fieldVal(gl7.instances[i], "adresse")
        : "";
      const bev = gl7?.isArray && gl7.instances?.[i]
        ? fieldVal(gl7.instances[i], "bevName")
        : "";

      result.push({
        id: `glaeubigeranlage6_${i}`,
        rolle: "Gläubiger",
        isVermieter: VERMIETER_REGEX.test(forderungsgrund),
        name,
        details: compact([
          det("Name/Firma", name, g6, "nameOderFirma", i),
          det("Forderungsgrund", forderungsgrund, g6, "forderungsgrund", i),
          det("Adresse", adresse, g7, "adresse", i),
          det("Bevollmächtigte(r)", bev, g7, "bevName", i),
        ]),
        forderungEur: Number.isFinite(forderungEur) ? forderungEur : undefined,
      });
    });
  }

  // ── Verfahrensbevollmächtigte(r) ───────────────────────────────────────────
  const vbg = group("verfahrensbevollmaechtigte");
  if (vbg?.fields) {
    const f = vbg.fields;
    const g = "verfahrensbevollmaechtigte";
    const nachname = fieldVal(f, "nachname");
    const vorname = fieldVal(f, "vorname");
    const name = [nachname, vorname].filter(Boolean).join(", ");
    if (name) {
      result.push({
        id: "verfahrensbevollmaechtigte",
        rolle: "Verfahrensbevollmächtigte(r)",
        name,
        details: compact([
          det("Nachname", nachname, g, "nachname"),
          det("Vorname", vorname, g, "vorname"),
          det("Beruf", fieldVal(f, "beruf"), g, "beruf"),
          det("Straße/Nr.", fieldVal(f, "strasseHausnr"), g, "strasseHausnr"),
          det("PLZ/Ort", fieldVal(f, "plzOrt"), g, "plzOrt"),
          det("E-Mail", fieldVal(f, "email"), g, "email"),
        ]),
      });
    }
  }

  return result;
}
