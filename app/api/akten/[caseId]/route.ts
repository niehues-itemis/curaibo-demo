import { NextRequest, NextResponse } from "next/server";
import { updateCaseTags, updateHauptverantwortlicher } from "@/lib/storage/case-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const body = await request.json() as { tags?: string[]; hauptverantwortlicherId?: string | null };

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }
    await updateCaseTags(caseId, body.tags);
  }

  if ("hauptverantwortlicherId" in body) {
    await updateHauptverantwortlicher(caseId, body.hauptverantwortlicherId ?? null);
  }

  return NextResponse.json({ ok: true });
}
