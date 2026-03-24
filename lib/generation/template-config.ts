/**
 * Konfiguration der verfügbaren Dokument-Templates.
 *
 * `zielKategorie` ist ein TagRef aus dem Dokument-Klassifizierungssystem
 * (dokument/kategorie/...) und wird beim Generieren automatisch gesetzt.
 * Leer lassen wenn keine automatische Klassifizierung gewünscht.
 */

export interface TemplateConfig {
  /** Interner Bezeichner des Templates */
  id: string;
  /** Anzeigename */
  label: string;
  /**
   * TagRef der Ziel-Kategorie, die bei generierten Dokumenten automatisch
   * gesetzt wird. Muss ein gültiger TagRef im System sein, z.B.
   * "dokument/kategorie/stammakte/glaeubigeranschreiben".
   */
  zielKategorie?: string;
}

export const GLAEUBIGER_BRIEF_CONFIG: TemplateConfig = {
  id: "glaeubigerAnschreiben",
  label: "Gläubigeranschreiben",
  zielKategorie: "dokument/kategorie/stammakte/glaeubigeranschreiben",
};
