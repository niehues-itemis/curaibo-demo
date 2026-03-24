import { NextRequest, NextResponse } from "next/server";
import { readTask, updateTask, deleteTask } from "@/lib/storage/task-store";
import type { Task, TaskStatus, LinkedElement, TaskHistoryEntry, TaskComment } from "@/lib/storage/task-store";

// Re-export types used in sub-routes
export type { TaskHistoryEntry, TaskComment };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    const task = await readTask(taskId);
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Aufgabe nicht gefunden" }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    const body = await req.json() as Partial<Pick<Task, "title" | "description" | "assignees" | "linkedElements" | "tags"> & { status: TaskStatus; linkedElements: LinkedElement[]; _actorId?: string }>;
    const { _actorId, ...updates } = body;
    const updated = await updateTask(taskId, updates, _actorId);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    await deleteTask(taskId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Aufgabe nicht gefunden" }, { status: 404 });
  }
}
