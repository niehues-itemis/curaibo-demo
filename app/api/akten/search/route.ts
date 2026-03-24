import { NextRequest, NextResponse } from "next/server";
import { listCases, loadCase } from "@/lib/storage/case-store";
import { searchAllCases } from "@/lib/search/case-search";
import type { CaseFile } from "@/lib/extraction/types";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  // Alle Akten laden (vollständige CaseFile-Objekte für Feldsuche)
  const listItems = await listCases();
  const cases: CaseFile[] = [];
  for (const item of listItems) {
    const caseData = await loadCase(item.caseId);
    if (caseData) cases.push(caseData);
  }

  const results = searchAllCases(query, cases);
  return NextResponse.json(results);
}
