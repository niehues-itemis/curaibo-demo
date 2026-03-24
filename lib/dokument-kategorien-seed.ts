/**
 * Server-only: Seeding der Dokument-Kategorien in tags.json / namespaces.json.
 * Nicht in Client-Komponenten importieren.
 */

import { readNamespaces, writeNamespaces } from "@/lib/storage/namespace-store";
import { readTags, writeTags } from "@/lib/storage/tag-store";
import { DOKUMENT_KATEGORIE_SEED } from "@/lib/dokument-kategorien";
import type { Tag } from "@/lib/tags";

export async function ensureDokumentKategorienSeeded(): Promise<void> {
  const [existingNamespaces, existingTags] = await Promise.all([
    readNamespaces(),
    readTags(),
  ]);

  const existingNsSet = new Set(existingNamespaces.map((ns) => ns.namespace));
  const existingTagIds = new Set(existingTags.map((t) => t.id));

  // Fehlende Namespaces ergänzen
  const allSeedNamespaces = new Set(DOKUMENT_KATEGORIE_SEED.map((e) => e.namespace));
  allSeedNamespaces.add("dokument/tag");

  const missingNamespaces = Array.from(allSeedNamespaces)
    .filter((ns) => !existingNsSet.has(ns))
    .map((ns) => ({
      namespace: ns,
      label: ns.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      exclusive: false,
    }));

  // Fehlende Tags ergänzen
  const missingTags: Tag[] = DOKUMENT_KATEGORIE_SEED
    .map((entry) => ({
      id: `dkat-${entry.namespace.replace(/\//g, "-")}-${entry.name}`,
      namespace: entry.namespace,
      name: entry.name,
      label: entry.label,
      color: entry.color,
    }))
    .filter((tag) => !existingTagIds.has(tag.id));

  if (missingNamespaces.length > 0) {
    await writeNamespaces([...existingNamespaces, ...missingNamespaces]);
  }
  if (missingTags.length > 0) {
    await writeTags([...existingTags, ...missingTags]);
  }
}
