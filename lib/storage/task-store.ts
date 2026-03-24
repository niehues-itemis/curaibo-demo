import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { TagRef } from "@/lib/tags";

export type TaskStatus = "offen" | "in_bearbeitung" | "erledigt" | "abgebrochen";

export type LinkedElement =
  | { type: "akte"; caseId: string; label?: string }
  | { type: "beteiligter"; caseId: string; groupId: string; beteiligterId: string; label?: string }
  | { type: "dokument"; caseId: string; folder: string; filename: string }
  | { type: "feldgruppe"; caseId: string; groupId: string; instanceIndex?: number; label?: string }
  | { type: "feld"; caseId: string; groupId: string; fieldId: string; instanceIndex?: number; label?: string }
  | { type: "vorschlag"; caseId: string; proposalId: string; fieldLabel: string; folder: string; filename: string };

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export type TaskHistoryEntry =
  | { id: string; timestamp: string; authorId?: string; type: "created" }
  | { id: string; timestamp: string; authorId?: string; type: "status_changed"; from: TaskStatus; to: TaskStatus }
  | { id: string; timestamp: string; authorId?: string; type: "assignees_changed"; added: string[]; removed: string[] }
  | { id: string; timestamp: string; authorId?: string; type: "title_changed"; from: string; to: string }
  | { id: string; timestamp: string; authorId?: string; type: "description_changed" }
  | { id: string; timestamp: string; authorId?: string; type: "tags_changed"; added: TagRef[]; removed: TagRef[] }
  | { id: string; timestamp: string; authorId?: string; type: "linked_elements_changed" }
  | { id: string; timestamp: string; authorId?: string; type: "comment_added"; commentId: string };

export interface Task {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  tags: TagRef[];
  createdAt: string;
  createdBy: string;
  assignees: string[];
  linkedElements: LinkedElement[];
  comments: TaskComment[];
  history: TaskHistoryEntry[];
}

const TASKS_DIR = path.join(process.cwd(), "data", "tasks");

async function ensureDir() {
  await fs.mkdir(TASKS_DIR, { recursive: true });
}

export async function readTask(taskId: string): Promise<Task> {
  const file = path.join(TASKS_DIR, `${taskId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const t = JSON.parse(raw) as Task;
  // Backfill for existing tasks without history/comments
  t.comments = t.comments ?? [];
  t.history = t.history ?? [];
  return t;
}

export async function readAllTasks(): Promise<Task[]> {
  await ensureDir();
  const files = await fs.readdir(TASKS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  return Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(TASKS_DIR, file), "utf-8");
      const t = JSON.parse(raw) as Task;
      t.comments = t.comments ?? [];
      t.history = t.history ?? [];
      return t;
    })
  );
}

export async function readTasksForCase(caseId: string): Promise<Task[]> {
  const all = await readAllTasks();
  return all.filter((t) => t.caseId === caseId);
}

export async function readTasksForUser(userId: string): Promise<Task[]> {
  const all = await readAllTasks();
  return all.filter((t) => t.assignees.includes(userId));
}

export async function writeTask(taskId: string, task: Task): Promise<void> {
  await ensureDir();
  const file = path.join(TASKS_DIR, `${taskId}.json`);
  await fs.writeFile(file, JSON.stringify(task, null, 2), "utf-8");
}

export async function createTask(
  data: Omit<Task, "id" | "createdAt" | "comments" | "history">
): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    ...data,
    tags: data.tags ?? [],
    id: uuidv4(),
    createdAt: now,
    comments: [],
    history: [
      { id: uuidv4(), timestamp: now, authorId: data.createdBy, type: "created" },
    ],
  };
  await writeTask(task.id, task);
  return task;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Omit<Task, "id" | "createdAt" | "createdBy" | "comments" | "history">>,
  actorId?: string
): Promise<Task> {
  const task = await readTask(taskId);
  const now = new Date().toISOString();
  const newHistory: TaskHistoryEntry[] = [];

  if (updates.status !== undefined && updates.status !== task.status) {
    newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "status_changed", from: task.status, to: updates.status });
  }
  if (updates.title !== undefined && updates.title !== task.title) {
    newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "title_changed", from: task.title, to: updates.title });
  }
  if (updates.description !== undefined && updates.description !== task.description) {
    newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "description_changed" });
  }
  if (updates.assignees !== undefined) {
    const oldSet = new Set(task.assignees);
    const newSet = new Set(updates.assignees);
    const added = updates.assignees.filter((id) => !oldSet.has(id));
    const removed = task.assignees.filter((id) => !newSet.has(id));
    if (added.length > 0 || removed.length > 0) {
      newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "assignees_changed", added, removed });
    }
  }
  if (updates.tags !== undefined) {
    const oldSet = new Set(task.tags);
    const newSet = new Set(updates.tags);
    const added = updates.tags.filter((r) => !oldSet.has(r));
    const removed = task.tags.filter((r) => !newSet.has(r));
    if (added.length > 0 || removed.length > 0) {
      newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "tags_changed", added, removed });
    }
  }
  if (updates.linkedElements !== undefined &&
      JSON.stringify(updates.linkedElements) !== JSON.stringify(task.linkedElements)) {
    newHistory.push({ id: uuidv4(), timestamp: now, authorId: actorId, type: "linked_elements_changed" });
  }

  const updated: Task = {
    ...task,
    ...updates,
    comments: task.comments,
    history: [...task.history, ...newHistory],
  };
  await writeTask(taskId, updated);
  return updated;
}

export async function addComment(
  taskId: string,
  { text, authorId }: { text: string; authorId: string }
): Promise<Task> {
  const task = await readTask(taskId);
  const now = new Date().toISOString();
  const comment: TaskComment = { id: uuidv4(), authorId, text: text.trim(), createdAt: now };
  const historyEntry: TaskHistoryEntry = {
    id: uuidv4(),
    timestamp: now,
    authorId,
    type: "comment_added",
    commentId: comment.id,
  };
  const updated: Task = {
    ...task,
    comments: [...task.comments, comment],
    history: [...task.history, historyEntry],
  };
  await writeTask(taskId, updated);
  return updated;
}

export async function deleteTask(taskId: string): Promise<void> {
  const file = path.join(TASKS_DIR, `${taskId}.json`);
  await fs.unlink(file);
}

/** Summary: count of open tasks per caseId */
export async function getTaskSummary(): Promise<{ caseId: string; openCount: number }[]> {
  const all = await readAllTasks();
  const counts = new Map<string, number>();
  for (const t of all) {
    if (t.status === "offen" || t.status === "in_bearbeitung") {
      counts.set(t.caseId, (counts.get(t.caseId) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([caseId, openCount]) => ({ caseId, openCount }));
}

/** Summary: caseIds that have open tasks for a specific user */
export async function getTaskSummaryForUser(userId: string): Promise<string[]> {
  const all = await readAllTasks();
  const caseIds = new Set<string>();
  for (const t of all) {
    if ((t.status === "offen" || t.status === "in_bearbeitung") && t.assignees.includes(userId)) {
      caseIds.add(t.caseId);
    }
  }
  return Array.from(caseIds);
}
