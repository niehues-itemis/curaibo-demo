import { NextRequest, NextResponse } from "next/server";
import { loadCase, saveOutgoingDocument, updateDocumentTags } from "@/lib/storage/case-store";
import { generateGlaeubigerBriefeFiles } from "@/lib/generation/generate-glaeubigerbrief";
import { GLAEUBIGER_BRIEF_CONFIG } from "@/lib/generation/template-config";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  const caseData = await loadCase(caseId);
  if (!caseData) {
    return NextResponse.json({ error: "Fall nicht gefunden." }, { status: 404 });
  }

  try {
    const files = generateGlaeubigerBriefeFiles(caseData);

    await Promise.all(
      files.map(async ({ filename, buffer }) => {
        await saveOutgoingDocument(caseId, filename, buffer);
        if (GLAEUBIGER_BRIEF_CONFIG.zielKategorie) {
          await updateDocumentTags(caseId, "ausgehend", filename, [
            GLAEUBIGER_BRIEF_CONFIG.zielKategorie,
          ]);
        }
      })
    );

    return NextResponse.json({
      ok: true,
      files: files.map((f) => f.filename),
      count: files.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generierung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
