import { streamText, convertToModelMessages } from "ai";
import { NextRequest } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { listCases, loadCase } from "@/lib/storage/case-store";
import { buildAllCasesContext, buildSingleCaseContext } from "@/lib/chat/case-context-builder";
import type { CaseFile } from "@/lib/extraction/types";

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für eine Insolvenzrechtskanzlei, spezialisiert auf Verbraucherinsolvenzverfahren nach der deutschen Insolvenzordnung (InsO) und dem VInsO-Formular (Amtliche Fassung 2020).

Deine Aufgaben:
- Fragen zu Akten, Schuldnern, Gläubigern und Verfahrensstand beantworten
- Bei der Interpretation von VInsO-Feldern helfen
- Auf Basis der vorliegenden Aktendaten Auskünfte geben
- Fristen, Obliegenheiten und Verfahrensschritte erläutern

Wichtige Hinweise:
- Kommuniziere ausschließlich auf Deutsch
- Antworte präzise und professionell
- Weise darauf hin, wenn eine Frage rechtliche Beratung erfordert, die über KI hinausgeht
- Du hast Zugriff auf alle im System gespeicherten Akten (siehe Kontext unten)`;

export async function POST(req: NextRequest) {
  const { messages, caseId } = await req.json();

  // Alle Akten laden
  const allListItems = await listCases();
  const allCases: CaseFile[] = [];
  for (const item of allListItems) {
    const caseData = await loadCase(item.caseId);
    if (caseData) allCases.push(caseData);
  }

  // Kontext aufbauen
  let systemWithContext = SYSTEM_PROMPT + "\n\n" + buildAllCasesContext(allCases);

  // Falls aktive Akte: Detail-Kontext hinzufügen
  if (caseId) {
    const activeCaseData = allCases.find((c) => c.caseId === caseId);
    if (activeCaseData) {
      systemWithContext += "\n\n---\n" + buildSingleCaseContext(activeCaseData);
    }
  }

  const result = streamText({
    model: await getModel("primary"),
    system: systemWithContext,
    messages: await convertToModelMessages(messages),
  });

  return result.toTextStreamResponse();
}
