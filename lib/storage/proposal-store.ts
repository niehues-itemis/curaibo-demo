import { readFile, writeFile, readdir } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { FieldProposal } from "@/lib/extraction/types";
import { updateCaseField } from "@/lib/storage/case-store";

const AKTEN_DIR = path.join(process.cwd(), "data", "akten");
const INDEX_FILE = path.join(AKTEN_DIR, "_index.json");

function readIndex(): Record<string, string> {
  if (!existsSync(INDEX_FILE)) return {};
  try { return JSON.parse(readFileSync(INDEX_FILE, "utf-8")); } catch { return {}; }
}

function proposalsFile(caseId: string): string | null {
  const slug = readIndex()[caseId];
  if (!slug) return null;
  return path.join(AKTEN_DIR, slug, "proposals.json");
}

export async function loadProposals(caseId: string): Promise<FieldProposal[]> {
  const file = proposalsFile(caseId);
  if (!file || !existsSync(file)) return [];
  try { return JSON.parse(await readFile(file, "utf-8")); } catch { return []; }
}

export async function saveProposals(caseId: string, proposals: FieldProposal[]): Promise<void> {
  const file = proposalsFile(caseId);
  if (!file) return;
  await writeFile(file, JSON.stringify(proposals, null, 2), "utf-8");
}

export async function addProposals(caseId: string, newProposals: FieldProposal[]): Promise<void> {
  if (newProposals.length === 0) return;
  const existing = await loadProposals(caseId);
  // Deduplicate: same sourceDocument + fieldId + instanceIndex
  const key = (p: FieldProposal) =>
    `${p.sourceDocument.folder}/${p.sourceDocument.filename}::${p.groupId}::${p.fieldId}::${p.instanceIndex ?? ""}`;
  const existingKeys = new Set(existing.map(key));
  const toAdd = newProposals.filter((p) => !existingKeys.has(key(p)));
  await saveProposals(caseId, [...existing, ...toAdd]);
}

export async function updateProposal(
  caseId: string,
  proposalId: string,
  status: "accepted" | "rejected"
): Promise<FieldProposal | null> {
  const proposals = await loadProposals(caseId);
  const idx = proposals.findIndex((p) => p.id === proposalId);
  if (idx === -1) return null;
  proposals[idx] = { ...proposals[idx], status, reviewedAt: new Date().toISOString() };
  await saveProposals(caseId, proposals);

  if (status === "accepted") {
    await updateCaseField(caseId, proposals[idx].groupId, proposals[idx].fieldId, proposals[idx].instanceIndex ?? null, {
      status: "manually_corrected",
      correctedValue: proposals[idx].proposedValue,
    });
  }
  return proposals[idx];
}

export async function listAllPendingProposals(): Promise<
  { caseId: string; schuldnerName: string; aktenzeichen: string; aktenzeichenDisplay: string; proposals: FieldProposal[] }[]
> {
  if (!existsSync(AKTEN_DIR)) return [];
  const result = [];
  let slugs: string[] = [];
  try { slugs = await readdir(AKTEN_DIR); } catch { return []; }
  const index = readIndex();
  const slugToCaseId = Object.fromEntries(Object.entries(index).map(([id, s]) => [s, id]));

  for (const slug of slugs) {
    if (slug.startsWith("_")) continue;
    const propFile = path.join(AKTEN_DIR, slug, "proposals.json");
    if (!existsSync(propFile)) continue;
    let proposals: FieldProposal[] = [];
    try { proposals = JSON.parse(await readFile(propFile, "utf-8")); } catch { continue; }
    const pending = proposals.filter((p) => p.status === "pending");
    if (pending.length === 0) continue;
    const caseId = slugToCaseId[slug];
    if (!caseId) continue;
    let schuldnerName = "";
    let aktenzeichenDisplay = slug;
    try {
      const c = JSON.parse(await readFile(path.join(AKTEN_DIR, slug, "case.json"), "utf-8"));
      schuldnerName = c.schuldnerName ?? "";
      aktenzeichenDisplay = c.aktenzeichenDisplay ?? slug;
    } catch { /* skip */ }
    result.push({ caseId, schuldnerName, aktenzeichen: slug, aktenzeichenDisplay, proposals: pending });
  }
  return result;
}

export async function removeProposalsForDocument(
  caseId: string,
  folder: string,
  filename: string
): Promise<void> {
  const proposals = await loadProposals(caseId);
  const filtered = proposals.filter(
    (p) => !(p.sourceDocument.folder === folder && p.sourceDocument.filename === filename)
  );
  if (filtered.length !== proposals.length) {
    await saveProposals(caseId, filtered);
  }
}

// Re-export uuidv4 usage to avoid unused import warning
export { uuidv4 };
