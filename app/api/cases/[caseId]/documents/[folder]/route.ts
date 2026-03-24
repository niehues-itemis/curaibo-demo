import { NextRequest, NextResponse } from "next/server";
import {
  saveIncomingDocument,
  saveOutgoingDocument,
  saveDocumentMetadata,
  updateDocumentTags,
} from "@/lib/storage/case-store";
import { convertToMarkdown } from "@/lib/extraction/document-to-markdown";
import { triggerDocumentAnalysis } from "@/lib/connectors/trigger-analysis";
import { classifyDocumentKategorien } from "@/lib/extraction/document-category-classifier";
import { readTags } from "@/lib/storage/tag-store";

const ALLOWED_FOLDERS = new Set(["eingehend", "ausgehend"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; folder: string }> }
) {
  try {
    const { caseId, folder } = await params;

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Ungültiger Ordner." }, { status: 400 });
    }

    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien übergeben." }, { status: 400 });
    }

    const saved: string[] = [];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (file.name.includes("..") || file.name.includes("/")) continue;

      const buffer = Buffer.from(await file.arrayBuffer());

      if (folder === "eingehend") {
        await saveIncomingDocument(caseId, file.name, buffer);
      } else {
        await saveOutgoingDocument(caseId, file.name, buffer);
      }

      // Markdown-Metadata asynchron erzeugen, dann Klassifizierung anstoßen
      convertToMarkdown(buffer, file.name)
        .then(async ({ markdown }) => {
          await saveDocumentMetadata(caseId, folder as "eingehend" | "ausgehend", file.name, markdown);
          // Kategorie-Klassifizierung mit dem bereits erzeugten Markdown
          const allTags = await readTags();
          const tagRefs = await classifyDocumentKategorien(markdown, allTags);
          await updateDocumentTags(caseId, folder as "eingehend" | "ausgehend", file.name, tagRefs);
        })
        .catch((err) => console.warn(`[metadata/kategorien] ${file.name}:`, err));
      triggerDocumentAnalysis(caseId, folder as "eingehend" | "ausgehend", file.name);

      saved.push(file.name);
    }

    return NextResponse.json({ ok: true, files: saved });
  } catch (err) {
    console.error("[documents/[folder] POST]", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }
}
