import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Connector } from "@/lib/connectors/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONNECTORS_FILE = path.join(DATA_DIR, "connectors.json");
const SYNC_STATE_DIR = path.join(DATA_DIR, "connector-sync");

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(SYNC_STATE_DIR, { recursive: true });
}

async function readConnectors(): Promise<Connector[]> {
  await ensureDirs();
  if (!existsSync(CONNECTORS_FILE)) return [];
  try {
    return JSON.parse(await readFile(CONNECTORS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function writeConnectors(connectors: Connector[]): Promise<void> {
  await ensureDirs();
  await writeFile(CONNECTORS_FILE, JSON.stringify(connectors, null, 2), "utf-8");
}

export async function listConnectors(): Promise<Connector[]> {
  return readConnectors();
}

export async function loadConnector(id: string): Promise<Connector | null> {
  const connectors = await readConnectors();
  return connectors.find((c) => c.id === id) ?? null;
}

export async function saveConnector(
  data: Omit<Connector, "id" | "createdAt">
): Promise<string> {
  const connectors = await readConnectors();
  const id = uuidv4();
  const connector: Connector = { id, createdAt: new Date().toISOString(), ...data };
  connectors.push(connector);
  await writeConnectors(connectors);
  return id;
}

export async function updateConnector(
  id: string,
  update: Partial<Connector>
): Promise<Connector> {
  const connectors = await readConnectors();
  const idx = connectors.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Connector not found: ${id}`);
  connectors[idx] = { ...connectors[idx], ...update };
  await writeConnectors(connectors);
  return connectors[idx];
}

export async function deleteConnector(id: string): Promise<void> {
  const connectors = await readConnectors();
  await writeConnectors(connectors.filter((c) => c.id !== id));
  // Sync-State löschen
  const stateFile = path.join(SYNC_STATE_DIR, `${id}.json`);
  if (existsSync(stateFile)) {
    const { unlink } = await import("fs/promises");
    await unlink(stateFile);
  }
}

// ─── Sync-State (verarbeitete Dateien pro Connector) ──────────────────────────

export async function loadSyncState(connectorId: string): Promise<Set<string>> {
  await ensureDirs();
  const file = path.join(SYNC_STATE_DIR, `${connectorId}.json`);
  if (!existsSync(file)) return new Set();
  try {
    const arr = JSON.parse(await readFile(file, "utf-8")) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function saveSyncState(
  connectorId: string,
  processed: Set<string>
): Promise<void> {
  await ensureDirs();
  const file = path.join(SYNC_STATE_DIR, `${connectorId}.json`);
  await writeFile(file, JSON.stringify([...processed], null, 2), "utf-8");
}
