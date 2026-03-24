import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { JobLogEntry, JobStatus, ConnectorType } from "@/lib/connectors/types";

const DATA_DIR = path.join(process.cwd(), "data");
const JOBS_FILE = path.join(DATA_DIR, "connector-jobs.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJobs(): Promise<JobLogEntry[]> {
  await ensureDir();
  if (!existsSync(JOBS_FILE)) return [];
  try {
    return JSON.parse(await readFile(JOBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function writeJobs(jobs: JobLogEntry[]): Promise<void> {
  await ensureDir();
  // Keep only the last 500 entries to avoid unbounded growth
  const trimmed = jobs.slice(-500);
  await writeFile(JOBS_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
}

export async function createJobEntry(
  connectorId: string,
  connectorName: string,
  connectorType: ConnectorType
): Promise<string> {
  const jobs = await readJobs();
  const id = uuidv4();
  const entry: JobLogEntry = {
    id,
    connectorId,
    connectorName,
    connectorType,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "running",
    result: null,
    errors: [],
    processed: 0,
    newCaseIds: [],
  };
  jobs.push(entry);
  await writeJobs(jobs);
  return id;
}

export async function finishJobEntry(
  jobId: string,
  status: JobStatus,
  result: string | null,
  errors: string[],
  processed: number,
  newCaseIds: string[]
): Promise<void> {
  const jobs = await readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) return;
  jobs[idx] = {
    ...jobs[idx],
    finishedAt: new Date().toISOString(),
    status,
    result,
    errors,
    processed,
    newCaseIds,
  };
  await writeJobs(jobs);
}

export async function listJobEntries(limit = 100): Promise<JobLogEntry[]> {
  const jobs = await readJobs();
  return jobs.slice(-limit).reverse();
}

export async function deleteJobEntry(jobId: string): Promise<void> {
  const jobs = await readJobs();
  await writeJobs(jobs.filter((j) => j.id !== jobId));
}

export async function cancelJobEntry(jobId: string): Promise<string | null> {
  const jobs = await readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) return null;
  const connectorId = jobs[idx].connectorId;
  jobs[idx] = {
    ...jobs[idx],
    finishedAt: new Date().toISOString(),
    status: "error",
    result: "Manuell abgebrochen",
  };
  await writeJobs(jobs);
  return connectorId;
}

/**
 * Markiert alle noch laufenden Jobs als abgebrochen.
 * Wird beim Server-Start aufgerufen – laufende Jobs aus einem früheren
 * Prozess (z.B. Hot-Reload, Absturz) können nie mehr abgeschlossen werden.
 */
export async function cleanupStaleRunningJobs(): Promise<void> {
  const jobs = await readJobs();
  const now = new Date().toISOString();
  let changed = false;
  for (const job of jobs) {
    if (job.status === "running") {
      job.status = "error";
      job.finishedAt = now;
      job.result = "Abgebrochen (Server-Neustart)";
      changed = true;
    }
  }
  if (changed) await writeJobs(jobs);
}
