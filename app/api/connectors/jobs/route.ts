import { NextResponse } from "next/server";
import { listJobEntries } from "@/lib/connectors/job-log-store";

export async function GET() {
  try {
    const jobs = await listJobEntries(100);
    return NextResponse.json(jobs);
  } catch (err) {
    console.error("[GET /api/connectors/jobs]", err);
    return NextResponse.json({ error: "Fehler beim Laden der Jobs." }, { status: 500 });
  }
}
