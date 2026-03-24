/**
 * Erstellt die Word-Template-Datei für den Gläubiger-Serienbrief.
 *
 * Das Template verwendet {placeholder}-Syntax (docxtemplater-Format).
 * Es wird beim ersten Aufruf von ensureTemplate() als echte .docx-Datei
 * unter TEMPLATE_PATH gespeichert und kann in Word geöffnet/bearbeitet werden.
 */

import path from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import PizZip from "pizzip";

export const TEMPLATE_PATH = path.join(
  process.cwd(),
  "testdata",
  "templates",
  "glaeubigerAnschreiben-template.docx"
);

// ─── Word-XML ─────────────────────────────────────────────────────────────────
// Minimale, valide .docx-Struktur mit Geschäftsbrief-Layout.
// Alle {placeholder}-Variablen werden von docxtemplater befüllt.

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`;

// Minimale Styles für Schriftart und Absatzformatierung
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="120"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;

// Der eigentliche Briefinhalt mit {placeholder}-Variablen
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>

    <!-- Absender -->
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Insolvenzverwalter</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:t>Musterstraße 1 · 12345 Musterstadt</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:t>Tel.: 0621 / 000 000-0 · insolvenzverwalter@kanzlei.de</w:t></w:r>
    </w:p>

    <!-- Trennlinie (Leerzeile) -->
    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Empfänger (Name + Adresse) -->
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{glaeubigerName}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{glaeubigerAdresse}</w:t></w:r></w:p>

    <!-- Datum, Zeichen-Block -->
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:t>{datumHeute}</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:t xml:space="preserve">Ihr Zeichen: </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{ihrZeichen}</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:t xml:space="preserve">Unser Zeichen: </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{aktenzeichen}</w:t></w:r>
    </w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Betreff -->
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr>
        <w:t xml:space="preserve">Verbraucherinsolvenzverfahren &#8211; Gl&#228;ubigerbenachrichtigung</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr>
        <w:t xml:space="preserve">Schuldner: {schuldnerVorname} {schuldnerNachname}, {schuldnerPlzOrt}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr>
        <w:t xml:space="preserve">Amtsgericht {zustaendigesAmtsgericht} &#8211; Gl&#228;ubiger Nr. {glaeubigerNummer}</w:t>
      </w:r>
    </w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Anrede (personalisiert wenn Bevollmächtigter bekannt) -->
    <w:p><w:r><w:t>{anrede}</w:t></w:r></w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Einleitungstext -->
    <w:p>
      <w:r>
        <w:t xml:space="preserve">im oben bezeichneten Verbraucherinsolvenzverfahren &#252;ber das Verm&#246;gen des Schuldners </w:t>
      </w:r>
      <w:r><w:rPr><w:b/></w:rPr>
        <w:t xml:space="preserve">{schuldnerVorname} {schuldnerNachname}</w:t>
      </w:r>
      <w:r>
        <w:t xml:space="preserve">, {schuldnerAdresse}, {schuldnerPlzOrt},</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>zeige ich die Er&#246;ffnung des Insolvenzverfahrens an und bitte um Kenntnisnahme.</w:t>
      </w:r>
    </w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Forderungsaufstellung -->
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr>
        <w:t>Ihre angemeldete Forderung stellt sich wie folgt dar:</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr>
        <w:t xml:space="preserve">Forderungsgrund:          {forderungsgrund}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr>
        <w:t xml:space="preserve">Hauptforderung:           {hauptforderungEur}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr>
        <w:t xml:space="preserve">Zinsen (berechnet bis {zinsenBis}): {zinsenEur}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr>
        <w:t xml:space="preserve">Kosten:                   {kostenEur}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:b/></w:rPr>
        <w:t xml:space="preserve">Gesamtforderung:          {summeForderungEur}</w:t>
      </w:r>
    </w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Schlusstext -->
    <w:p>
      <w:r>
        <w:t xml:space="preserve">Ich bitte Sie, Forderungsanmeldungen und Korrespondenz unter dem oben genannten Aktenzeichen an meine Kanzlei zu richten. F&#252;r R&#252;ckfragen stehe ich Ihnen gerne zur Verf&#252;gung.</w:t>
      </w:r>
    </w:p>

    <w:p><w:r><w:t></w:t></w:r></w:p>

    <!-- Grußformel -->
    <w:p><w:r><w:t>Mit freundlichen Gr&#252;&#223;en</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Insolvenzverwalter</w:t></w:r></w:p>
    <w:p><w:r><w:t>Rechtsanwalt/Rechtsanw&#228;ltin</w:t></w:r></w:p>

    <!-- Seitenende -->
    <w:sectPr>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/>
    </w:sectPr>
  </w:body>
</w:document>`;

// ─── Template erstellen ───────────────────────────────────────────────────────

/**
 * Stellt sicher, dass die Template-Datei existiert.
 * Erstellt sie aus dem eingebetteten Word-XML wenn sie fehlt.
 */
export function ensureTemplate(): void {
  if (existsSync(TEMPLATE_PATH)) return;

  const dir = path.dirname(TEMPLATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", RELS_XML);
  zip.file("word/_rels/document.xml.rels", WORD_RELS_XML);
  zip.file("word/styles.xml", STYLES_XML);
  zip.file("word/document.xml", DOCUMENT_XML);

  const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(TEMPLATE_PATH, buffer);
}
