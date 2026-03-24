import { NextRequest, NextResponse } from "next/server";
import { deleteUnassignedDocument } from "@/lib/storage/case-store";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);
  try {
    await deleteUnassignedDocument(decoded);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
