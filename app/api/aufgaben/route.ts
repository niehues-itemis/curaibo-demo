import { NextRequest, NextResponse } from "next/server";
import {
  readAllTasks,
  readTasksForCase,
  readTasksForUser,
  createTask,
  getTaskSummary,
  getTaskSummaryForUser,
} from "@/lib/storage/task-store";
import type { LinkedElement, TaskStatus } from "@/lib/storage/task-store";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const caseId = searchParams.get("caseId");
  const userId = searchParams.get("userId");
  const summary = searchParams.get("summary");

  try {
    if (summary === "1") {
      if (userId) {
        const caseIds = await getTaskSummaryForUser(userId);
        return NextResponse.json(caseIds);
      }
      const summaryData = await getTaskSummary();
      return NextResponse.json(summaryData);
    }

    if (caseId) {
      const tasks = await readTasksForCase(caseId);
      return NextResponse.json(tasks);
    }

    if (userId) {
      const tasks = await readTasksForUser(userId);
      return NextResponse.json(tasks);
    }

    const tasks = await readAllTasks();
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Fehler beim Laden der Aufgaben" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, title, description, status, tags, createdBy, assignees, linkedElements } = body as {
      caseId: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      tags?: string[];
      createdBy: string;
      assignees: string[];
      linkedElements: LinkedElement[];
    };

    if (!caseId || !title || !createdBy) {
      return NextResponse.json({ error: "caseId, title und createdBy sind Pflichtfelder" }, { status: 400 });
    }

    const task = await createTask({
      caseId,
      title,
      description,
      status: status ?? "offen",
      tags: tags ?? [],
      createdBy,
      assignees: assignees ?? [],
      linkedElements: linkedElements ?? [],
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler beim Erstellen der Aufgabe" }, { status: 500 });
  }
}
