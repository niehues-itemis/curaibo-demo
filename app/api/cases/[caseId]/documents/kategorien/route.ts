import { NextRequest, NextResponse } from "next/server";
import { loadDokumentTagMap, updateDocumentTags } from "@/lib/storage/case-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const map = await loadDokumentTagMap(caseId);
  return NextResponse.json(map);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  const body = await req.json() as {
    folder?: string;
    filename?: string;
    tagRefs?: string[];
  };

  const { folder, filename, tagRefs } = body;

  if (folder !== "eingehend" && folder !== "ausgehend") {
    return NextResponse.json({ error: "Ungültiger Ordner." }, { status: 400 });
  }

  if (!filename || typeof filename !== "string" || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  if (!Array.isArray(tagRefs) || !tagRefs.every((r) => typeof r === "string")) {
    return NextResponse.json({ error: "tagRefs muss ein String-Array sein." }, { status: 400 });
  }

  await updateDocumentTags(caseId, folder, filename, tagRefs);
  return NextResponse.json({ ok: true });
}
