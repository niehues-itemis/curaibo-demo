/**
 * Dokument-Kategorisierungssystem für CURAIBO.
 *
 * Die Kategorien werden als Tags im bestehenden Tag-System gespeichert,
 * kodiert über Namespace-Hierarchie:
 *   - "1. Stammakte"       → namespace: "dokument/kategorie",           name: "stammakte"
 *   - "1.1 Gerichtsakte"   → namespace: "dokument/kategorie/stammakte", name: "gerichtsakte"
 *
 * Client-safe: Keine Node.js-Importe. Seeding → @/lib/dokument-kategorien-seed
 */

import type { Tag, TagRef } from "@/lib/tags";

// ─────────────────────────────────────────────────────────────────────────────
// Seed-Daten (einmalig zum Befüllen von tags.json / namespaces.json)
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedEntry {
  namespace: string;
  name: string;
  label: string;
  color: string;
}

export const DOKUMENT_KATEGORIE_SEED: SeedEntry[] = [
  // ── Top-Level (namespace: "dokument/kategorie") ──────────────────────────
  { namespace: "dokument/kategorie", name: "stammakte",               label: "Stammakte",                          color: "blue" },
  { namespace: "dokument/kategorie", name: "schuldner-gesellschaft",  label: "Schuldner/Gesellschaft",             color: "teal" },
  { namespace: "dokument/kategorie", name: "vertraege",               label: "Verträge",                           color: "green" },
  { namespace: "dokument/kategorie", name: "bewegliches-av",          label: "Bewegliches Anlagevermögen",         color: "yellow" },
  { namespace: "dokument/kategorie", name: "unbewegliches-av",        label: "Unbewegliches Anlagevermögen",       color: "amber" },
  { namespace: "dokument/kategorie", name: "kreditinstitute",         label: "Kreditinstitute/liquide Mittel",     color: "orange" },
  { namespace: "dokument/kategorie", name: "forderungen",             label: "Forderungseinzug/Prozesse",          color: "red" },
  { namespace: "dokument/kategorie", name: "betriebsfuehrung",        label: "Betriebsfortführung/Abwicklung",     color: "rose" },
  { namespace: "dokument/kategorie", name: "insolvenzspezifisch",     label: "Insolvenzspezifische Unterlagen",    color: "purple" },
  { namespace: "dokument/kategorie", name: "arbeitnehmer",            label: "Arbeitnehmer",                       color: "violet" },
  { namespace: "dokument/kategorie", name: "finanzamt",               label: "Finanzamt/Steuern",                  color: "indigo" },
  { namespace: "dokument/kategorie", name: "tabellenfuehrung",        label: "Tabellenführung/Verbindlichkeiten",  color: "sky" },
  { namespace: "dokument/kategorie", name: "verfahrensbuchhaltung",   label: "Verfahrensbuchhaltung",              color: "cyan" },
  { namespace: "dokument/kategorie", name: "masseglaeubigers",        label: "Massegläubiger § 55 InsO",           color: "emerald" },
  { namespace: "dokument/kategorie", name: "insolvenzplan",           label: "Insolvenzplan",                      color: "lime" },
  { namespace: "dokument/kategorie", name: "glaubigerausschuss",      label: "Gläubigerausschuss",                 color: "gray" },
  { namespace: "dokument/kategorie", name: "recherche",               label: "Recherche/Aktenvermerke",            color: "slate" },
  { namespace: "dokument/kategorie", name: "rechnungen",              label: "Rechnungen",                         color: "zinc" },
  { namespace: "dokument/kategorie", name: "unbekannt",               label: "Nicht klassifiziert",                color: "stone" },

  // ── Sub-Level: Stammakte ─────────────────────────────────────────────────
  { namespace: "dokument/kategorie/stammakte", name: "gerichtsakte",             label: "Gerichtsakte",                           color: "blue" },
  { namespace: "dokument/kategorie/stammakte", name: "beschluesse",              label: "Beschlüsse/Bestallung",                  color: "blue" },
  { namespace: "dokument/kategorie/stammakte", name: "gerichtskosten",           label: "Festsetzer/Gerichtskosten",              color: "blue" },
  { namespace: "dokument/kategorie/stammakte", name: "korrespondenz-gericht",    label: "Korrespondenz mit dem Insolvenzgericht", color: "blue" },
  { namespace: "dokument/kategorie/stammakte", name: "glaeubigeranschreiben",    label: "Gläubigeranschreiben",                   color: "blue" },

  // ── Sub-Level: Schuldner/Gesellschaft ────────────────────────────────────
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "korrespondenz-schuldner",  label: "Korrespondenz mit Schuldner",            color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "ermittlungsbogen",         label: "Ermittlungsbogen",                       color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "arbeitgeber-rententraeger", label: "Arbeitgeber/Rententräger",              color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "unterhaltspflichten",      label: "Unterhaltspflichten und Belege",         color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "gesellschaftsrecht",       label: "Gesellschaftsrechtliche Unterlagen",     color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "handelsregister",          label: "Handelsregister/Gewerbeamt",             color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "kammern-berufsstaende",    label: "Kammern/Berufsständische Organisationen", color: "teal" },
  { namespace: "dokument/kategorie/schuldner-gesellschaft", name: "staatsanwaltschaft",       label: "Staatsanwaltschaft/Polizei",             color: "teal" },

  // ── Sub-Level: Verträge ──────────────────────────────────────────────────
  { namespace: "dokument/kategorie/vertraege", name: "mietvertraege-privat",       label: "Mietvertragsunterlagen privat",        color: "green" },
  { namespace: "dokument/kategorie/vertraege", name: "mietvertraege-geschaeftlich", label: "Mietvertragsunterlagen geschäftlich", color: "green" },
  { namespace: "dokument/kategorie/vertraege", name: "versorger",                  label: "Versorger (Strom, Wasser, ...)",      color: "green" },
  { namespace: "dokument/kategorie/vertraege", name: "versicherungen",             label: "Versicherungen",                      color: "green" },
  { namespace: "dokument/kategorie/vertraege", name: "sonstige-vertraege",         label: "Sonstige Verträge",                   color: "green" },

  // ── Sub-Level: Bewegliches Anlagevermögen ────────────────────────────────
  { namespace: "dokument/kategorie/bewegliches-av", name: "betriebs-ausstattung",      label: "Betriebs- und Geschäftsausstattung",     color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "technische-anlagen",        label: "Technische Anlagen und Maschinen",       color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "vorraete-warenlager",       label: "Vorräte/Warenlager",                     color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "korrespondenz-sachverst",   label: "Korrespondenz mit Sachverständigen",     color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "erwerbsinteressenten",      label: "Erwerbsinteressenten",                   color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "anteile-unternehmen",       label: "Anteile an Unternehmen",                 color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "konzessionen-schutzrechte", label: "Konzessionen/Schutzrechte",              color: "yellow" },
  { namespace: "dokument/kategorie/bewegliches-av", name: "fahrzeuge",                 label: "Fahrzeuge",                              color: "yellow" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tree-Hilfsfunktionen (client-safe)
// ─────────────────────────────────────────────────────────────────────────────

export interface KategorieTreeNode {
  tag: Tag;
  tagRef: TagRef;
  children: KategorieTreeNode[];
}

/** Baut rekursiv einen Baum aus allen Tags ab dem gegebenen Parent-Namespace. */
function buildLevel(allTags: Tag[], parentNamespace: string): KategorieTreeNode[] {
  return allTags
    .filter((t) => t.namespace === parentNamespace)
    .map((tag) => {
      const tagRef = `${parentNamespace}/${tag.name}`;
      return {
        tag,
        tagRef,
        children: buildLevel(allTags, tagRef), // namespace des Kindes = tagRef des Parents
      };
    });
}

/** Gibt alle Nodes zurück deren namespace mit "dokument/kategorie" beginnt, als Baum. */
export function buildDokumentKategorienTree(allTags: Tag[]): KategorieTreeNode[] {
  return buildLevel(allTags, "dokument/kategorie");
}

/** Gibt alle TagRefs des Nodes und seiner Kinder zurück (für Filter-Logik). */
export function getDescendantTagRefs(node: KategorieTreeNode): string[] {
  return [node.tagRef, ...node.children.flatMap(getDescendantTagRefs)];
}

/** Sucht einen Node anhand seines TagRef (rekursiv). */
export function findNodeByRef(
  nodes: KategorieTreeNode[],
  tagRef: string
): KategorieTreeNode | null {
  for (const node of nodes) {
    if (node.tagRef === tagRef) return node;
    const found = findNodeByRef(node.children, tagRef);
    if (found) return found;
  }
  return null;
}

/** Gibt den TagRef des direkten Parent-Nodes zurück, oder null wenn top-level. */
export function getParentTagRef(tagRef: string): string | null {
  const lastSlash = tagRef.lastIndexOf("/");
  // "dokument/kategorie/stammakte" → parent wäre "dokument/kategorie" (= root)
  // "dokument/kategorie/stammakte/gerichtsakte" → parent = "dokument/kategorie/stammakte"
  if (lastSlash === -1) return null;
  const parent = tagRef.slice(0, lastSlash);
  // Nur zurückgeben wenn es kein Root-Namespace-Segment ist
  return parent === "dokument/kategorie" ? null : parent;
}

/** TagRef der "Nicht klassifiziert"-Kategorie */
export const UNBEKANNT_TAG_REF = "dokument/kategorie/unbekannt";
