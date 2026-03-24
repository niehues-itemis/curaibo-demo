import type { CaseFile } from "@/lib/extraction/types";

/**
 * Wandelt ein Aktenzeichen in einen ordnersicheren Slug um.
 * Einzige Transformation: "/" → "-". Alle anderen Zeichen bleiben.
 * Beispiel: "45 IK 123/24" → "45 IK 123-24"
 */
export function sanitizeAktenzeichen(raw: string): string {
  return raw.replace(/\//g, "-").trim();
}

/**
 * Generiert ein automatisches Aktenzeichen falls keines im Formular vorhanden.
 * Format: "INS-2026-001"
 */
export function generateAktenzeichen(year: number, counter: number): string {
  return `INS-${year}-${String(counter).padStart(3, "0")}`;
}

/**
 * Extrahiert das Aktenzeichen aus den VInsO-Feldern.
 * Sucht in der Gruppe "verfahrensangaben" nach dem Feld "aktenzeichen".
 */
export function extractAktenzeichenFromCase(
  caseData: Omit<CaseFile, "caseId">
): string | null {
  const group = caseData.fieldGroups.find((g) => g.groupId === "verfahrensangaben");
  if (!group?.fields) return null;
  const field = group.fields.find((f) => f.fieldId === "aktenzeichen");
  if (!field) return null;
  const value = (field.correctedValue ?? field.extractedValue ?? "").trim();
  return value || null;
}

/**
 * Extrahiert den Schuldnernamen aus den VInsO-Feldern.
 * Format: "Nachname, Vorname"
 */
export function extractSchuldnerName(caseData: Omit<CaseFile, "caseId">): string {
  const group = caseData.fieldGroups.find((g) => g.groupId === "schuldner_person");
  if (!group?.fields) return "";
  const getVal = (fieldId: string) => {
    const f = group.fields!.find((f) => f.fieldId === fieldId);
    return (f?.correctedValue ?? f?.extractedValue ?? "").trim();
  };
  const nachname = getVal("nachname");
  const vorname = getVal("vorname");
  if (nachname && vorname) return `${nachname}, ${vorname}`;
  return nachname || vorname || "";
}

/**
 * Leitet die Verfahrensart aus RSB-Feldern ab.
 */
// Derzeit immer Verbraucherinsolvenz; wird später für andere Verfahrensarten erweitert.
export function extractVerfahrensart(_caseData: Omit<CaseFile, "caseId">): string {
  return "Verbraucherinsolvenz";
}
