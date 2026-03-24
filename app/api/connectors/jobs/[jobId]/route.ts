import { NextRequest, NextResponse } from "next/server";
import { deleteJobEntry, cancelJobEntry } from "@/lib/connectors/job-log-store";
import { releaseConnectorSync } from "@/lib/connectors/cron-scheduler";

type Params = { params: Promise<{ jobId: string }> };

/** Laufenden Job abbrechen */
export async function POST(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const connectorId = await cancelJobEntry(jobId);
  if (connectorId === null) {
    return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
  }
  releaseConnectorSync(connectorId);
  return NextResponse.json({ ok: true });
}

/** Abgeschlossenen Job löschen */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  await deleteJobEntry(jobId);
  return NextResponse.json({ ok: true });
}
