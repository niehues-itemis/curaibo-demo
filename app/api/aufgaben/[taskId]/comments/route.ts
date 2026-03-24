import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/storage/task-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    const { text, authorId } = await req.json() as { text: string; authorId: string };
    if (!text?.trim() || !authorId) {
      return NextResponse.json({ error: "text und authorId sind Pflichtfelder" }, { status: 400 });
    }
    const updated = await addComment(taskId, { text, authorId });
    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
