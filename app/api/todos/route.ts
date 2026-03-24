import { NextResponse } from "next/server";
import { listAllPendingProposals } from "@/lib/storage/proposal-store";

export async function GET() {
  try {
    const todos = await listAllPendingProposals();
    return NextResponse.json(todos);
  } catch (err) {
    console.error("[GET /api/todos]", err);
    return NextResponse.json({ error: "Fehler beim Laden der TODOs." }, { status: 500 });
  }
}
