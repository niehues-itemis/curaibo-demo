import { NextRequest, NextResponse } from "next/server";
import { loadDocumentMetadata } from "@/lib/storage/case-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const folder = req.nextUrl.searchParams.get("folder") as "eingehend" | "ausgehend" | null;
  const filename = req.nextUrl.searchParams.get("filename");

  if (!folder || !filename || !["eingehend", "ausgehend"].includes(folder)) {
    return new NextResponse("Fehlende Parameter.", { status: 400 });
  }

  const md = await loadDocumentMetadata(caseId, folder, filename);
  if (md === null) return new NextResponse("Nicht gefunden.", { status: 404 });
  return new NextResponse(md, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
