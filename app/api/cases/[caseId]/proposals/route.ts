import { NextRequest, NextResponse } from "next/server";
import { loadProposals } from "@/lib/storage/proposal-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const proposals = await loadProposals(caseId);
    return NextResponse.json(proposals);
  } catch (err) {
    console.error("[GET proposals]", err);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}
