/** Server-only: file I/O for the tag registry. Do NOT import in Client Components. */
import fs from "fs/promises";
import path from "path";
import type { Tag } from "@/lib/tags";

export type { Tag, TagRef } from "@/lib/tags";
export { parseTagRef, getTagsByNamespace, lookupTag, resolveTags } from "@/lib/tags";

const TAGS_FILE = path.join(process.cwd(), "data", "tags.json");

export async function readTags(): Promise<Tag[]> {
  const raw = await fs.readFile(TAGS_FILE, "utf-8");
  const data = JSON.parse(raw) as { tags: Tag[] };
  return data.tags;
}

export async function writeTags(tags: Tag[]): Promise<void> {
  await fs.writeFile(TAGS_FILE, JSON.stringify({ tags }, null, 2), "utf-8");
}
