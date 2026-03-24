import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { z } from "zod";
import type { Tag } from "@/lib/tags";
import {
  buildDokumentKategorienTree,
  getDescendantTagRefs,
  UNBEKANNT_TAG_REF,
} from "@/lib/dokument-kategorien";
import type { KategorieTreeNode } from "@/lib/dokument-kategorien";

const KategorienSchema = z.object({
  tagRefs: z
    .array(z.string())
    .max(3)
    .describe(
      "Liste der zutreffenden Kategorie-TagRefs (z.B. ['dokument/kategorie/stammakte/gerichtsakte']). " +
        "Maximal 3. Bevorzuge spezifische Sub-Kategorien gegenüber Top-Level-Kategorien. " +
        "Leeres Array wenn keine Kategorie passt."
    ),
  reason: z.string().describe("Kurze Begründung der Zuordnung"),
});

/** Formatiert den Baum als kompakte Prompt-Liste */
function formatTreeForPrompt(nodes: KategorieTreeNode[], indent = 0): string {
  return nodes
    .map((node) => {
      const prefix = "  ".repeat(indent);
      const line = `${prefix}- ${node.tag.label} (ref: ${node.tagRef})`;
      if (node.children.length > 0) {
        return line + "\n" + formatTreeForPrompt(node.children, indent + 1);
      }
      return line;
    })
    .join("\n");
}

/**
 * Klassifiziert ein Dokument anhand des bereits erzeugten Markdown-Inhalts
 * und gibt passende Kategorie-TagRefs zurück.
 *
 * Nimmt das Markdown aus document-to-markdown.ts entgegen, um doppeltes
 * Konvertieren zu vermeiden.
 */
export async function classifyDocumentKategorien(
  markdownContent: string,
  availableTags: Tag[]
): Promise<string[]> {
  const content = markdownContent.slice(0, 3000).trim();

  if (content.length < 50) {
    return [UNBEKANNT_TAG_REF];
  }

  // Valide TagRefs aus den verfügbaren Tags aufbauen
  const validRefs = new Set(availableTags.map((t) => `${t.namespace}/${t.name}`));

  // Nur Dokument-Kategorie-Tags in den Prompt
  const categoryTags = availableTags.filter((t) =>
    t.namespace.startsWith("dokument/kategorie")
  );
  const tree = buildDokumentKategorienTree(categoryTags);
  const treeText = formatTreeForPrompt(tree);

  try {
    const { object } = await generateObject({
      model: await getModel("fast"),
      schema: KategorienSchema,
      prompt: `Du bist ein Klassifizierungssystem für Insolvenzakten-Dokumente.

Weise dem folgenden Dokument die passenden Kategorien aus der Klassifizierungsliste zu.
Verwende bevorzugt spezifische Sub-Kategorien (tiefere Ebene). Maximal 3 Kategorien.

Klassifizierungsliste:
${treeText}

Dokumentinhalt (Auszug):
${content}

Antworte mit dem JSON-Schema.`,
    });

    // Halluzinierte Refs filtern
    const filtered = object.tagRefs.filter((ref) => validRefs.has(ref));
    return filtered.length > 0 ? filtered : [UNBEKANNT_TAG_REF];
  } catch (err) {
    console.warn("[document-category-classifier] Fehler:", err);
    return [UNBEKANNT_TAG_REF];
  }
}
