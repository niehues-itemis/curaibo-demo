import { NextRequest, NextResponse } from "next/server";
import { loadCase, hasPdf, deleteCase } from "@/lib/storage/case-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const caseData = await loadCase(caseId);
  if (!caseData) {
    return NextResponse.json({ error: "Fall nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ...caseData, hasPdf: hasPdf(caseId) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  await deleteCase(caseId);
  return NextResponse.json({ ok: true });
}
