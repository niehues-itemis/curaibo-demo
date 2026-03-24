/** Server-only: file I/O for namespace configs. Do NOT import in Client Components. */
import fs from "fs/promises";
import path from "path";
import type { NamespaceConfig } from "@/lib/tags";

const NS_FILE = path.join(process.cwd(), "data", "namespaces.json");

export async function readNamespaces(): Promise<NamespaceConfig[]> {
  const raw = await fs.readFile(NS_FILE, "utf-8");
  const data = JSON.parse(raw) as { namespaces: NamespaceConfig[] };
  return data.namespaces;
}

export async function writeNamespaces(namespaces: NamespaceConfig[]): Promise<void> {
  await fs.writeFile(NS_FILE, JSON.stringify({ namespaces }, null, 2), "utf-8");
}
