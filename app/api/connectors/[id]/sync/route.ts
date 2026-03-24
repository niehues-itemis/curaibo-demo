import { NextRequest, NextResponse } from "next/server";
import { loadConnector, updateConnector, loadSyncState } from "@/lib/connectors/connector-store";
import { syncFilesystemConnector } from "@/lib/connectors/filesystem-connector";
import { syncEmailConnector } from "@/lib/connectors/email-connector";
import { createJobEntry, finishJobEntry } from "@/lib/connectors/job-log-store";
import type { SyncResult } from "@/lib/connectors/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const connector = await loadConnector(id);

  if (!connector) {
    return NextResponse.json({ error: "Konnektor nicht gefunden" }, { status: 404 });
  }

  const jobId = await createJobEntry(connector.id, connector.name, connector.type);
  let syncResult: SyncResult;

  try {
    if (connector.type === "filesystem") {
      const processedSet = await loadSyncState(id);
      syncResult = await syncFilesystemConnector(connector, processedSet);
    } else if (connector.type === "email") {
      syncResult = await syncEmailConnector(connector);
    } else {
      await finishJobEntry(jobId, "error", "Unbekannter Konnektor-Typ", [], 0, []);
      return NextResponse.json({ error: "Unbekannter Konnektor-Typ" }, { status: 400 });
    }

    const resultText = buildResultText(syncResult);
    await updateConnector(id, {
      lastSyncAt: new Date().toISOString(),
      lastSyncResult: resultText,
      status: syncResult.errors.length > 0 ? "error" : "active",
      processedCount: connector.processedCount + syncResult.processed,
    });

    await finishJobEntry(
      jobId,
      syncResult.errors.length > 0 ? "error" : "success",
      resultText,
      syncResult.errors,
      syncResult.processed,
      syncResult.newCaseIds
    );

    return NextResponse.json(syncResult);
  } catch (err) {
    console.error(`[POST /api/connectors/${id}/sync]`, err);
    await updateConnector(id, {
      lastSyncAt: new Date().toISOString(),
      lastSyncResult: `Fehler: ${err}`,
      status: "error",
    });
    await finishJobEntry(jobId, "error", `Fehler: ${err}`, [String(err)], 0, []);
    return NextResponse.json({ error: "Sync fehlgeschlagen." }, { status: 500 });
  }
}

function buildResultText(result: SyncResult): string {
  const parts: string[] = [];
  if (result.newCaseIds.length > 0) parts.push(`${result.newCaseIds.length} neue Akte(n)`);
  if (result.assignedToCaseIds.length > 0) parts.push(`${result.assignedToCaseIds.length} Dokument(e) zugeordnet`);
  if (result.skipped > 0) parts.push(`${result.skipped} übersprungen`);
  if (result.errors.length > 0) parts.push(`${result.errors.length} Fehler`);
  return parts.length > 0 ? parts.join(", ") : "Keine neuen Dokumente";
}
