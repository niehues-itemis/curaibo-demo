import { z } from "zod";

/**
 * Flaches Schema — ein Array aus Feld-Extraktionen.
 * Vermeidet tiefe Verschachtelung und bleibt unter Claudes Schema-Limits.
 * fieldId-Konvention:
 *   - Normale Felder:   "{gruppeId}__{feldId}"          z.B. "schuldner_person__nachname"
 *   - Gläubiger-Felder: "glaeubigeranlage6__{idx}__{feldId}"  z.B. "glaeubigeranlage6__0__nameOderFirma"
 */
export const VInsOExtractionSchema = z.object({
  fields: z.array(
    z.object({
      fieldId: z.string().describe("Eindeutige Feld-ID z.B. schuldner_person__nachname"),
      value: z.string().describe("Extrahierter Wert. Leerer String wenn nicht ausgefuellt. Fuer Checkboxen: true oder false als String."),
      confidence: z.number().describe("Konfidenz 0.0 bis 1.0"),
      confidenceReason: z.string().describe("Begruendung bei confidence unter 0.85, sonst leerer String"),
    })
  ).describe("Alle extrahierten Felder als flache Liste"),
  glaeubigerAnzahl: z.number().describe("Anzahl der Glaeubiger in Anlage 6, 0 wenn keine"),
});

export type VInsOExtraction = z.infer<typeof VInsOExtractionSchema>;
