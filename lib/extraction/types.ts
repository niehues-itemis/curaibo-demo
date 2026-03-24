import type { TagRef } from "@/lib/tags";

export type FieldStatus =
  | "extracted_unreviewed"
  | "extracted_confirmed"
  | "manually_corrected";

export type CaseStatus =
  | "extracting"
  | "review_in_progress"
  | "review_complete";

export interface CaseField {
  fieldId: string;
  label: string;
  fieldType: "text" | "radio" | "checkbox" | "date" | "number";
  extractedValue: string;
  confidence: number;
  confidenceReason: string;
  status: FieldStatus;
  correctedValue?: string;
  reviewedAt?: string;
}

export interface CaseFieldGroup {
  groupId: string;
  label: string;
  /** Anlage-Bezeichnung, z.B. "Anlage 1", "Anlage 6", "Hauptantrag" */
  anlageName?: string;
  /** Abschnittsbezeichnung im Formular, z.B. "§ 9 Personalien" */
  sectionLabel?: string;
  /** true wenn die Gruppe ein Array von Objekten repräsentiert (z.B. Gläubiger) */
  isArray?: boolean;
  /** Bei isArray: mehrere Instanzen */
  instances?: CaseField[][];
  /** Bei !isArray: flache Liste */
  fields?: CaseField[];
  /** "table" = tabellarische Darstellung im Review-UI (Standard: Card-Liste) */
  displayMode?: "table";
}

export interface CaseFile {
  caseId: string;
  filename: string;
  uploadedAt: string;
  status: CaseStatus;
  processingTimeMs: number;
  /** Ordnersicherer Aktenzeichen-Slug, z.B. "45 IK 123-24" */
  aktenzeichen?: string;
  /** Originalwert aus dem Formular, z.B. "45 IK 123/24" */
  aktenzeichenDisplay?: string;
  /** Denormalisiert für Listenansicht, z.B. "Müller, Erika" */
  schuldnerName?: string;
  /** Abgeleitet aus RSB-Feldern, z.B. "Mit RSB" */
  verfahrensart?: string;
  fieldGroups: CaseFieldGroup[];
  tags?: TagRef[];
  /** UserId des hauptverantwortlichen Anwalts – wird von Kanzlei-Partnern gesetzt */
  hauptverantwortlicherId?: string;
}

export interface AkteListItem {
  caseId: string;
  filename: string;
  uploadedAt: string;
  status: CaseFile["status"];
  aktenzeichen?: string;
  aktenzeichenDisplay?: string;
  schuldnerName?: string;
  verfahrensart?: string;
  tags?: TagRef[];
  /** UserId des hauptverantwortlichen Anwalts */
  hauptverantwortlicherId?: string;
}

export interface FieldProposal {
  id: string;
  /** The document that triggered this proposal */
  sourceDocument: {
    folder: "eingehend" | "ausgehend";
    filename: string;
  };
  groupId: string;
  fieldId: string;
  instanceIndex?: number;
  /** Human-readable label for display */
  fieldLabel: string;
  /** Current value (may be empty string if field was empty) */
  currentValue: string;
  /** AI-proposed new value */
  proposedValue: string;
  /** AI reasoning */
  reason: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  reviewedAt?: string;
}
