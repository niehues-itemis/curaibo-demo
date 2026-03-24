import { NextRequest, NextResponse } from "next/server";
import { listDocuments } from "@/lib/storage/case-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const docs = await listDocuments(caseId);
  return NextResponse.json(docs);
}
