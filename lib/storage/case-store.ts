import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rm,
  copyFile,
} from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { CaseFile, AkteListItem, FieldStatus } from "@/lib/extraction/types";
import {
  sanitizeAktenzeichen,
  generateAktenzeichen,
  extractAktenzeichenFromCase,
  extractSchuldnerName,
  extractVerfahrensart,
} from "@/lib/storage/aktenzeichen";

// ─────────────────────────────────────────────────────────────────────────────
// Pfad-Konstanten
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_DIR = path.join(process.cwd(), "data", "cases");
const AKTEN_DIR = path.join(process.cwd(), "data", "akten");
const EINGANG_DIR = path.join(process.cwd(), "data", "eingang");
const INDEX_FILE = path.join(AKTEN_DIR, "_index.json");

// ─────────────────────────────────────────────────────────────────────────────
// Index-Verwaltung (caseId → aktenzeichen-slug)
// ─────────────────────────────────────────────────────────────────────────────

async function loadIndex(): Promise<Record<string, string>> {
  if (!existsSync(INDEX_FILE)) return {};
  try {
    return JSON.parse(await readFile(INDEX_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function saveIndex(index: Record<string, string>): Promise<void> {
  await mkdir(AKTEN_DIR, { recursive: true });
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

async function addToIndex(caseId: string, slug: string): Promise<void> {
  const index = await loadIndex();
  index[caseId] = slug;
  await saveIndex(index);
}

async function removeFromIndex(caseId: string): Promise<void> {
  const index = await loadIndex();
  delete index[caseId];
  await saveIndex(index);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pfad-Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getAktenDir(slug: string): string {
  return path.join(AKTEN_DIR, slug);
}

async function findCaseDir(caseId: string): Promise<string | null> {
  const index = await loadIndex();
  const slug = index[caseId];
  if (slug) {
    const dir = getAktenDir(slug);
    if (existsSync(path.join(dir, "case.json"))) return dir;
  }

  // Legacy-Fallback: Akte in alter Struktur → on-demand migrieren
  const legacyPath = path.join(LEGACY_DIR, `${caseId}.json`);
  if (existsSync(legacyPath)) {
    return migrateLegacyCase(caseId);
  }

  return null;
}

/**
 * Migriert eine Legacy-Akte (data/cases/[id].json) in die neue Ordnerstruktur
 * (data/akten/[slug]/). Wird genau einmal aufgerufen, danach kennt der Index die Akte.
 */
async function migrateLegacyCase(caseId: string): Promise<string | null> {
  const legacyJsonPath = path.join(LEGACY_DIR, `${caseId}.json`);
  const legacyPdfPath = path.join(LEGACY_DIR, `${caseId}.pdf`);

  try {
    const raw = await readFile(legacyJsonPath, "utf-8");
    const caseData = JSON.parse(raw) as CaseFile;

    // Slug aus bestehendem Aktenzeichen ableiten (keine Neu-Generierung)
    let slug = caseData.aktenzeichen
      ? sanitizeAktenzeichen(caseData.aktenzeichen)
      : null;

    if (!slug) {
      const resolved = await resolveSlug(caseData);
      slug = resolved.slug;
    } else {
      // Kollisionsschutz: existiert dieser Slug bereits für eine ANDERE Akte?
      let finalSlug = slug;
      let counter = 2;
      while (existsSync(path.join(AKTEN_DIR, finalSlug, "case.json"))) {
        const existing = JSON.parse(
          readFileSync(path.join(AKTEN_DIR, finalSlug, "case.json"), "utf-8")
        ) as CaseFile;
        if (existing.caseId === caseId) break; // gleiche Akte, kein Konflikt
        finalSlug = `${slug}_${counter}`;
        counter++;
      }
      slug = finalSlug;
    }

    await ensureAkteDirs(slug);

    const updatedCase: CaseFile = { ...caseData, aktenzeichen: slug };
    await writeFile(
      path.join(AKTEN_DIR, slug, "case.json"),
      JSON.stringify(updatedCase, null, 2),
      "utf-8"
    );

    if (existsSync(legacyPdfPath)) {
      await copyFile(legacyPdfPath, path.join(AKTEN_DIR, slug, "original.pdf"));
    }

    await addToIndex(caseId, slug);
    console.log(`[migration] Akte ${caseId} → ${slug}`);
    return getAktenDir(slug);
  } catch (err) {
    console.error(`[migration] Fehler bei Akte ${caseId}:`, err);
    return null;
  }
}

export async function ensureAkteDirs(slug: string): Promise<void> {
  const base = getAktenDir(slug);
  await mkdir(base, { recursive: true });
  await mkdir(path.join(base, "eingehend"), { recursive: true });
  await mkdir(path.join(base, "ausgehend"), { recursive: true });
  await mkdir(path.join(base, "zu_verarbeiten"), { recursive: true });
  await mkdir(path.join(base, ".metadata", "eingehend"), { recursive: true });
  await mkdir(path.join(base, ".metadata", "ausgehend"), { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Aktenzeichen-Generierung
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSlug(caseData: Omit<CaseFile, "caseId">): Promise<{
  slug: string;
  aktenzeichenDisplay: string;
}> {
  const raw = extractAktenzeichenFromCase(caseData);
  if (raw) {
    const slug = sanitizeAktenzeichen(raw);
    // Kollisionshandling
    let finalSlug = slug;
    let counter = 2;
    while (existsSync(path.join(AKTEN_DIR, finalSlug, "case.json"))) {
      finalSlug = `${slug}_${counter}`;
      counter++;
    }
    return { slug: finalSlug, aktenzeichenDisplay: raw };
  }

  // Auto-Aktenzeichen generieren
  await mkdir(AKTEN_DIR, { recursive: true });
  let dirs: string[] = [];
  try {
    dirs = await readdir(AKTEN_DIR);
  } catch {
    dirs = [];
  }
  const insCount = dirs.filter((d) => d.startsWith("INS-")).length;
  const year = new Date().getFullYear();
  let slug = generateAktenzeichen(year, insCount + 1);
  let counter = insCount + 2;
  while (existsSync(path.join(AKTEN_DIR, slug, "case.json"))) {
    slug = generateAktenzeichen(year, counter);
    counter++;
  }
  return { slug, aktenzeichenDisplay: slug };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kern-CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function saveCase(data: Omit<CaseFile, "caseId">): Promise<string> {
  const caseId = uuidv4();

  const { slug, aktenzeichenDisplay } = await resolveSlug(data);
  await ensureAkteDirs(slug);

  const caseFile: CaseFile = {
    caseId,
    ...data,
    aktenzeichen: slug,
    aktenzeichenDisplay,
    schuldnerName: extractSchuldnerName(data),
    verfahrensart: extractVerfahrensart(data),
    tags: data.tags ?? ["akten/status/neu"],
  };

  const filePath = path.join(AKTEN_DIR, slug, "case.json");
  await writeFile(filePath, JSON.stringify(caseFile, null, 2), "utf-8");
  await addToIndex(caseId, slug);

  return caseId;
}

export async function loadCase(caseId: string): Promise<CaseFile | null> {
  // Primär: neue Ordnerstruktur via Index
  const dir = await findCaseDir(caseId);
  if (dir) {
    try {
      const raw = await readFile(path.join(dir, "case.json"), "utf-8");
      return JSON.parse(raw) as CaseFile;
    } catch {
      return null;
    }
  }

  // Fallback: Legacy-Struktur
  const legacyPath = path.join(LEGACY_DIR, `${caseId}.json`);
  if (existsSync(legacyPath)) {
    try {
      const raw = await readFile(legacyPath, "utf-8");
      return JSON.parse(raw) as CaseFile;
    } catch {
      return null;
    }
  }

  return null;
}

export async function updateCaseField(
  caseId: string,
  groupId: string,
  fieldId: string,
  instanceIndex: number | null,
  update: { status: FieldStatus; correctedValue?: string | null }
): Promise<CaseFile> {
  const caseData = await loadCase(caseId);
  if (!caseData) throw new Error(`Case not found: ${caseId}`);

  const group = caseData.fieldGroups.find((g) => g.groupId === groupId);
  if (!group) throw new Error(`Group not found: ${groupId}`);

  let field = null;
  if (group.isArray && instanceIndex !== null && group.instances) {
    field = group.instances[instanceIndex]?.find((f) => f.fieldId === fieldId);
  } else if (group.fields) {
    field = group.fields.find((f) => f.fieldId === fieldId);
  }

  if (!field) throw new Error(`Field not found: ${fieldId}`);

  field.status = update.status;
  if (update.correctedValue !== undefined) {
    field.correctedValue = update.correctedValue ?? undefined;
  }
  field.reviewedAt = new Date().toISOString();

  // Gesamt-Status neu berechnen
  const allFields = getAllFields(caseData);
  const anyUnreviewed = allFields.some((f) => f.status === "extracted_unreviewed");
  caseData.status = anyUnreviewed ? "review_in_progress" : "review_complete";

  // In gefundenem Pfad speichern
  const dir = await findCaseDir(caseId);
  if (dir) {
    await writeFile(path.join(dir, "case.json"), JSON.stringify(caseData, null, 2), "utf-8");
  } else {
    // Legacy-Fallback
    const legacyPath = path.join(LEGACY_DIR, `${caseId}.json`);
    await writeFile(legacyPath, JSON.stringify(caseData, null, 2), "utf-8");
  }

  return caseData;
}

export async function deleteCase(caseId: string): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    await removeFromIndex(caseId);
    return;
  }
  // Legacy-Fallback
  const jsonPath = path.join(LEGACY_DIR, `${caseId}.json`);
  const pdfPath = path.join(LEGACY_DIR, `${caseId}.pdf`);
  if (existsSync(jsonPath)) await unlink(jsonPath);
  if (existsSync(pdfPath)) await unlink(pdfPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF-Speicherung
// ─────────────────────────────────────────────────────────────────────────────

export async function savePdf(caseId: string, buffer: Buffer): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (dir) {
    await writeFile(path.join(dir, "original.pdf"), buffer);
    return;
  }
  // Legacy-Fallback
  if (!existsSync(LEGACY_DIR)) await mkdir(LEGACY_DIR, { recursive: true });
  await writeFile(path.join(LEGACY_DIR, `${caseId}.pdf`), buffer);
}

export function hasPdf(caseId: string): boolean {
  // Sync-Check: erst via Index schauen, dann Legacy
  const indexRaw = existsSync(INDEX_FILE) ? readFileSync(INDEX_FILE, "utf-8") : "{}";
  const index: Record<string, string> = JSON.parse(indexRaw);
  const slug = index[caseId];
  if (slug) {
    return existsSync(path.join(AKTEN_DIR, slug, "original.pdf"));
  }
  return existsSync(path.join(LEGACY_DIR, `${caseId}.pdf`));
}

export function loadPdf(caseId: string): Buffer | null {
  const indexRaw = existsSync(INDEX_FILE) ? readFileSync(INDEX_FILE, "utf-8") : "{}";
  const index: Record<string, string> = JSON.parse(indexRaw);
  const slug = index[caseId];
  if (slug) {
    const p = path.join(AKTEN_DIR, slug, "original.pdf");
    if (existsSync(p)) return readFileSync(p);
  }
  const legacyPath = path.join(LEGACY_DIR, `${caseId}.pdf`);
  if (existsSync(legacyPath)) return readFileSync(legacyPath);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dokument-Verwaltung (eingehend / ausgehend / zu_verarbeiten)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveIncomingDocument(
  caseId: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) throw new Error(`Case not found: ${caseId}`);
  await writeFile(path.join(dir, "eingehend", filename), buffer);
}

export async function saveOutgoingDocument(
  caseId: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) throw new Error(`Case not found: ${caseId}`);
  await writeFile(path.join(dir, "ausgehend", filename), buffer);
}

export async function saveQueuedDocument(
  caseId: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) throw new Error(`Case not found: ${caseId}`);
  await writeFile(path.join(dir, "zu_verarbeiten", filename), buffer);
}

export async function moveQueuedToIncoming(
  caseId: string,
  filename: string
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) throw new Error(`Case not found: ${caseId}`);
  const src = path.join(dir, "zu_verarbeiten", filename);
  const dst = path.join(dir, "eingehend", filename);
  if (existsSync(src)) await copyFile(src, dst);
  if (existsSync(src)) await unlink(src);
}

export async function deleteDocument(
  caseId: string,
  folder: "eingehend" | "ausgehend",
  filename: string
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) throw new Error(`Case not found: ${caseId}`);

  const docPath = path.join(dir, folder, filename);
  if (existsSync(docPath)) await unlink(docPath);

  // Metadata-Markdown mitlöschen
  const mdPath = path.join(dir, ".metadata", folder, `${filename}.md`);
  if (existsSync(mdPath)) await unlink(mdPath);

  // Kategorie-Eintrag mitlöschen
  const katPath = path.join(dir, ".metadata", "kategorien.json");
  if (existsSync(katPath)) {
    try {
      const raw = await readFile(katPath, "utf-8");
      const map: Record<string, string[]> = JSON.parse(raw);
      delete map[`${folder}/${filename}`];
      await writeFile(katPath, JSON.stringify(map, null, 2), "utf-8");
    } catch {
      // non-fatal
    }
  }

  // Proposals für dieses Dokument mitlöschen (zirkulärer Import vermieden via lazy require)
  const { removeProposalsForDocument } = await import("@/lib/storage/proposal-store");
  await removeProposalsForDocument(caseId, folder, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dokument-Tags (Kategorien)
// ─────────────────────────────────────────────────────────────────────────────

/** Lädt die Kategorie-Tag-Map für alle Dokumente einer Akte. */
export async function loadDokumentTagMap(
  caseId: string
): Promise<Record<string, string[]>> {
  const dir = await findCaseDir(caseId);
  if (!dir) return {};
  const katPath = path.join(dir, ".metadata", "kategorien.json");
  if (!existsSync(katPath)) return {};
  try {
    return JSON.parse(await readFile(katPath, "utf-8"));
  } catch {
    return {};
  }
}

/** Setzt die Kategorie-Tags für ein einzelnes Dokument (überschreibt vollständig). */
export async function updateDocumentTags(
  caseId: string,
  folder: "eingehend" | "ausgehend",
  filename: string,
  tagRefs: string[]
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) return;
  const metaDir = path.join(dir, ".metadata");
  await mkdir(metaDir, { recursive: true });
  const katPath = path.join(metaDir, "kategorien.json");
  let map: Record<string, string[]> = {};
  if (existsSync(katPath)) {
    try {
      map = JSON.parse(await readFile(katPath, "utf-8"));
    } catch {
      map = {};
    }
  }
  map[`${folder}/${filename}`] = tagRefs;
  await writeFile(katPath, JSON.stringify(map, null, 2), "utf-8");
}

export async function listDocuments(caseId: string): Promise<{
  eingehend: string[];
  ausgehend: string[];
  zu_verarbeiten: string[];
}> {
  const dir = await findCaseDir(caseId);
  if (!dir) return { eingehend: [], ausgehend: [], zu_verarbeiten: [] };

  const readDir = async (sub: string): Promise<string[]> => {
    const p = path.join(dir, sub);
    if (!existsSync(p)) return [];
    try {
      return (await readdir(p)).filter((f) => !f.startsWith("."));
    } catch {
      return [];
    }
  };

  return {
    eingehend: await readDir("eingehend"),
    ausgehend: await readDir("ausgehend"),
    zu_verarbeiten: await readDir("zu_verarbeiten"),
  };
}

export async function saveUnassignedDocument(
  filename: string,
  buffer: Buffer
): Promise<void> {
  await mkdir(EINGANG_DIR, { recursive: true });
  await writeFile(path.join(EINGANG_DIR, filename), buffer);
}

export async function listUnassignedDocuments(): Promise<
  { filename: string; size: number; uploadedAt: string }[]
> {
  await mkdir(EINGANG_DIR, { recursive: true });
  let files: string[] = [];
  try {
    files = await readdir(EINGANG_DIR);
  } catch {
    return [];
  }
  const results = [];
  for (const f of files) {
    if (f.startsWith(".") || f.startsWith("_")) continue;
    try {
      const { statSync } = await import("fs");
      const stat = statSync(path.join(EINGANG_DIR, f));
      results.push({
        filename: f,
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      });
    } catch {
      // skip
    }
  }
  return results.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function readUnassignedDocument(filename: string): Promise<Buffer> {
  return readFile(path.join(EINGANG_DIR, filename));
}

export async function deleteUnassignedDocument(filename: string): Promise<void> {
  await unlink(path.join(EINGANG_DIR, filename));
}

// ─────────────────────────────────────────────────────────────────────────────
// Listenansicht
// ─────────────────────────────────────────────────────────────────────────────

export interface CaseListItem extends AkteListItem {}

export async function listCases(): Promise<AkteListItem[]> {
  const items: AkteListItem[] = [];

  // Neue Ordnerstruktur
  await mkdir(AKTEN_DIR, { recursive: true });
  let aktenDirs: string[] = [];
  try {
    aktenDirs = await readdir(AKTEN_DIR);
  } catch {
    aktenDirs = [];
  }

  for (const entry of aktenDirs) {
    if (entry.startsWith("_")) continue; // _index.json etc. überspringen
    const casePath = path.join(AKTEN_DIR, entry, "case.json");
    if (!existsSync(casePath)) continue;
    try {
      const raw = await readFile(casePath, "utf-8");
      const c = JSON.parse(raw) as CaseFile;
      items.push({
        caseId: c.caseId,
        filename: c.filename,
        uploadedAt: c.uploadedAt,
        status: c.status,
        aktenzeichen: c.aktenzeichen,
        aktenzeichenDisplay: c.aktenzeichenDisplay,
        schuldnerName: c.schuldnerName || extractSchuldnerName(c),
        verfahrensart: c.verfahrensart || extractVerfahrensart(c),
        tags: c.tags ?? [],
        hauptverantwortlicherId: c.hauptverantwortlicherId,
      });
    } catch {
      // korrupte Datei überspringen
    }
  }

  // Legacy-Ordner (Backward Compat)
  if (existsSync(LEGACY_DIR)) {
    let legacyFiles: string[] = [];
    try {
      legacyFiles = await readdir(LEGACY_DIR);
    } catch {
      legacyFiles = [];
    }
    const indexedIds = new Set(items.map((i) => i.caseId));
    for (const file of legacyFiles) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(path.join(LEGACY_DIR, file), "utf-8");
        const c = JSON.parse(raw) as CaseFile;
        if (indexedIds.has(c.caseId)) continue; // bereits in neuer Struktur
        items.push({
          caseId: c.caseId,
          filename: c.filename,
          uploadedAt: c.uploadedAt,
          status: c.status,
          aktenzeichen: c.aktenzeichen,
          aktenzeichenDisplay: c.aktenzeichenDisplay,
          schuldnerName: c.schuldnerName || extractSchuldnerName(c),
          verfahrensart: c.verfahrensart || extractVerfahrensart(c),
        });
      } catch {
        // skip
      }
    }
  }

  return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag-Verwaltung
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCaseTags(caseId: string, tags: string[]): Promise<void> {
  const index = await loadIndex();
  const slug = index[caseId];
  if (!slug) throw new Error(`Case ${caseId} not found in index`);
  const casePath = path.join(AKTEN_DIR, slug, "case.json");
  const raw = await readFile(casePath, "utf-8");
  const c = JSON.parse(raw) as CaseFile;
  c.tags = tags;
  await writeFile(casePath, JSON.stringify(c, null, 2), "utf-8");
}

export async function updateHauptverantwortlicher(caseId: string, userId: string | null): Promise<void> {
  const index = await loadIndex();
  const slug = index[caseId];
  if (!slug) throw new Error(`Case ${caseId} not found in index`);
  const casePath = path.join(AKTEN_DIR, slug, "case.json");
  const raw = await readFile(casePath, "utf-8");
  const c = JSON.parse(raw) as CaseFile;
  if (userId === null) {
    delete c.hauptverantwortlicherId;
  } else {
    c.hauptverantwortlicherId = userId;
  }
  await writeFile(casePath, JSON.stringify(c, null, 2), "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion
// ─────────────────────────────────────────────────────────────────────────────

export function getAllFields(caseData: CaseFile) {
  const fields = [];
  for (const group of caseData.fieldGroups) {
    if (group.isArray && group.instances) {
      for (const instance of group.instances) {
        fields.push(...instance);
      }
    } else if (group.fields) {
      fields.push(...group.fields);
    }
  }
  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata-Markdown-Verwaltung (.metadata/[folder]/[filename].md)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDocumentMetadata(
  caseId: string,
  folder: "eingehend" | "ausgehend",
  originalFilename: string,
  markdown: string
): Promise<void> {
  const dir = await findCaseDir(caseId);
  if (!dir) return;
  const metaDir = path.join(dir, ".metadata", folder);
  await mkdir(metaDir, { recursive: true });
  await writeFile(path.join(metaDir, `${originalFilename}.md`), markdown, "utf-8");
}

export async function loadDocumentMetadata(
  caseId: string,
  folder: "eingehend" | "ausgehend",
  originalFilename: string
): Promise<string | null> {
  const dir = await findCaseDir(caseId);
  if (!dir) return null;
  const mdPath = path.join(dir, ".metadata", folder, `${originalFilename}.md`);
  if (!existsSync(mdPath)) return null;
  try {
    return await readFile(mdPath, "utf-8");
  } catch {
    return null;
  }
}

export async function listDocumentMetadata(
  caseId: string
): Promise<{ eingehend: string[]; ausgehend: string[] }> {
  const dir = await findCaseDir(caseId);
  if (!dir) return { eingehend: [], ausgehend: [] };

  const readMeta = async (folder: string): Promise<string[]> => {
    const p = path.join(dir, ".metadata", folder);
    if (!existsSync(p)) return [];
    try {
      return (await readdir(p)).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  };

  return {
    eingehend: await readMeta("eingehend"),
    ausgehend: await readMeta("ausgehend"),
  };
}
