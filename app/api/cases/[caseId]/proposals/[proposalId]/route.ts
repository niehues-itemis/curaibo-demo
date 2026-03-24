import { NextRequest, NextResponse } from "next/server";
import { updateProposal } from "@/lib/storage/proposal-store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; proposalId: string }> }
) {
  const { caseId, proposalId } = await params;
  const { status } = await req.json();
  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }
  try {
    const updated = await updateProposal(caseId, proposalId, status);
    if (!updated) return NextResponse.json({ error: "Proposal nicht gefunden." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH proposals]", err);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}
