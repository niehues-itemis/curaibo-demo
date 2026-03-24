import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { deleteDocument } from "@/lib/storage/case-store";

const AKTEN_DIR = path.join(process.cwd(), "data", "akten");
const INDEX_FILE = path.join(AKTEN_DIR, "_index.json");

const ALLOWED_FOLDERS = new Set(["eingehend", "ausgehend", "zu_verarbeiten"]);

function loadIndex(): Record<string, string> {
  if (!existsSync(INDEX_FILE)) return {};
  try {
    return JSON.parse(require("fs").readFileSync(INDEX_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; folder: string; filename: string }> }
) {
  const { caseId, folder, filename } = await params;
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  if (!ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Ungültiger Ordner." }, { status: 400 });
  }

  // Sicherheitscheck: kein Path-Traversal
  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  const index = loadIndex();
  const slug = index[caseId];
  if (!slug) {
    return NextResponse.json({ error: "Fall nicht gefunden." }, { status: 404 });
  }

  const filePath = path.join(AKTEN_DIR, slug, folder, filename);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/octet-stream";

  const disposition = inline
    ? `inline; filename="${encodeURIComponent(filename)}"`
    : `attachment; filename="${encodeURIComponent(filename)}"`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string; folder: string; filename: string }> }
) {
  const { caseId, folder, filename } = await params;

  if (!new Set(["eingehend", "ausgehend"]).has(folder)) {
    return NextResponse.json({ error: "Ungültiger Ordner." }, { status: 400 });
  }
  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  try {
    await deleteDocument(caseId, folder as "eingehend" | "ausgehend", filename);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
