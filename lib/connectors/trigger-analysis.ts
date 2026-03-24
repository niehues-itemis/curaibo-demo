import { loadCase, loadDocumentMetadata } from "@/lib/storage/case-store";
import { addProposals } from "@/lib/storage/proposal-store";
import { analyzeDocumentForFieldUpdates } from "@/lib/extraction/document-field-analyzer";

export function triggerDocumentAnalysis(
  caseId: string,
  folder: "eingehend" | "ausgehend",
  filename: string
): void {
  // Fire and forget — never blocks the response
  (async () => {
    try {
      const [caseData, markdown] = await Promise.all([
        loadCase(caseId),
        loadDocumentMetadata(caseId, folder, filename),
      ]);
      if (!caseData || !markdown) return;
      if (caseData.fieldGroups.length === 0) return;

      const proposals = await analyzeDocumentForFieldUpdates(
        caseData,
        markdown,
        folder,
        filename
      );
      if (proposals.length > 0) {
        await addProposals(caseId, proposals);
        console.log(`[analysis] ${caseId}: ${proposals.length} Vorschläge aus "${filename}"`);
      }
    } catch (err) {
      console.error(`[analysis] Fehler für ${caseId}/${filename}:`, err);
    }
  })();
}
