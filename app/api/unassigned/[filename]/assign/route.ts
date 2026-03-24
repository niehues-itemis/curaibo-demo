import { NextRequest, NextResponse } from "next/server";
import {
  readUnassignedDocument,
  deleteUnassignedDocument,
  saveIncomingDocument,
  saveDocumentMetadata,
} from "@/lib/storage/case-store";
import { convertToMarkdown } from "@/lib/extraction/document-to-markdown";
import { triggerDocumentAnalysis } from "@/lib/connectors/trigger-analysis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);
  const { caseId } = await req.json();

  if (!caseId) {
    return NextResponse.json({ error: "caseId fehlt" }, { status: 400 });
  }

  try {
    const buffer = await readUnassignedDocument(decoded);

    // In Akte eingehend speichern
    await saveIncomingDocument(caseId, decoded, buffer);

    // Markdown generieren und Metadaten speichern
    const { markdown } = await convertToMarkdown(buffer, decoded);
    await saveDocumentMetadata(caseId, "eingehend", decoded, markdown);

    // KI-Analyse für Feldaktualisierungen anstoßen (fire & forget)
    triggerDocumentAnalysis(caseId, "eingehend", decoded);

    // Aus unassigned löschen
    await deleteUnassignedDocument(decoded);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
