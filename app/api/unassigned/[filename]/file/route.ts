import { NextRequest, NextResponse } from "next/server";
import { readUnassignedDocument } from "@/lib/storage/case-store";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);

  if (decoded.includes("..") || decoded.includes("/")) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  try {
    const buffer = await readUnassignedDocument(decoded);
    const ext = path.extname(decoded).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
      "application/octet-stream";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(decoded)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }
}
