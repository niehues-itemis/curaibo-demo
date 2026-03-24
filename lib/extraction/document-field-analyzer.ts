import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { CaseFile, FieldProposal } from "@/lib/extraction/types";

const ProposalSchema = z.object({
  proposals: z.array(z.object({
    groupId: z.string(),
    fieldId: z.string(),
    instanceIndex: z.number().optional(),
    fieldLabel: z.string(),
    proposedValue: z.string(),
    reason: z.string().describe("Kurze Begründung, welche Textstelle im Dokument diesen Wert belegt"),
    confidence: z.number().min(0).max(1),
  })).describe("Nur Felder mit echten neuen Informationen (confidence > 0.5). Leere Liste wenn nichts Neues gefunden."),
});

/** Builds a flat summary of current field values for the AI prompt */
function buildFieldSummary(caseData: CaseFile): string {
  const lines: string[] = [];
  for (const group of caseData.fieldGroups) {
    if (group.isArray && group.instances) {
      group.instances.forEach((fields, i) => {
        for (const f of fields) {
          const val = f.correctedValue ?? f.extractedValue;
          if (val) lines.push(`${group.groupId}[${i}].${f.fieldId} (${f.label}): "${val}"`);
        }
      });
    } else if (group.fields) {
      for (const f of group.fields) {
        const val = f.correctedValue ?? f.extractedValue;
        if (val) lines.push(`${group.groupId}.${f.fieldId} (${f.label}): "${val}"`);
      }
    }
  }
  return lines.join("\n") || "(Keine Felder befüllt)";
}

export async function analyzeDocumentForFieldUpdates(
  caseData: CaseFile,
  documentMarkdown: string,
  sourceFolder: "eingehend" | "ausgehend",
  sourceFilename: string
): Promise<FieldProposal[]> {
  const fieldSummary = buildFieldSummary(caseData);
  const docExcerpt = documentMarkdown.slice(0, 4000);

  try {
    const { object } = await generateObject({
      model: await getModel("fast"),
      schema: ProposalSchema,
      prompt: `Du analysierst ein neues Dokument, das einer Insolvenzakte zugeordnet wurde.

AKTUELLE FELDWERTE DER AKTE:
${fieldSummary}

NEUES DOKUMENT ("${sourceFilename}"):
${docExcerpt}

AUFGABE: Identifiziere Felder, bei denen das Dokument:
1. Einen korrigierten/aktuelleren Wert liefert (z.B. geändertes Geburtsdatum, neue Adresse)
2. Einen bisher leeren Wert befüllen kann
3. Einen Gläubiger-Betrag präzisiert

WICHTIG:
- Nur Felder melden, die tatsächlich im Dokument belegt sind (confidence > 0.5)
- groupId und fieldId EXAKT aus der Feldliste übernehmen (z.B. "schuldner_person", "nachname")
- Bei Array-Gruppen (glaeubigeranlage6 etc.) instanceIndex angeben
- Keine Felder vorschlagen, die bereits den korrekten Wert haben
- Wenn nichts Relevantes gefunden: leere proposals-Liste zurückgeben`,
    });

    return object.proposals.map((p) => ({
      id: uuidv4(),
      sourceDocument: { folder: sourceFolder, filename: sourceFilename },
      groupId: p.groupId,
      fieldId: p.fieldId,
      instanceIndex: p.instanceIndex,
      fieldLabel: p.fieldLabel,
      currentValue: getCurrentValue(caseData, p.groupId, p.fieldId, p.instanceIndex),
      proposedValue: p.proposedValue,
      reason: p.reason,
      confidence: p.confidence,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[document-field-analyzer] Fehler:", err);
    return [];
  }
}

function getCurrentValue(
  caseData: CaseFile,
  groupId: string,
  fieldId: string,
  instanceIndex?: number
): string {
  const group = caseData.fieldGroups.find((g) => g.groupId === groupId);
  if (!group) return "";
  if (group.isArray && group.instances && instanceIndex !== undefined) {
    const f = group.instances[instanceIndex]?.find((f) => f.fieldId === fieldId);
    return f ? (f.correctedValue ?? f.extractedValue ?? "") : "";
  }
  const f = group.fields?.find((f) => f.fieldId === fieldId);
  return f ? (f.correctedValue ?? f.extractedValue ?? "") : "";
}
