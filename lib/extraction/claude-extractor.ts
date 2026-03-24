import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { z } from "zod";
import { VINSO_FIELD_GROUPS } from "./vinso-field-groups";
import {
  extractFromAcroForm,
  extractFromTextPatterns,
  extractGlaeubigerFromText,
  extractGlaeubigerFromAcroForm,
  type AcroField,
  type StaticExtractionResult,
} from "./static-extractor";
import type { CaseFile, CaseField, CaseFieldGroup } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Schwellenwerte
// ─────────────────────────────────────────────────────────────────────────────

/** Felder mit Konfidenz ≥ diesem Wert werden NICHT an Claude geschickt */
const STATIC_CONFIDENCE_THRESHOLD = 0.85;

/** Felder mit Konfidenz ≥ diesem Wert werden automatisch als confirmed markiert */
const AUTO_CONFIRM_THRESHOLD = 0.85;

// ─────────────────────────────────────────────────────────────────────────────
// Claude-Prompt (nur für Restfelder)
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(remainingFieldIds: string[]): string {
  const fieldList = remainingFieldIds.join(", ");
  return `Du bist ein Experte fuer deutsches Insolvenzrecht und analysierst amtliche Verbraucherinsolvenz-Formulare (VInsO 2020).

Deine Aufgabe: Extrahiere NUR die folgenden Felder aus dem Formulartext:
${fieldList}

REGELN:
- value: extrahierter Wert als String, leerer String wenn Feld leer
- Fuer Checkboxen (true/false): value = "true" oder "false"
- Fuer Radio-Felder mit Textwert (z.B. Familienstand, Beschaeftigungsart): value = den angekreuzten Text (z.B. "ledig", "Angestellte(r)")
- confidence: 0.0 (unsicher) bis 1.0 (sicher)
- confidenceReason: Begruendung bei confidence < 0.85, sonst ""
- Extrahiere NUR was im Formular steht. Keine Interpretation oder Ergaenzung.

Glaeubigerfelder (Anlage 6 + Anlage 7 §69) - Schema: glaeubigeranlage6__INDEX__FELDNAME (INDEX = 0, 1, 2 ...):
Anlage 6 Felder (Forderungsverzeichnis):
- nameOderFirma: Name/Kurzbezeichnung des Glaeubiger (nur den Namen, keine Betraege)
- forderungsgrund: Art der Forderung (z.B. "Kreditvertrag", "Mietrueckstand")
- hauptforderungEur: Hauptforderung in EUR als Dezimalzahl ohne Waehrungssymbol (z.B. "18500.00")
- zinsenEur: Zinsen in EUR als Dezimalzahl
- zinsenBis: Datum bis zu dem Zinsen berechnet wurden
- kostenEur: Kosten in EUR als Dezimalzahl
- summeForderungEur: Summe aller Forderungen des Glaeubiger in EUR (= Hauptforderung + Zinsen + Kosten)
- anteilGesamtverschuldungPct: Anteil an der Gesamtverschuldung in Prozent als Dezimalzahl (z.B. "12.5")
Anlage 7 §69 Felder (Adressen + Bevollmaechtigte):
- adresse: Vollstaendige Anschrift des Glaeubiger (Strasse Hausnr., PLZ Ort) – aus Anlage 7
- geschaeftszeichen: Geschaeftszeichen/Aktenzeichen des Glaeubiger
- gesetzlVertreten: Gesetzlich vertreten durch (z.B. Vorstand, Geschaeftsfuehrer)
- bevName: Name des Verfahrensbevollmaechtigten (Rechtsanwalt etc.)
- bevStrasseHausnr: Strasse und Hausnummer des Bevollmaechtigten
- bevPlzOrt: PLZ und Ort des Bevollmaechtigten
- bevGeschaeftszeichen: Geschaeftszeichen des Bevollmaechtigten
glaeubigerAnzahl = Gesamtanzahl aller Glaeubigerzeilen in der Tabelle (Anlage 6)`;
}

// Flaches Schema für Claude-Fallback (identisch zu vorher)
const ClaudeFallbackSchema = z.object({
  fields: z.array(
    z.object({
      fieldId: z.string(),
      value: z.string(),
      confidence: z.number(),
      confidenceReason: z.string(),
    })
  ),
  glaeubigerAnzahl: z.number(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function makeField(
  fc: { fieldId: string; label: string; fieldType: string },
  raw: { value: string; confidence: number; confidenceReason?: string }
): CaseField {
  return {
    fieldId: fc.fieldId,
    label: fc.label,
    fieldType: fc.fieldType as CaseField["fieldType"],
    extractedValue: raw.value,
    confidence: raw.confidence,
    confidenceReason: raw.confidenceReason ?? "",
    // Leere Felder gelten als geprüft (kein Wert im Formular = valider Zustand)
    status:
      raw.value === "" || raw.confidence >= AUTO_CONFIRM_THRESHOLD
        ? "extracted_confirmed"
        : "extracted_unreviewed",
  };
}

const FALLBACK: StaticExtractionResult = { value: "", confidence: 0.1, method: "none" };

// ─────────────────────────────────────────────────────────────────────────────
// Normalisierung
// ─────────────────────────────────────────────────────────────────────────────

function normalizeExtraction(
  staticMap: Map<string, StaticExtractionResult>,
  claudeFields: Map<string, { value: string; confidence: number; confidenceReason: string }>,
  glaeubigerAnzahl: number,
  filename: string,
  processingTimeMs: number
): Omit<CaseFile, "caseId"> {
  const fieldGroups: CaseFieldGroup[] = [];

  for (const groupConfig of VINSO_FIELD_GROUPS) {
    const { groupId, label, anlageName, sectionLabel, isArray, fields: fieldConfigs, displayMode } = groupConfig;
    const keyPrefix = groupConfig.keyPrefix ?? groupId;

    if (isArray) {
      // Gläubiger-Array: erst statisch, dann Claude-Fallback
      const count = Math.max(glaeubigerAnzahl, 0);
      const instances: CaseField[][] = [];

      for (let idx = 0; idx < count; idx++) {
        const instance: CaseField[] = (fieldConfigs ?? []).map((fc) => {
          const staticKey = `${keyPrefix}__${idx}__${fc.fieldId}`;
          const staticResult = staticMap.get(staticKey);
          const claudeResult = claudeFields.get(staticKey);

          // Priorisierung: AcroForm > Text-Pattern (wenn Konfidenz gut) > Claude
          if (staticResult && staticResult.confidence >= STATIC_CONFIDENCE_THRESHOLD) {
            return makeField(fc, { ...staticResult, confidenceReason: "" });
          }
          if (claudeResult) {
            return makeField(fc, claudeResult);
          }
          if (staticResult && staticResult.value) {
            return makeField(fc, { ...staticResult, confidenceReason: "Aus Textmuster extrahiert" });
          }
          return makeField(fc, { ...FALLBACK, confidenceReason: "Nicht gefunden" });
        });
        instances.push(instance);
      }

      fieldGroups.push({ groupId, label, anlageName, sectionLabel, isArray: true, instances, displayMode });
    } else {
      const fieldList: CaseField[] = (fieldConfigs ?? []).map((fc) => {
        const staticKey = `${groupId}__${fc.fieldId}`;
        const staticResult = staticMap.get(staticKey);
        const claudeResult = claudeFields.get(staticKey);

        if (staticResult && staticResult.confidence >= STATIC_CONFIDENCE_THRESHOLD) {
          return makeField(fc, { ...staticResult, confidenceReason: "" });
        }
        if (claudeResult) {
          return makeField(fc, claudeResult);
        }
        if (staticResult && staticResult.value) {
          return makeField(fc, { ...staticResult, confidenceReason: "Aus Textmuster extrahiert" });
        }
        return makeField(fc, { ...FALLBACK, confidenceReason: "Nicht gefunden" });
      });

      fieldGroups.push({ groupId, label, anlageName, sectionLabel, fields: fieldList, displayMode });
    }
  }

  const allFields = fieldGroups.flatMap((g) =>
    g.isArray && g.instances ? g.instances.flat() : g.fields ?? []
  );
  const caseStatus = allFields.every((f) => f.status !== "extracted_unreviewed")
    ? "review_complete"
    : "review_in_progress";

  return { filename, uploadedAt: new Date().toISOString(), status: caseStatus, processingTimeMs, fieldGroups };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text-Kürzung (Anlage 6 immer vollständig einschließen)
// ─────────────────────────────────────────────────────────────────────────────

function buildTruncatedText(text: string, maxChars = 15000): string {
  if (text.length <= maxChars) return text;

  // Anlage 6 + Anlage 7 §69 (Gläubigeradressen + Bevollmächtigte) separat sichern
  const anlage6Idx = text.search(/Anlage\s+6|Gl[äa]ubiger(?:verzeichnis|liste)/i);
  const glaeubigerText = anlage6Idx !== -1 ? "\n\n" + text.slice(anlage6Idx) : "";

  // Haupttext kürzen, Platz für Gläubiger-Abschnitte lassen
  const mainBudget = maxChars - glaeubigerText.length;
  const mainText =
    mainBudget > 0
      ? text.slice(0, mainBudget) + "\n[... Text gekürzt]"
      : text.slice(0, maxChars);

  return glaeubigerText ? mainText + glaeubigerText : mainText;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────────────────────────────────────

export async function extractVInsOFromText(
  pdfText: string,
  acroFields: AcroField[],
  filename: string,
  processingStartMs: number
): Promise<Omit<CaseFile, "caseId">> {

  // ── Stufe 1: Statische Extraktion ─────────────────────────────────────────

  // 1a: AcroForm (reguläre Felder + Gläubiger Anlage 6)
  const acroMap = extractFromAcroForm(acroFields);
  const { count: acroGlaeubigerCount, results: acroGlaeubigerMap } = extractGlaeubigerFromAcroForm(acroFields);

  const confirmedByAcro = new Set(
    [...acroMap.entries(), ...acroGlaeubigerMap.entries()]
      .filter(([, r]) => r.confidence >= STATIC_CONFIDENCE_THRESHOLD)
      .map(([id]) => id)
  );

  // 1b: Text-Muster (Fallback für nicht-AcroForm Felder)
  const textMap = extractFromTextPatterns(pdfText, confirmedByAcro);

  // 1c: Text-Gläubiger (Fallback für nicht-AcroForm PDFs)
  const staticGlaeubiger = extractGlaeubigerFromText(pdfText);

  // Statische Gesamtmap: text < acro < acroGläubiger
  const staticMap = new Map<string, StaticExtractionResult>([
    ...textMap,
    ...acroMap,
    ...acroGlaeubigerMap,
  ]);

  // Text-Gläubiger in staticMap eintragen (nur wo noch kein AcroForm-Treffer)
  for (let idx = 0; idx < staticGlaeubiger.length; idx++) {
    const g = staticGlaeubiger[idx];
    const prefix = `glaeubigeranlage6__${idx}__`;
    const fields: Record<string, string> = {
      nameOderFirma: g.nameOderFirma,
      adresse: g.adresse,
      hauptforderungEur: g.hauptforderungEur,
      forderungsgrund: g.forderungsgrund,
      summeForderungEur: g.summeForderungEur,
    };
    for (const [fieldId, value] of Object.entries(fields)) {
      if (value && !staticMap.has(`${prefix}${fieldId}`)) {
        staticMap.set(`${prefix}${fieldId}`, { value, confidence: 0.80, method: "text" });
      }
    }
  }

  // ── Stufe 2: Feststellen welche Felder noch an Claude gehen ───────────────
  const allFieldIds: string[] = [];
  let maxGlaeubigerIdx = Math.max(acroGlaeubigerCount, staticGlaeubiger.length);

  for (const group of VINSO_FIELD_GROUPS) {
    const kp = group.keyPrefix ?? group.groupId;
    if (group.isArray) {
      // Gläubiger: statische Anzahl als Untergrenze, Claude kann mehr finden
      for (let idx = 0; idx < Math.max(maxGlaeubigerIdx, 1); idx++) {
        for (const fc of group.fields) {
          allFieldIds.push(`${kp}__${idx}__${fc.fieldId}`);
        }
      }
    } else {
      for (const fc of group.fields) {
        allFieldIds.push(`${kp}__${fc.fieldId}`);
      }
    }
  }

  // Nur Felder an Claude, die statisch nicht gut gefunden wurden
  const needsClaude = allFieldIds.filter((id) => {
    const r = staticMap.get(id);
    return !r || r.confidence < STATIC_CONFIDENCE_THRESHOLD;
  });

  // Gläubiger-Claude immer wenn kein AcroForm vorhanden (gedrucktes PDF).
  // Der statische Text-Extraktor findet oft nur einen Teil der Gläubiger (z.B. per
  // Firmennamen-Muster), sodass die Bedingung staticGlaeubiger.length === 0 zu restriktiv ist.
  const needsGlaeubigerClaude = acroGlaeubigerCount === 0;

  console.log(
    `[Extraktor] Statisch abgedeckt: ${allFieldIds.length - needsClaude.length}/${allFieldIds.length} Felder.`,
    needsClaude.length > 0 ? `Claude erhält ${needsClaude.length} Restfelder.` : "Kein Claude-Aufruf nötig."
  );

  // ── Stufe 3: Claude-Fallback für Restfelder ───────────────────────────────
  const claudeFields = new Map<string, { value: string; confidence: number; confidenceReason: string }>();
  // AcroForm-Zählung hat Vorrang (confidence 1.0), Text-Fallback als Minimum
  let glaeubigerAnzahl = Math.max(acroGlaeubigerCount, staticGlaeubiger.length);

  if (needsClaude.length > 0 || needsGlaeubigerClaude) {
    // Gläubiger-Feldnamen aus Anlage 6 + Anlage 7 §69 zusammenführen (selber keyPrefix)
    const glaeubigerGroups = VINSO_FIELD_GROUPS.filter(
      (g) => g.groupId === "glaeubigeranlage6" || (g.keyPrefix === "glaeubigeranlage6" && g.isArray)
    );
    const glaeubigerFieldIds = new Set<string>();
    for (const g of glaeubigerGroups) {
      for (const f of g.fields) {
        glaeubigerFieldIds.add(f.fieldId);
      }
    }
    const glaeubigerIndexFields = [...glaeubigerFieldIds].map(
      (fieldId) => `glaeubigeranlage6__INDEX__${fieldId}`
    );

    // Prompt nur mit den offenen Feldern aufbauen (= weniger Tokens)
    const remainingFieldIds = [
      ...new Set([
        ...needsClaude.filter((id) => !id.startsWith("glaeubigeranlage6__")),
        ...(needsGlaeubigerClaude ? glaeubigerIndexFields : []),
      ]),
    ];

    // Text intelligent kürzen: Anlage 6 immer vollständig einschließen
    const truncatedText = buildTruncatedText(pdfText);

    const { object } = await generateObject({
      model: await getModel("primary"),
      schema: ClaudeFallbackSchema,
      system: buildSystemPrompt(remainingFieldIds),
      prompt: `Analysiere dieses VInsO-Formular und extrahiere die fehlenden Felder:\n\n${truncatedText}`,
    });

    for (const f of object.fields) {
      claudeFields.set(f.fieldId, {
        value: f.value,
        confidence: f.confidence,
        confidenceReason: f.confidenceReason,
      });
    }

    if (needsGlaeubigerClaude && object.glaeubigerAnzahl > glaeubigerAnzahl) {
      glaeubigerAnzahl = object.glaeubigerAnzahl;
      // Claude-Gläubiger in staticMap ergänzen (für Felder ohne statischen Treffer)
      for (const f of object.fields) {
        if (f.fieldId.startsWith("glaeubigeranlage6__") && !staticMap.has(f.fieldId)) {
          claudeFields.set(f.fieldId, { value: f.value, confidence: f.confidence, confidenceReason: f.confidenceReason });
        }
      }
    }
  }

  const processingTimeMs = Date.now() - processingStartMs;
  return normalizeExtraction(staticMap, claudeFields, glaeubigerAnzahl, filename, processingTimeMs);
}
