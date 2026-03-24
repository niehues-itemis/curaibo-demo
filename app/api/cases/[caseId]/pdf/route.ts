import { NextRequest, NextResponse } from "next/server";
import { loadPdf } from "@/lib/storage/case-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const pdfBuffer = loadPdf(caseId);
  if (!pdfBuffer) {
    return NextResponse.json({ error: "Kein PDF gespeichert." }, { status: 404 });
  }
  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
