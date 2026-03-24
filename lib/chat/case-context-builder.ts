import type { CaseFile } from "@/lib/extraction/types";

/** Erstellt einen lesbaren Kontext-String für eine einzelne Akte (Detail-Level). */
export function buildSingleCaseContext(caseData: CaseFile): string {
  const lines: string[] = [];
  lines.push(`## Aktuelle Akte: ${caseData.aktenzeichenDisplay ?? caseData.aktenzeichen ?? caseData.caseId}`);

  // Hilfsfunktion: Feldwert aus einer Gruppe lesen
  const getField = (groupId: string, fieldId: string): string => {
    const group = caseData.fieldGroups.find((g) => g.groupId === groupId);
    if (!group?.fields) return "";
    const f = group.fields.find((f) => f.fieldId === fieldId);
    return (f?.correctedValue ?? f?.extractedValue ?? "").trim();
  };

  // Schuldner
  const nachname = getField("schuldner_person", "nachname");
  const vorname = getField("schuldner_person", "vorname");
  const geburtsdatum = getField("schuldner_person", "geburtsdatum");
  const adresse = [getField("schuldner_person", "strasseHausnr"), getField("schuldner_person", "plzOrt")].filter(Boolean).join(", ");
  if (nachname || vorname) lines.push(`Schuldner: ${[nachname, vorname].filter(Boolean).join(", ")}${geburtsdatum ? ` (geb. ${geburtsdatum})` : ""}`);
  if (adresse) lines.push(`Adresse: ${adresse}`);

  // Verfahren
  const gericht = getField("verfahrensangaben", "zustaendigesAmtsgericht");
  const antragsDatum = getField("verfahrensangaben", "antragsDatum");
  const az = getField("verfahrensangaben", "aktenzeichen");
  if (gericht) lines.push(`Gericht: ${gericht}`);
  if (az) lines.push(`Aktenzeichen: ${az}`);
  if (antragsDatum) lines.push(`Antragsdatum: ${antragsDatum}`);

  // RSB
  const rsbBeantragt = getField("rsb", "rsbBeantragt");
  if (rsbBeantragt) lines.push(`RSB beantragt: ${rsbBeantragt}`);

  // Gläubiger
  const glaeubigerGroup = caseData.fieldGroups.find((g) => g.groupId === "glaeubigeranlage6");
  if (glaeubigerGroup?.isArray && glaeubigerGroup.instances) {
    lines.push(`Gläubiger: ${glaeubigerGroup.instances.length} eingetragen`);
    glaeubigerGroup.instances.slice(0, 5).forEach((inst, i) => {
      const name = inst.find((f) => f.fieldId.includes("name") || f.fieldId.includes("glaeubiger"))?.extractedValue ?? "";
      const forderung = inst.find((f) => f.fieldId.includes("forderung") || f.fieldId.includes("betrag"))?.extractedValue ?? "";
      if (name) lines.push(`  ${i + 1}. ${name}${forderung ? ` — ${forderung} EUR` : ""}`);
    });
  }

  // Bearbeitungsstatus
  lines.push(`Bearbeitungsstatus: ${statusToLabel(caseData.status)}`);
  lines.push(`Verfahrensart: ${caseData.verfahrensart ?? "Verbraucherinsolvenz"}`);

  return lines.join("\n");
}

/** Erstellt einen zusammenfassenden Kontext für alle Akten. */
export function buildAllCasesContext(cases: CaseFile[]): string {
  if (cases.length === 0) return "Aktuell sind keine Akten im System gespeichert.";

  const lines: string[] = [];
  lines.push(`## Alle Akten im System (${cases.length} gesamt)\n`);

  // Aktive Fälle zuerst, vollständig
  const active = cases.filter((c) => c.status !== "review_complete");
  const done = cases.filter((c) => c.status === "review_complete");

  if (active.length > 0) {
    lines.push("### In Bearbeitung / Laufend");
    for (const c of active) {
      lines.push(buildCaseSummaryLine(c));
    }
    lines.push("");
  }

  if (done.length > 0) {
    lines.push("### Abgeschlossene Akten");
    for (const c of done) {
      lines.push(buildCaseSummaryLine(c));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildCaseSummaryLine(c: CaseFile): string {
  const az = c.aktenzeichenDisplay ?? c.aktenzeichen ?? c.caseId;
  const name = c.schuldnerName ?? "—";
  const status = statusToLabel(c.status);
  const verfahren = c.verfahrensart ?? "Verbraucherinsolvenz";

  // Gläubigeranzahl
  const glaeubigerGroup = c.fieldGroups.find((g) => g.groupId === "glaeubigeranlage6");
  const glaeubigerCount = glaeubigerGroup?.isArray ? (glaeubigerGroup.instances?.length ?? 0) : 0;

  const parts = [`**${az}** | ${name} | ${verfahren} | ${status}`];
  if (glaeubigerCount > 0) parts.push(`(${glaeubigerCount} Gläubiger)`);
  return "- " + parts.join(" ");
}

function statusToLabel(status: CaseFile["status"]): string {
  switch (status) {
    case "extracting": return "Wird extrahiert";
    case "review_in_progress": return "In Bearbeitung";
    case "review_complete": return "Abgeschlossen";
    default: return status;
  }
}
