/**
 * Statisches Mapping für die VInsO-Formular-Extraktion (Amtl. Fassung 2020/2021)
 *
 * Zwei Stufen:
 * 1. ACROFORM_FIELD_MAP  — direkte Zuordnung PDF-AcroForm-Feldname → unsere fieldId
 *    Gilt für digital ausgefüllte PDFs (Formular mit interaktiven Feldern).
 *    Feldnamen wurden durch Inspektion von vinso_12_2020.pdf ermittelt (Log-Analyse).
 *
 * 2. TEXT_FIELD_PATTERNS — Regex-Muster auf dem extrahierten Rohtext
 *    Fallback für gedruckte/eingescannte PDFs oder wenn AcroForm-Extraktion leer bleibt.
 *    Abgeleitet aus: docs/formulare/vinso_12_2020_ VERSION1.md
 *
 * Konfidenz-Konvention:
 *   1.0  AcroForm-Treffer (exakter Feldname bekannt)
 *   0.92 Eindeutiges Textmuster (Label + Wert klar abgrenzbar)
 *   0.80 Textmuster mit möglichen Mehrdeutigkeiten
 *   0.60 Schwaches Muster / Heuristik
 *
 * Letzte Verifikation der AcroForm-Feldnamen: 2026-03-06
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. AcroForm-Feldname → unsere fieldId
//
// Feldnamen werden per [AcroForm]-Logs ermittelt, wenn ein ausgefülltes PDF
// hochgeladen wird. Hinweis: Kombinations-Felder (Straße+Hausnr, PLZ+Ort) werden
// in static-extractor.ts über COMBINATION_PARTS definiert, nicht hier.
// ─────────────────────────────────────────────────────────────────────────────
export const ACROFORM_FIELD_MAP: Record<string, string> = {

  // ── Aktuelle Feldnamen aus vinso_12_2020.pdf ─────────────────────────────

  // === Anlage 1 – § 9 Personalien ===
  // y≈715-691: Nachname, Akad. Grad, Vorname
  "Textfeld 25": "schuldner_person__nachname",            // "Müller"
  "Textfeld 27": "schuldner_person__vorname",             // "Hans"
  "Textfeld 26": "schuldner_person__akademischerGrad",    // akademischer Grad
  // y≈668: Geburtsname, Früherer Name (beide auf gleicher Zeile)
  "Textfeld 28": "schuldner_person__geburtsname",         // Geburtsname (y=668)
  "Textfeld 29": "schuldner_person__fruehererName",       // Früherer Name (y=668)
  // y≈644: Geburtsdatum, Geburtsort
  "Textfeld 30": "schuldner_person__geburtsdatum",        // "30.6.1975"
  "Textfeld 31": "schuldner_person__geburtsort",          // "Großmusterstadt"
  // Textfeld 32 (Straße) + Textfeld 33 (Hausnr) → kombiniert → schuldner_person__strasseHausnr
  // Textfeld 34 (PLZ) + Textfeld 35 (Ort) → kombiniert → schuldner_person__plzOrt
  "Textfeld 36": "schuldner_person__telefon",             // "+49 125 987654"
  "Textfeld 37": "schuldner_person__mobil",               // Mobil
  "Textfeld 39": "schuldner_person__email",               // "hans@mueller.email"
  // Kontrollkästchen 22 = Geschlecht-Radio → "männlich"/"weiblich"/"divers"
  "Kontrollkästchen 22": "schuldner_person__geschlecht",
  // Kontrollkästchen 23 = Familienstand-Radio → "ledig"/"verheiratet"/...
  "Kontrollkästchen 23": "schuldner_person__familienstand",

  // === Anlage 1 – § 12 Beteiligung am Erwerbsleben ===
  // y≈361: Erlernter Beruf, y≈336: Zurzeit/zuletzt tätig als, y≈311: Ehemals selbständig als
  "Textfeld 48":  "schuldner_beschaeftigung__erlernterBeruf",       // "Erlernter Beruf" (y=361)
  "Textfeld 49":  "schuldner_beschaeftigung__zuletztTaetigAls",     // "Zurzeit oder zuletzt tätig als" (y=336)
  "Textfeld 49a": "schuldner_beschaeftigung__ehemSelbstaendigAls",  // Beschreibung ehemals selbständig (y=311)
  "Kontrollkästchen 27": "schuldner_beschaeftigung__ehemSelbstaendig",       // Ehemals selbständig
  "Kontrollkästchen 29": "schuldner_beschaeftigung__verbindlichkeitenAusArbeit",
  "Kontrollkästchen 28": "schuldner_beschaeftigung__beschaeftigungsart",     // Radio: "Angestellte(r)"/...

  // === Anlage 1 – § 13 Verfahrensbevollmächtigte ===
  "Textfeld 55": "verfahrensbevollmaechtigte__nachname",         // "Berater"
  "Textfeld 56": "verfahrensbevollmaechtigte__akademischerGrad", // "Dr."
  "Textfeld 57": "verfahrensbevollmaechtigte__vorname",          // "Inso"
  "Textfeld 58": "verfahrensbevollmaechtigte__beruf",            // "Jurist"
  // Textfeld 60 (Straße) + Textfeld 61 (Hausnr) → kombiniert → verfahrensbevollmaechtigte__strasseHausnr
  // Textfeld 62 (PLZ) + Textfeld 63 (Ort) → kombiniert → verfahrensbevollmaechtigte__plzOrt
  "Textfeld 64": "verfahrensbevollmaechtigte__telefon",
  "Textfeld 66": "verfahrensbevollmaechtigte__email",            // "inso@berater.email"
  "Textfeld 67": "verfahrensbevollmaechtigte__geschaeftszeichen",

  // === Hauptantrag – Verfahrensangaben ===
  "Textfeld 16":         "verfahrensangaben__zustaendigesAmtsgericht", // "Großmusterstadt"
  "Kontrollkästchen 24": "verfahrensangaben__aussergerichtlicherEinigungsversuch", // ja/nein
  "Kontrollkästchen 25": "verfahrensangaben__fruehereInsolvenzverfahren",          // ja/nein
  "Kontrollkästchen 26": "verfahrensangaben__bescheinigungBeigefuegt",             // ja/nein

  // === Hauptantrag – § II RSB ===
  "Kontrollkästchen 1":  "rsb__rsbBeantragt",        // Checkbox
  "Kontrollkästchen 2":  "rsb__fruehereRSBErteilt",  // Radio: "bisher nicht gestellt" / "erteilt am"

  // === Anlage 4 – Vermögensübersicht (Seite 8+9, ermittelt durch list-acrofields.ts) ===

  // § 22 Vermögen — Wert-in-EUR-Felder (Seite 8, jede Zeile hat even=EUR, odd=Sicherungsbetrag)
  "Textfeld 100": "vermoegenAnlage4__bargeldEur",          // Pos 1.1 Bargeld
  "Textfeld 102": "vermoegenAnlage4__kontenguthabenEur",   // Pos 1.2 Konten/Wertpapiere
  "Textfeld 104": "vermoegenAnlage4__hausratEur",          // Pos 1.3 Hausrat
  "Textfeld 106": "vermoegenAnlage4__bautenEur",           // Pos 1.4 Bauten auf fremden Grundstücken
  "Textfeld 108": "vermoegenAnlage4__fahrzeugeEur",        // Pos 1.5 Fahrzeuge
  "Textfeld 110": "vermoegenAnlage4__forderungenEur",      // Pos 1.6 Forderungen gegen Dritte
  "Textfeld 112": "vermoegenAnlage4__grundstueckeEur",     // Pos 1.7 Grundstücke
  "Textfeld 114": "vermoegenAnlage4__beteiligungEur",      // Pos 1.8 Beteiligungen/Aktien
  "Textfeld 116": "vermoegenAnlage4__immateriellEur",      // Pos 1.9 Urheberrechte
  "Textfeld 118": "vermoegenAnlage4__sonstigesVermoegenEur", // Pos 1.10 Sonstiges

  // § 23 Monatliche Einkünfte (Seite 8, unterer Bereich)
  "Textfeld 120": "einkuenfteAnlage4__arbeitseinkommenMonatl",   // Pos 2.1 Arbeitseinkommen
  "Textfeld 122": "einkuenfteAnlage4__algMonatl",                // Pos 2.2 ALG/Grundsicherung
  "Textfeld 124": "einkuenfteAnlage4__krankengeldMonatl",        // Pos 2.3 Krankengeld
  "Textfeld 126": "einkuenfteAnlage4__renteMonatl",              // Pos 2.4 Rente
  "Textfeld 128": "einkuenfteAnlage4__privVersichMonatl",        // Pos 2.5 Private Versicherungen
  "Textfeld 130": "einkuenfteAnlage4__sozialleistungenMonatl",   // Pos 2.6 Sozialleistungen
  "Textfeld 132": "einkuenfteAnlage4__sonstigeEinkuenfteMonatl", // Pos 2.7 Sonstige monatl.

  // § 24 Jährliche Einkünfte (Seite 9, oberer Bereich)
  "Textfeld 134": "einkuenfteAnlage4__nichtselbstJaehrlEur",  // Pos 3.1 Weihnachtsgeld etc.
  "Textfeld 136": "einkuenfteAnlage4__vermietungJaehrlEur",   // Pos 3.2 Vermietung
  "Textfeld 138": "einkuenfteAnlage4__kapitalJaehrlEur",      // Pos 3.3 Kapital
  "Textfeld 140": "einkuenfteAnlage4__sonstigesJaehrlEur",    // Pos 3.4 Sonstige jährl.

  // § 25 Sonstiger Lebensunterhalt (Seite 9, Text-Freifeld)
  "Textfeld 142": "verpflichtungenAnlage4__lebensunterhaltSonstiger",

  // § 26 Verpflichtungen (Seite 9)
  "Textfeld 143": "verpflichtungenAnlage4__unterhaltNaturPersonen", // Naturalunterhalt Personen
  "Textfeld 144": "verpflichtungenAnlage4__unterhaltBarPersonen",   // Barunterhalt Personen
  "Textfeld 145": "verpflichtungenAnlage4__unterhaltMonatl",         // Unterhalt EUR/Monat
  "Textfeld 146": "verpflichtungenAnlage4__wohnkostenMonatl",        // Wohnkosten EUR/Monat
  "Textfeld 147": "verpflichtungenAnlage4__verpflichtungenSonstigesMonatl", // Sonstige EUR/Monat

  // === Anlage 5G – Laufendes Einkommen (Seite 17, Ergänzungsblatt 5G) ===
  "Textfeld 278": "arbeitgeber_5g__aufgabenbereich",    // Berufliche Tätigkeit
  "Textfeld 279": "arbeitgeber_5g__nameOderFirma",      // Name/Firma Arbeitgeber
  // Textfeld 280+281 → kombiniert → arbeitgeber_5g__strasseHausnr
  // Textfeld 282+283 → kombiniert → arbeitgeber_5g__plzOrt
  "Textfeld 284": "arbeitgeber_5g__personalNr",
  "Textfeld 286": "arbeitgeber_5g__arbeitseinkommen",   // Auszahlungsbetrag Arbeitseinkommen
  "Textfeld 288": "arbeitgeber_5g__zulagen",            // Auszahlungsbetrag Zulagen

  // === Anlage 5J – Wohnkosten (Seite 21, §61 II) ===
  // §61 II Wohnkosten — 6 Felder nebeneinander in einer Zeile (y≈221)
  "Textfeld 385": "wohnkosten_5j__wohnungQm",           // Wohnungsgröße qm
  "Textfeld 386": "wohnkosten_5j__kaltmiete",           // Kaltmiete monatl.
  "Textfeld 387": "wohnkosten_5j__nebenkosten",         // Nebenkosten monatl.
  "Textfeld 388": "wohnkosten_5j__gesamtmiete",         // Gesamtmiete monatl.
  "Textfeld 389": "wohnkosten_5j__ichZahleMonatl",      // Ich zahle monatl.
  "Textfeld 390": "wohnkosten_5j__mitbewohnerMonatl",   // Mitbewohner zahlen

  // === Anlage 7 – Schuldenbereinigungsplan (Allgemeiner Teil) ===
  // Amtliche Fassung 1/2021 — ermittelt durch Log-Analyse
  "Textfeld 642":        "schuldenbereinigungsplan7__datum",    // "12.03.2026"
  "Kontrollkästchen 333": "schuldenbereinigungsplan7__planart", // "Flexible Raten" / "Feste Raten" / ...

  // ── Ältere / alternative Feldnamen (selbst erstellte PDFs / andere Tools) ──

  "Nachname":           "schuldner_person__nachname",
  "Name":               "schuldner_person__nachname",
  "Vorname":            "schuldner_person__vorname",
  "Vornamen":           "schuldner_person__vorname",
  "Akad_Grad":          "schuldner_person__akademischerGrad",
  "Geburtsname":        "schuldner_person__geburtsname",
  "Geburtsdatum":       "schuldner_person__geburtsdatum",
  "Geburtsort":         "schuldner_person__geburtsort",
  // Strasse/Hausnummer/PLZ/Ort → kombiniert in COMBINATION_PARTS (static-extractor.ts)
  "Telefon_privat":     "schuldner_person__telefon",
  "Telefon":            "schuldner_person__telefon",
  "Email":              "schuldner_person__email",
  "EMail":              "schuldner_person__email",
  "Familienstand":      "schuldner_person__familienstand",
  "Beschaeftigungsart": "schuldner_beschaeftigung__beschaeftigungsart",
  "Arbeitgeber_Name":   "schuldner_beschaeftigung__arbeitgeberName",
  "AG_Name":            "schuldner_beschaeftigung__arbeitgeberName",
  "Nettoeinkommen":     "schuldner_beschaeftigung__monatlichesNettoeinkommen",
  "Amtsgericht":        "verfahrensangaben__zustaendigesAmtsgericht",
  "Amtsgericht_Ort":    "verfahrensangaben__zustaendigesAmtsgericht",
  "Aktenzeichen":       "verfahrensangaben__aktenzeichen",
  "Antragsdatum":       "verfahrensangaben__antragsDatum",
  "RSB_beantragt":      "rsb__rsbBeantragt",
  "RSB_frueher_erteilt": "rsb__fruehereRSBErteilt",
  "Obliegenheiten":     "rsb__obliegenheitenAkzeptiert",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Textmuster (Regex) → fieldId + Konfidenz
//
// Abgeleitet aus: docs/formulare/vinso_12_2020_ VERSION1.md
// Konventionen:
//   - Capture Group 1 enthält den extrahierten Wert
//   - isCheckbox: true → Gruppe 1 enthält Checked-Marker, value = "true"/"false"
// ─────────────────────────────────────────────────────────────────────────────
export interface TextPattern {
  regex: RegExp;
  group?: number;
  confidence: number;
  isCheckbox?: boolean;
}

export const TEXT_FIELD_PATTERNS: Record<string, TextPattern[]> = {

  // ── Anlage 1 § 9 Personalien ──────────────────────────────────────────────

  "schuldner_person__nachname": [
    { regex: /\bNachname\b\t([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\t|\n|$)/, confidence: 0.88 },
    { regex: /\bNachname\b[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|$)/, confidence: 0.70 },
  ],

  "schuldner_person__vorname": [
    { regex: /\bVorname\(?n?\)?\t([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-\. ]+?)(?:\t|\n|$)/, confidence: 0.88 },
    { regex: /\bVorname\(?n?\)?[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-\. ]+?)(?:\s{2,}|\t|\n|Geburts|$)/, confidence: 0.70 },
  ],

  "schuldner_person__akademischerGrad": [
    { regex: /[Aa]kademischer\s+Grad[\s|:]+([A-Za-z]+\.)/, confidence: 0.88 },
  ],

  "schuldner_person__geburtsname": [
    { regex: /\bGeburtsname\b\t([A-ZÄÖÜa-zäöüß\-]+)/, confidence: 0.88 },
    { regex: /\bGeburtsname\b[\s|:]+([A-ZÄÖÜa-zäöüß\-]+)/, confidence: 0.70 },
  ],

  "schuldner_person__fruehererName": [
    { regex: /[Ff]r[üu]herer?\s+Name[\s|:]+([A-ZÄÖÜa-zäöüß\-]+)/, confidence: 0.88 },
  ],

  "schuldner_person__geburtsdatum": [
    { regex: /\bGeburtsdatum\b[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.95 },
  ],

  "schuldner_person__geburtsort": [
    { regex: /\bGeburtsort\b\t([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\t|\n|$)/, confidence: 0.88 },
    { regex: /\bGeburtsort\b[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|Stra[sß])/, confidence: 0.70 },
  ],

  "schuldner_person__strasseHausnr": [
    { regex: /(?:Stra[sß]e[,\s]+Hausnummer|Stra[sß]e)\b[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d\.\- ]+\d+[a-z]?)(?:\s{2,}|\t|\n|PLZ|$)/, confidence: 0.88 },
  ],

  "schuldner_person__plzOrt": [
    { regex: /(?:PLZ[,\s]+Ort|Postleitzahl)\b[\s|:]+(\d{5}\s+[A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|Telefon|$)/, confidence: 0.92 },
    { regex: /\b(\d{5}\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]{3,}(?:\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+)?)(?=\s)/, confidence: 0.75 },
  ],

  "schuldner_person__telefon": [
    { regex: /\bTelefon\s+(?:privat|tagsüber)\b[\s|:]+([0-9\s\/\-\+\(\)]{5,20})/, confidence: 0.93 },
    { regex: /\bTelefon\b[\s|:]+([0-9\s\/\-\+\(\)]{5,20})/, confidence: 0.90 },
  ],

  "schuldner_person__mobil": [
    { regex: /\bMobil\b[\s|:]+([0-9\s\/\-\+\(\)]{5,20})/, confidence: 0.92 },
  ],

  "schuldner_person__email": [
    { regex: /\bE-?Mail\b[\s|:]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/, confidence: 0.95 },
  ],

  "schuldner_person__geschlecht": [
    { regex: /\(X\)\s*(männlich|weiblich|divers)/i, confidence: 0.92, isCheckbox: false },
    { regex: /\[X\]\s*(männlich|weiblich|divers)/i, confidence: 0.92, isCheckbox: false },
  ],

  "schuldner_person__familienstand": [
    { regex: /\[X\]\s*(ledig|verheiratet|geschieden|verwitwet|getrennt\s+lebend|eingetragene\s+Lebenspartnerschaft)/i, confidence: 0.92 },
    { regex: /\(X\)\s*(ledig|verheiratet|geschieden|verwitwet|getrennt\s+lebend)/i, confidence: 0.92 },
    { regex: /\bFamilienstand\b[\s|:]+(\w+(?:\s+\w+)?)/, confidence: 0.75 },
  ],

  "schuldner_person__familienstandDatum": [
    { regex: /(?:ledig|verheiratet|geschieden|verwitwet|getrennt\s+lebend)\s+seit[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.90 },
  ],

  "schuldner_person__anzahlUnterhaltsberechtigterKinder": [
    { regex: /[Uu]nterhaltsberechtigte\s+(?:Kinder|Personen)\s+(\d+)/, confidence: 0.88 },
    { regex: /Anzahl:?\s*(\d+)[\s,]+davon\s+minderj/, confidence: 0.85 },
    { regex: /\bAnzahl\b[\s|:]+(\d+)/, confidence: 0.70 },
  ],

  "schuldner_person__davonMinderjährig": [
    { regex: /davon\s+minderj[äa]hrig[\s|:]+(\d+)/, confidence: 0.88 },
  ],

  // ── Anlage 1 § 12 Beschäftigung ──────────────────────────────────────────

  "schuldner_beschaeftigung__erlernterBeruf": [
    // Negativer Lookahead verhindert, dass das Label des nächsten Feldes als Wert erfasst wird
    { regex: /[Ee]rlernter\s+Beruf[\s|:]+(?![Zz]urzeit|[Ee]hemals)([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|$)/, confidence: 0.88 },
  ],

  "schuldner_beschaeftigung__zuletztTaetigAls": [
    // Negativer Lookahead verhindert Capture von "Ehemals selbständig" (nächstes Label)
    { regex: /[Zz]uletzt\s+t[äa]tig\s+als[\s|:]+(?![Ee]hemals)([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|$)/, confidence: 0.88 },
    { regex: /[Zz]urzeit\s+oder\s+zuletzt\s+t[äa]tig\s+als[\s|:]+(?![Ee]hemals)([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|$)/, confidence: 0.90 },
  ],

  "schuldner_beschaeftigung__beschaeftigungsart": [
    { regex: /\[X\]\s*(Angestellte\(r\)|Arbeiter\(in\)|Beamter|Aushilfe|unselbst[äa]ndig)/i, confidence: 0.90 },
    { regex: /\(X\)\s*(Angestellte\(r\)|Arbeiter\(in\)|Beamter|Aushilfe)/i, confidence: 0.90 },
    { regex: /\b(angestellt|selbst[äa]ndig\s*\/\s*freiberuflich|arbeitslos|Rentner|Beamter)/i, confidence: 0.75 },
  ],

  "schuldner_beschaeftigung__ehemSelbstaendig": [
    { regex: /\(X\)\s*[Ee]hemals\s+selbst[äa]ndig/, confidence: 0.92, isCheckbox: true },
    { regex: /\[X\]\s*[Ee]hemals\s+selbst[äa]ndig/, confidence: 0.92, isCheckbox: true },
  ],

  "schuldner_beschaeftigung__arbeitgeberName": [
    { regex: /(?:Firma|Arbeitgeber)\s*[\(:]?\s*([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d &.,\-]+(?:GmbH|AG|KG|eG|Ltd|SE|e\.V\.)?)/, confidence: 0.80 },
    { regex: /\bArbeitgeber\b\t([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d&.,\- ]+?)(?:\t|\n|$)/, confidence: 0.80 },
  ],

  "schuldner_beschaeftigung__arbeitgeberAdresse": [
    { regex: /(?:Adresse\s+des?\s+Arbeitgebers|AG.?Adresse)[\s\S]{0,60}?(\d{5}\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+)/, confidence: 0.80 },
  ],

  "schuldner_beschaeftigung__monatlichesNettoeinkommen": [
    { regex: /monatliches?\s+Nettoeinkommen[\s|:]+([0-9.,]+)/, confidence: 0.88 },
    { regex: /(?:Nettoeinkommen|netto)\b[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?/, confidence: 0.75 },
  ],

  "schuldner_beschaeftigung__sonstigeEinkuenfteArt": [
    { regex: /[Ss]onstige\s+Eink[üu]nfte\s*[\(]?Art[\)]?\t([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\t|\n|$)/, confidence: 0.88 },
    { regex: /[Ss]onstige\s+Eink[üu]nfte\s*[\(]?Art[\)]?[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|[0-9])/, confidence: 0.75 },
  ],

  "schuldner_beschaeftigung__sonstigeEinkuenfte": [
    { regex: /[Ss]onstige\s+Eink[üu]nfte[\s\S]{0,40}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?/, confidence: 0.80 },
  ],

  // ── Anlage 1 § 13 Verfahrensbevollmächtigte ──────────────────────────────

  "verfahrensbevollmaechtigte__nachname": [
    { regex: /[Vv]erfahrensbevollm[äa]chtigte?\(?r?\)?[\s\S]{0,100}?Name[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|Akad|Vorn|$)/, confidence: 0.80 },
  ],

  "verfahrensbevollmaechtigte__vorname": [
    { regex: /[Vv]erfahrensbevollm[äa]chtigte?[\s\S]{0,200}?Vorname[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|$)/, confidence: 0.80 },
  ],

  "verfahrensbevollmaechtigte__email": [
    { regex: /[Vv]erfahrensbevollm[äa]chtigte?[\s\S]{0,400}?E-?Mail[\s|:]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/, confidence: 0.85 },
  ],

  // ── Hauptantrag – Verfahrensangaben ──────────────────────────────────────

  "verfahrensangaben__zustaendigesAmtsgericht": [
    { regex: /Amtsgericht\s+[–\-]?\s*Insolvenzgericht\s+[–\-]?\s*in\s+([A-ZÄÖÜa-zäöüß][a-zäöüß]+(?:\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+)?)/, confidence: 0.93 },
    { regex: /\bAmtsgericht\s+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s+IK|\s+IN|\s+IE|\t|\n)/, confidence: 0.75 },
    { regex: /[Zz]ust[äa]ndiges\s+Amtsgericht[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|Akten)/, confidence: 0.70 },
  ],

  "verfahrensangaben__aktenzeichen": [
    { regex: /\bAktenzeichen\b[\s|:]+([A-Z]{2}\s*\d+\/\d{2,4})/, confidence: 0.93 },
    { regex: /\b((?:IK|IN|IE|IX)\s*\d+\/\d{2,4})\b/, confidence: 0.90 },
  ],

  "verfahrensangaben__antragsDatum": [
    { regex: /[Aa]ntragsdatum\b[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.93 },
    { regex: /[Aa]ntrag(?:stellung)?(?:\s+vom)?\b[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.88 },
  ],

  "verfahrensangaben__aussergerichtlicherEinigungsversuch": [
    { regex: /\[X\][^\n]*[Aa]u[sß]ergerichtliche[rn]?\s+Einigungsversuch/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*[Aa]u[sß]ergerichtliche[rn]?\s+Einigungsversuch/, confidence: 0.92, isCheckbox: true },
  ],

  "verfahrensangaben__bescheinigungBeigefuegt": [
    { regex: /\[X\][^\n]*[Bb]escheinigung[^\n]*beigef[üu]gt/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*[Bb]escheinigung[^\n]*beigef[üu]gt/, confidence: 0.92, isCheckbox: true },
  ],

  "verfahrensangaben__fruehereInsolvenzverfahren": [
    { regex: /\[X\][^\n]*[Ff]r[üu]here\s+Insolvenzverfahren/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*[Ff]r[üu]here\s+Insolvenzverfahren/, confidence: 0.92, isCheckbox: true },
  ],

  // ── Hauptantrag § II RSB ──────────────────────────────────────────────────

  "rsb__rsbBeantragt": [
    { regex: /\[X\][^\n]*[Aa]ntrag\s+auf\s+Restschuldbefreiung/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*[Aa]ntrag\s+auf\s+Restschuldbefreiung/, confidence: 0.92, isCheckbox: true },
    { regex: /\(X\)[^\n]*[Aa]ntrag\s+auf\s+Restschuldbefreiung/, confidence: 0.92, isCheckbox: true },
  ],

  "rsb__fruehereRSBErteilt": [
    { regex: /\[X\][^\n]*(?:In den letzten 10 Jahren|bereits\s+Restschuldbefreiung\s+erteilt)/, confidence: 0.93, isCheckbox: true },
    { regex: /\[\s\][^\n]*(?:In den letzten 10 Jahren|bereits\s+Restschuldbefreiung\s+erteilt)/, confidence: 0.92, isCheckbox: true },
    { regex: /Restschuldbefreiung\s+(?:wurde\s+)?erteilt\s+am\s+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.85 },
  ],

  "rsb__rsbAntragDatum": [
    { regex: /RSB[^\n]*Antrag\s+gestellt\s+am[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.90 },
    { regex: /bereits\s+gestellt\s+habe\s+am[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.88 },
  ],

  "rsb__rsbErteiltDatum": [
    { regex: /erteilt\s+wurde\s+am[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.90 },
    { regex: /Restschuldbefreiung\s+erteilt\s+am[\s|:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.90 },
  ],

  "rsb__obliegenheitenAkzeptiert": [
    { regex: /\[X\][^\n]*(?:Obliegenheiten|§\s*295\s+InsO)/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*(?:Obliegenheiten|§\s*295\s+InsO)/, confidence: 0.92, isCheckbox: true },
  ],

  // ── Anlage 4 – Vermögensübersicht ─────────────────────────────────────────

  "vermoegensuebersicht__bargeldEur": [
    { regex: /[Bb]argeld[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.82 },
  ],

  "vermoegensuebersicht__kontenguthabenEur": [
    { regex: /(?:Guthaben|Girokonten|Sparkonten)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "vermoegensuebersicht__fahrzeugeEur": [
    { regex: /(?:Fahrzeuge|PKW|Kraftfahrzeug)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "vermoegensuebersicht__grundstueckeEur": [
    { regex: /(?:Grundst[üu]cke?|Eigentumswohnung)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "vermoegensuebersicht__arbeitseinkommenMonatl": [
    { regex: /[Aa]rbeitseinkommen[^\n]*netto[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.85 },
    { regex: /Pos\.\s+1\.\s+Arbeitseinkommen[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.78 },
  ],

  "vermoegensuebersicht__wohnkostenMonatl": [
    { regex: /Wohnkosten[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.82 },
    { regex: /(?:Gesamtmiete|Miete)[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  // ── Anlage 4 § 22 Vermögen ───────────────────────────────────────────────

  "vermoegenAnlage4__bargeldEur": [
    { regex: /[Bb]argeld[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.82 },
  ],

  "vermoegenAnlage4__kontenguthabenEur": [
    { regex: /(?:Guthaben|Girokonten|Sparkonten|Wertpapiere)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "vermoegenAnlage4__fahrzeugeEur": [
    { regex: /(?:Fahrzeuge|PKW|Kraftfahrzeug)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "vermoegenAnlage4__grundstueckeEur": [
    { regex: /(?:Grundst[üu]cke?|Eigentumswohnung)[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  // ── Anlage 4 § 23 Monatliche Einkünfte ───────────────────────────────────

  "einkuenfteAnlage4__arbeitseinkommenMonatl": [
    { regex: /[Aa]rbeitseinkommen[^\n]*netto[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.85 },
    { regex: /Pos\.\s+1\.\s+Arbeitseinkommen[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.78 },
  ],

  "einkuenfteAnlage4__renteMonatl": [
    { regex: /(?:Rente|Pension)[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.80 },
  ],

  "einkuenfteAnlage4__algMonatl": [
    { regex: /(?:Arbeitslosengeld|ALG\s*I{1,2}|Grundsicherung|Bürgergeld)[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.80 },
  ],

  // ── Anlage 4 § 26 Verpflichtungen ────────────────────────────────────────

  "verpflichtungenAnlage4__wohnkostenMonatl": [
    { regex: /Wohnkosten[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.82 },
    { regex: /(?:Gesamtmiete|Miete)[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/, confidence: 0.78 },
  ],

  "verpflichtungenAnlage4__unterhaltMonatl": [
    { regex: /Unterhalt[\s\S]{0,30}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.80 },
  ],

  // ── Anlage 5G – Arbeitgeberdaten ─────────────────────────────────────────

  "arbeitgeber_5g__aufgabenbereich": [
    { regex: /[Bb]erufliche\s+T[äa]tigkeit[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\- ]+?)(?:\s{2,}|\t|\n|Name|$)/, confidence: 0.85 },
  ],

  "arbeitgeber_5g__nameOderFirma": [
    { regex: /Name\/Firma\s+des\s+Arbeitgebers[\s|:]+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d &.,\-]+?)(?:\s{2,}|\t|\n|Stra[sß]|PLZ|$)/, confidence: 0.85 },
  ],

  "arbeitgeber_5g__plzOrt": [
    { regex: /Arbeitgeber[\s\S]{0,200}?(\d{5}\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+)/, confidence: 0.78 },
  ],

  "arbeitgeber_5g__arbeitseinkommen": [
    { regex: /Arbeitseinkommen\s+\(?netto\)?[\s|:]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.88 },
    { regex: /1\.\s+Arbeitseinkommen[\s\S]{0,60}?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€?\s*monatlich/, confidence: 0.82 },
  ],

  // ── Anlage 5J – Wohnkosten ───────────────────────────────────────────────

  "wohnkosten_5j__wohnungQm": [
    { regex: /Wohnungsgr[öo][sß]e[\s|:]+(\d{1,4})\s*(?:qm|m²|m2)/, confidence: 0.92 },
  ],

  "wohnkosten_5j__kaltmiete": [
    { regex: /[Kk]altmiete[\s|:]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.90 },
  ],

  "wohnkosten_5j__nebenkosten": [
    { regex: /[Nn]ebenkosten[\s|:]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.88 },
  ],

  "wohnkosten_5j__gesamtmiete": [
    { regex: /[Gg]esamtmiete[\s|:]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, confidence: 0.90 },
  ],

  // ── Anlage 7 – Schuldenbereinigungsplan ──────────────────────────────────

  "schuldenbereinigungsplan7__datum": [
    { regex: /Datum\s+des\s+Schuldenbereinigungsplans[\s:]+(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 0.93 },
  ],

  "schuldenbereinigungsplan7__planart": [
    // Checkbox-Marker direkt vor dem Plantext (Text-Layer)
    { regex: /[✓✔☑■✗]\s*(Plan\s+mit\s+(?:Einmalzahlung\s+oder\s+festen|flexiblen)\s+Raten|Sonstiger\s+Plan)/i, confidence: 0.90 },
    // AcroForm-Wert als Text im Rohtext
    { regex: /\b((?:Plan\s+mit\s+)?(?:Einmalzahlung\s+oder\s+)?festen?\s+Raten|flexible\s+Raten|Sonstiger\s+Plan)\b/i, confidence: 0.75 },
  ],

  "schuldenbereinigungsplan7__erlaeuterungenAnlage7c": [
    { regex: /\[X\][^\n]*Erl[äa]uterungen\s+zur\s+vorgeschlagenen\s+Schuldenbereinigung/, confidence: 0.95, isCheckbox: true },
    { regex: /\[\s\][^\n]*Erl[äa]uterungen\s+zur\s+vorgeschlagenen\s+Schuldenbereinigung/, confidence: 0.92, isCheckbox: true },
  ],

  // ── Anlage 6 Gläubiger (pro INDEX 0..N-1, wird dynamisch gebildet) ────────
  // Gläubiger-Felder werden in static-extractor.ts separat behandelt.
  // Hier nur Template-Einträge für die Dokumentation.

  "glaeubigeranlage6__TEMPLATE__nameOderFirma": [
    { regex: /([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\d &.,\-]+(?:GmbH|AG|KG|eG|Ltd|SE|e\.V\.|mbH)?)/, confidence: 0.80 },
  ],

  "glaeubigeranlage6__TEMPLATE__summeForderungEur": [
    { regex: /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/, confidence: 0.85 },
  ],
};

// Indikatoren für "angekreuzt" in Checkbox/Radio-Feldern
export const CHECKED_MARKERS = ["[X]", "[x]", "[✓]", "[✗]", "[•]", "☑", "☒", "■", "(X)", "(x)"];
export const UNCHECKED_MARKERS = ["[ ]", "[ ]", "☐", "□", "○", "( )"];

export function isCheckedMarker(token: string): boolean {
  return CHECKED_MARKERS.some((m) => token.includes(m));
}

export function isUncheckedMarker(token: string): boolean {
  return UNCHECKED_MARKERS.some((m) => token.includes(m));
}
