/**
 * Vollständige Felddefinition aller VInsO-Formular-Sektionen (Amtl. Fassung 2020/2021).
 *
 * Quelle: docs/formulare/vinso_12_2020_ VERSION1.md
 * Letzte Aktualisierung: 2026-03-06
 */

export type FieldType = "text" | "radio" | "checkbox" | "date" | "number";

export interface FieldConfig {
  fieldId: string;
  label: string;
  fieldType: FieldType;
}

export interface FieldGroupConfig {
  groupId: string;
  label: string;
  /** Schlüssel im VInsOExtraction-Objekt */
  schemaKey: string;
  isArray?: boolean;
  fields: FieldConfig[];
  /** Anlage-Bezeichnung für den Review-Screen, z.B. "Anlage 1" */
  anlageName: string;
  /** Abschnittsbezeichnung im Formular, z.B. "§ 9 Personalien" */
  sectionLabel: string;
  /**
   * Schlüssel-Präfix für die staticMap (Standard: groupId).
   * Verwenden wenn zwei Gruppen denselben Datensatz teilen (z.B. Anlage 6 + Anlage 7 §69).
   */
  keyPrefix?: string;
  /** "table" = tabellarische Darstellung im Review-UI */
  displayMode?: "table";
  /** Erste Seite dieses Abschnitts im Standard-VInsO-Formular (1-basiert, für PDF-Navigation) */
  startPage?: number;
}

export const VINSO_FIELD_GROUPS: FieldGroupConfig[] = [

  // ── Hauptantrag ──────────────────────────────────────────────────────────────

  {
    groupId: "verfahrensangaben",
    label: "Verfahrensangaben",
    schemaKey: "verfahrensangaben",
    anlageName: "Hauptantrag",
    sectionLabel: "§ I – III Eröffnungsantrag",
    startPage: 2,
    fields: [
      { fieldId: "zustaendigesAmtsgericht",             label: "Zuständiges Amtsgericht",                          fieldType: "text"     },
      { fieldId: "aktenzeichen",                        label: "Aktenzeichen",                                     fieldType: "text"     },
      { fieldId: "antragsDatum",                        label: "Antragsdatum",                                     fieldType: "date"     },
      { fieldId: "aussergerichtlicherEinigungsversuch", label: "Außergerichtlicher Einigungsversuch unternommen",  fieldType: "checkbox" },
      { fieldId: "bescheinigungBeigefuegt",             label: "Bescheinigung beigefügt",                          fieldType: "checkbox" },
      { fieldId: "fruehereInsolvenzverfahren",          label: "Frühere Insolvenzverfahren",                       fieldType: "checkbox" },
    ],
  },

  {
    groupId: "rsb",
    label: "Restschuldbefreiung (RSB)",
    schemaKey: "rsb",
    anlageName: "Hauptantrag",
    sectionLabel: "§ II Restschuldbefreiungsantrag",
    startPage: 2,
    fields: [
      { fieldId: "rsbBeantragt",             label: "RSB beantragt",                           fieldType: "checkbox" },
      { fieldId: "fruehereRSBErteilt",       label: "Frühere RSB erteilt (letzte 10 J.)",      fieldType: "checkbox" },
      { fieldId: "rsbAntragDatum",           label: "RSB Antrag gestellt am",                  fieldType: "date"     },
      { fieldId: "rsbErteiltDatum",          label: "RSB erteilt am",                          fieldType: "date"     },
      { fieldId: "obliegenheitenAkzeptiert", label: "Obliegenheiten akzeptiert (§ 295 InsO)",  fieldType: "checkbox" },
    ],
  },

  // ── Anlage 1 – Personalbogen ─────────────────────────────────────────────────

  {
    groupId: "schuldner_person",
    label: "Angaben zur Person des Schuldners",
    schemaKey: "schuldnerPerson",
    anlageName: "Anlage 1",
    sectionLabel: "§ 9 Personalien",
    startPage: 4,
    fields: [
      { fieldId: "nachname",           label: "Nachname",                              fieldType: "text"   },
      { fieldId: "akademischerGrad",   label: "Akademischer Grad",                     fieldType: "text"   },
      { fieldId: "vorname",            label: "Vorname(n)",                            fieldType: "text"   },
      { fieldId: "geschlecht",         label: "Geschlecht",                            fieldType: "radio"  },
      { fieldId: "geburtsname",        label: "Geburtsname",                           fieldType: "text"   },
      { fieldId: "fruehererName",      label: "Früherer Name",                         fieldType: "text"   },
      { fieldId: "geburtsdatum",       label: "Geburtsdatum",                          fieldType: "date"   },
      { fieldId: "geburtsort",         label: "Geburtsort",                            fieldType: "text"   },
      { fieldId: "strasseHausnr",      label: "Straße, Hausnummer",                    fieldType: "text"   },
      { fieldId: "plzOrt",             label: "PLZ, Ort",                              fieldType: "text"   },
      { fieldId: "telefon",            label: "Telefon (privat)",                      fieldType: "text"   },
      { fieldId: "mobil",              label: "Mobil",                                 fieldType: "text"   },
      { fieldId: "email",              label: "E-Mail",                                fieldType: "text"   },
      { fieldId: "familienstand",      label: "Familienstand",                         fieldType: "radio"  },
      { fieldId: "familienstandDatum", label: "Familienstand seit",                    fieldType: "date"   },
      { fieldId: "unterhaltsberechtigtJa",          label: "Unterhaltsberechtigte vorhanden",      fieldType: "checkbox" },
      { fieldId: "anzahlUnterhaltsberechtigterKinder", label: "Unterhaltsberechtigte Personen (Anzahl)", fieldType: "number" },
      { fieldId: "davonMinderjährig",  label: "Davon minderjährig",                    fieldType: "number" },
    ],
  },

  {
    groupId: "schuldner_beschaeftigung",
    label: "Beschäftigung und Einkommen",
    schemaKey: "schuldnerBeschaeftigung",
    anlageName: "Anlage 1",
    sectionLabel: "§ 12 Beteiligung am Erwerbsleben",
    startPage: 4,
    fields: [
      { fieldId: "erlernterBeruf",               label: "Erlernter Beruf",                       fieldType: "text"     },
      { fieldId: "zuletztTaetigAls",             label: "Zuletzt tätig als",                     fieldType: "text"     },
      { fieldId: "ehemSelbstaendig",             label: "Ehemals selbständig",                   fieldType: "checkbox" },
      { fieldId: "ehemSelbstaendigAls",          label: "Ehemals selbständig als",               fieldType: "text"     },
      { fieldId: "verbindlichkeitenAusArbeit",   label: "Verbindlichkeiten aus Arbeitsverhältnissen", fieldType: "checkbox" },
      { fieldId: "beschaeftigungsart",           label: "Art der Beschäftigung",                 fieldType: "radio"    },
      { fieldId: "arbeitgeberName",              label: "Arbeitgeber (Name/Firma)",               fieldType: "text"     },
      { fieldId: "arbeitgeberAdresse",           label: "Arbeitgeber (Adresse)",                  fieldType: "text"     },
      { fieldId: "monatlichesNettoeinkommen",    label: "Monatliches Nettoeinkommen",             fieldType: "number"   },
      { fieldId: "sonstigeEinkuenfteArt",        label: "Sonstige Einkünfte (Art)",               fieldType: "text"     },
      { fieldId: "sonstigeEinkuenfte",           label: "Sonstige Einkünfte (€)",                 fieldType: "number"   },
    ],
  },

  {
    groupId: "verfahrensbevollmaechtigte",
    label: "Verfahrensbevollmächtigte(r)",
    schemaKey: "verfahrensbevollmaechtigte",
    anlageName: "Anlage 1",
    sectionLabel: "§ 13 Verfahrensbevollmächtigte(r)",
    startPage: 4,
    fields: [
      { fieldId: "nachname",          label: "Nachname",               fieldType: "text" },
      { fieldId: "akademischerGrad",  label: "Akademischer Grad",      fieldType: "text" },
      { fieldId: "vorname",           label: "Vorname",                fieldType: "text" },
      { fieldId: "beruf",             label: "Beruf/Bezeichnung",      fieldType: "text" },
      { fieldId: "strasseHausnr",     label: "Straße, Hausnummer",     fieldType: "text" },
      { fieldId: "plzOrt",            label: "PLZ, Ort",               fieldType: "text" },
      { fieldId: "telefon",           label: "Telefon",                fieldType: "text" },
      { fieldId: "email",             label: "E-Mail",                 fieldType: "text" },
      { fieldId: "geschaeftszeichen", label: "Geschäftszeichen",       fieldType: "text" },
    ],
  },

  // ── Anlage 4 – § 22 Vermögen ─────────────────────────────────────────────────

  {
    groupId: "vermoegenAnlage4",
    label: "Vermögen",
    schemaKey: "vermoegenAnlage4",
    anlageName: "Anlage 4",
    sectionLabel: "§ 22 Vermögen (Pos. 1.1–1.10)",
    displayMode: "table",
    startPage: 8,
    fields: [
      { fieldId: "bargeldEur",         label: "1.1 Bargeld (EUR)",                                    fieldType: "number" },
      { fieldId: "kontenguthabenEur",  label: "1.2 Guthaben auf Konten / Wertpapiere (EUR)",          fieldType: "number" },
      { fieldId: "hausratEur",         label: "1.3 Hausrat / Wertgegenstände (EUR)",                  fieldType: "number" },
      { fieldId: "bautenEur",          label: "1.4 Bauten auf fremden Grundstücken (EUR)",            fieldType: "number" },
      { fieldId: "fahrzeugeEur",       label: "1.5 Fahrzeuge (EUR)",                                  fieldType: "number" },
      { fieldId: "forderungenEur",     label: "1.6 Forderungen gegen Dritte (EUR)",                  fieldType: "number" },
      { fieldId: "grundstueckeEur",    label: "1.7 Grundstücke / Eigentumswohnungen (EUR)",           fieldType: "number" },
      { fieldId: "beteiligungEur",     label: "1.8 Beteiligungen / Aktien (EUR)",                    fieldType: "number" },
      { fieldId: "immateriellEur",     label: "1.9 Urheberrechte / immaterielle Vermögensgeg. (EUR)", fieldType: "number" },
      { fieldId: "sonstigesVermoegenEur", label: "1.10 Sonstiges Vermögen (EUR)",                    fieldType: "number" },
    ],
  },

  // ── Anlage 4 – §§ 23+24 Einkünfte ────────────────────────────────────────────

  {
    groupId: "einkuenfteAnlage4",
    label: "Einkünfte",
    schemaKey: "einkuenfteAnlage4",
    anlageName: "Anlage 4",
    sectionLabel: "§ 23 Monatliche Einkünfte + § 24 Jährliche Einkünfte",
    displayMode: "table",
    startPage: 8,
    fields: [
      // § 23 Monatliche Einkünfte (Pos. 2.1–2.7)
      { fieldId: "arbeitseinkommenMonatl",   label: "2.1 Arbeitseinkommen monatl. netto (EUR)",       fieldType: "number" },
      { fieldId: "algMonatl",                label: "2.2 Arbeitslosengeld / Grundsicherung (EUR)",    fieldType: "number" },
      { fieldId: "krankengeldMonatl",        label: "2.3 Krankengeld monatl. (EUR)",                  fieldType: "number" },
      { fieldId: "renteMonatl",              label: "2.4 Rente / Versorgungsbezüge monatl. (EUR)",    fieldType: "number" },
      { fieldId: "privVersichMonatl",        label: "2.5 Private Renten-/Spar-/Versich. (EUR)",       fieldType: "number" },
      { fieldId: "sozialleistungenMonatl",   label: "2.6 Sonstige Sozialleistungen monatl. (EUR)",    fieldType: "number" },
      { fieldId: "sonstigeEinkuenfteMonatl", label: "2.7 Sonstige monatl. Einkünfte (EUR)",           fieldType: "number" },
      // § 24 Jährliche Einkünfte (Pos. 3.1–3.4)
      { fieldId: "nichtselbstJaehrlEur",  label: "3.1 Weihnachtsgeld / Tantiemen jährl. (EUR)",      fieldType: "number" },
      { fieldId: "vermietungJaehrlEur",   label: "3.2 Einkünfte aus Vermietung/Verpachtung (EUR)",   fieldType: "number" },
      { fieldId: "kapitalJaehrlEur",      label: "3.3 Einkünfte aus Kapitalvermögen (EUR)",          fieldType: "number" },
      { fieldId: "sonstigesJaehrlEur",    label: "3.4 Sonstige jährl. Einkünfte (EUR)",              fieldType: "number" },
    ],
  },

  // ── Anlage 4 – §§ 25+26 Lebensunterhalt + Verpflichtungen ────────────────────

  {
    groupId: "verpflichtungenAnlage4",
    label: "Lebensunterhalt und laufende Verpflichtungen",
    schemaKey: "verpflichtungenAnlage4",
    anlageName: "Anlage 4",
    sectionLabel: "§ 25 Sonstiger Lebensunterhalt + § 26 Zahlungsverpflichtungen",
    displayMode: "table",
    startPage: 9,
    fields: [
      { fieldId: "lebensunterhaltSonstiger",    label: "§ 25 Sonstiger Lebensunterhalt (Beschreibung)", fieldType: "text"   },
      { fieldId: "unterhaltNaturPersonen",      label: "§ 26.5.1 Naturalunterhalt (Anzahl Personen)",   fieldType: "number" },
      { fieldId: "unterhaltBarPersonen",        label: "§ 26.5.1 Barunterhalt (Anzahl Personen)",       fieldType: "number" },
      { fieldId: "unterhaltMonatl",             label: "§ 26.5.1 Unterhaltsverpflichtungen (EUR/Monat)", fieldType: "number" },
      { fieldId: "wohnkostenMonatl",            label: "§ 26.5.2 Wohnkosten monatl. (EUR)",             fieldType: "number" },
      { fieldId: "verpflichtungenSonstigesMonatl", label: "§ 26.5.3 Sonstige Verpflichtungen (EUR/Monat)", fieldType: "number" },
    ],
  },

  // ── Anlage 5G – Laufendes Einkommen (Arbeitgeber) ───────────────────────────

  {
    groupId: "arbeitgeber_5g",
    label: "Arbeitgeber",
    schemaKey: "arbeitgeber5g",
    anlageName: "Anlage 5G",
    sectionLabel: "§ 50 Einkünfte aus nichtselbständiger Arbeit",
    startPage: 17,
    fields: [
      { fieldId: "aufgabenbereich",  label: "Berufliche Tätigkeit / Aufgabenbereich", fieldType: "text"   },
      { fieldId: "nameOderFirma",    label: "Name/Firma des Arbeitgebers",            fieldType: "text"   },
      { fieldId: "strasseHausnr",    label: "Straße, Hausnummer",                     fieldType: "text"   },
      { fieldId: "plzOrt",           label: "PLZ, Ort",                               fieldType: "text"   },
      { fieldId: "personalNr",       label: "Personal-Nr.",                           fieldType: "text"   },
      { fieldId: "arbeitseinkommen", label: "Arbeitseinkommen netto monatl. (EUR)",   fieldType: "number" },
      { fieldId: "zulagen",          label: "Zulagen monatl. (EUR)",                  fieldType: "number" },
    ],
  },

  // ── Anlage 5J – Wohnkosten ───────────────────────────────────────────────────

  {
    groupId: "wohnkosten_5j",
    label: "Wohnkosten",
    schemaKey: "wohnkosten5j",
    anlageName: "Anlage 5J",
    sectionLabel: "§ 61 Wohnkosten",
    startPage: 21,
    fields: [
      { fieldId: "wohnungQm",           label: "Wohnungsgröße (qm)",          fieldType: "number" },
      { fieldId: "kaltmiete",           label: "Kaltmiete monatl. (EUR)",      fieldType: "number" },
      { fieldId: "nebenkosten",         label: "Nebenkosten monatl. (EUR)",    fieldType: "number" },
      { fieldId: "gesamtmiete",         label: "Gesamtmiete monatl. (EUR)",    fieldType: "number" },
      { fieldId: "ichZahleMonatl",      label: "Ich zahle monatl. (EUR)",      fieldType: "number" },
      { fieldId: "mitbewohnerMonatl",   label: "Mitbewohner zahlen monatl. (EUR)", fieldType: "number" },
    ],
  },

  // ── Anlage 7 – Schuldenbereinigungsplan (Allgemeiner Teil) ───────────────────

  {
    groupId: "schuldenbereinigungsplan7",
    label: "Schuldenbereinigungsplan (Allgemeiner Teil)",
    schemaKey: "schuldenbereinigungsplan7",
    anlageName: "Anlage 7",
    sectionLabel: "§ 67–68 Schuldenbereinigungsplan",
    startPage: 26,
    fields: [
      { fieldId: "datum",                  label: "Datum des SBP",                        fieldType: "date"     },
      { fieldId: "planart",                label: "Planart",                               fieldType: "radio"    },
      { fieldId: "erlaeuterungenAnlage7c", label: "Erläuterungen (Anlage 7C) beigefügt",  fieldType: "checkbox" },
    ],
  },

  // ── Anlage 6 – Gläubiger- und Forderungsverzeichnis ─────────────────────────

  {
    groupId: "glaeubigeranlage6",
    label: "Gläubiger- und Forderungsverzeichnis",
    schemaKey: "glaeubigerListe",
    anlageName: "Anlage 6",
    sectionLabel: "§ 305 Abs. 1 Nr. 3 InsO",
    isArray: true,
    displayMode: "table",
    startPage: 24,
    fields: [
      { fieldId: "nameOderFirma",               label: "Name / Firma",                          fieldType: "text"   },
      { fieldId: "forderungsgrund",             label: "Forderungsgrund",                       fieldType: "text"   },
      { fieldId: "hauptforderungEur",           label: "Hauptforderung (EUR)",                  fieldType: "number" },
      { fieldId: "zinsenEur",                   label: "Zinsen (EUR)",                          fieldType: "number" },
      { fieldId: "zinsenBis",                   label: "Zinsen berechnet bis",                  fieldType: "date"   },
      { fieldId: "kostenEur",                   label: "Kosten (EUR)",                          fieldType: "number" },
      { fieldId: "summeForderungEur",           label: "Summe Forderung (EUR)",                 fieldType: "number" },
      { fieldId: "anteilGesamtverschuldungPct", label: "Anteil Gesamtverschuldung (%)",         fieldType: "number" },
    ],
  },

  // ── Anlage 7 §69 – Beteiligte Gläubiger (Adressen + Bevollmächtigte) ────────

  {
    groupId: "glaeubigerAdressenAnlage7",
    label: "Beteiligte Gläubiger – Adressen und Bevollmächtigte",
    schemaKey: "glaeubigerAdressenListe",
    anlageName: "Anlage 7",
    sectionLabel: "§ 69 Beteiligte Gläubiger",
    isArray: true,
    displayMode: "table",
    startPage: 26,
    // Gleicher Key-Präfix wie Anlage 6, da die Daten zum selben Gläubiger gehören
    keyPrefix: "glaeubigeranlage6",
    fields: [
      { fieldId: "nameOderFirma",               label: "Name / Firma",                          fieldType: "text"   },
      { fieldId: "adresse",                     label: "Adresse",                               fieldType: "text"   },
      { fieldId: "geschaeftszeichen",           label: "Geschäftszeichen",                      fieldType: "text"   },
      { fieldId: "gesetzlVertreten",            label: "Gesetzl. vertreten durch",              fieldType: "text"   },
      { fieldId: "bevName",                     label: "Verfahrensbevollmächtigte(r)",          fieldType: "text"   },
      { fieldId: "bevStrasseHausnr",            label: "Bev. Straße, Hausnr.",                  fieldType: "text"   },
      { fieldId: "bevPlzOrt",                   label: "Bev. PLZ, Ort",                         fieldType: "text"   },
      { fieldId: "bevGeschaeftszeichen",        label: "Bev. Geschäftszeichen",                 fieldType: "text"   },
    ],
  },
];
