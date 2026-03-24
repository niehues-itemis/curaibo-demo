import { NextRequest, NextResponse } from "next/server";
import { extractFromPdf } from "@/lib/extraction/extract-pdf";
import { extractVInsOFromText } from "@/lib/extraction/claude-extractor";
import { isScannedPdf, renderPdfToImages, dispatchScannedPdfExtraction } from "@/lib/extraction/scanned-extractor";
import { saveCase, savePdf, getAllFields } from "@/lib/storage/case-store";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Nur PDF-Dateien erlaubt." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const startMs = Date.now();

    // PDF → Text + AcroForm-Felder
    const { text: pdfText, acroFields } = await extractFromPdf(buffer);

    let caseData;

    if (isScannedPdf(pdfText)) {
      // Eingescanntes/handschriftliches PDF: OCR via Claude Vision
      console.log("[/api/extract] Gescanntes PDF erkannt – starte OCR-Pfad.");
      const images = renderPdfToImages(buffer);
      if (images.length === 0) {
        return NextResponse.json(
          { error: "PDF-Seiten konnten nicht in Bilder umgewandelt werden." },
          { status: 422 }
        );
      }
      caseData = await dispatchScannedPdfExtraction(buffer, images, file.name, startMs);
    } else {
      // Normaler Pfad: Hybrid-Extraktion (AcroForm + Textmuster + Claude-Fallback)
      caseData = await extractVInsOFromText(pdfText, acroFields, file.name, startMs);
    }

    // JSON + Original-PDF speichern
    const caseId = await saveCase(caseData);
    await savePdf(caseId, buffer);

    // Statistik für UI-Feedback
    const allFields = getAllFields({ ...caseData, caseId });
    const lowConfidenceCount = allFields.filter((f) => f.confidence < 0.85).length;

    return NextResponse.json({
      caseId,
      fieldCount: allFields.length,
      lowConfidenceCount,
      processingTimeMs: caseData.processingTimeMs,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    return NextResponse.json(
      { error: "Extraktion fehlgeschlagen. Bitte erneut versuchen." },
      { status: 500 }
    );
  }
}
