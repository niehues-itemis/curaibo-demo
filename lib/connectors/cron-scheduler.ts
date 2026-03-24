import { listConnectors, loadSyncState, updateConnector } from "@/lib/connectors/connector-store";
import { syncFilesystemConnector } from "@/lib/connectors/filesystem-connector";
import { syncEmailConnector } from "@/lib/connectors/email-connector";
import { createJobEntry, finishJobEntry, cleanupStaleRunningJobs } from "@/lib/connectors/job-log-store";

// Verhindert Doppelläufe für denselben Connector – auch wenn ein Sync länger
// dauert als das Poll-Intervall (z.B. OCR bei großen PDFs).
const runningSyncs = new Set<string>();

/** Gibt den Sync-Lock für einen Connector frei (z.B. nach manuellem Abbruch). */
export function releaseConnectorSync(connectorId: string): void {
  runningSyncs.delete(connectorId);
}

async function runDueConnectors() {
  let connectors;
  try {
    connectors = await listConnectors();
  } catch {
    return;
  }

  const now = new Date();

  for (const connector of connectors) {
    if (!connector.enabled) continue;

    // Läuft bereits – überspringen, unabhängig vom Zeitintervall
    if (runningSyncs.has(connector.id)) {
      console.log(`[cron] ${connector.name}: Sync läuft noch – übersprungen.`);
      continue;
    }

    const intervalMs = (connector.pollIntervalMinutes ?? 15) * 60 * 1000;
    const lastSync = connector.lastSyncAt ? new Date(connector.lastSyncAt).getTime() : 0;

    if (now.getTime() - lastSync < intervalMs - 5_000) continue;

    runningSyncs.add(connector.id);

    // lastSyncAt sofort setzen, damit ein zweiter Scheduler-Start (z.B. nach
    // Neustart) denselben Connector nicht sofort nochmals als fällig einstuft.
    await updateConnector(connector.id, { lastSyncAt: now.toISOString() });

    const jobId = await createJobEntry(connector.id, connector.name, connector.type);

    try {
      let syncResult;
      if (connector.type === "filesystem") {
        const processedSet = await loadSyncState(connector.id);
        syncResult = await syncFilesystemConnector(connector, processedSet);
      } else if (connector.type === "email") {
        syncResult = await syncEmailConnector(connector);
      } else {
        await finishJobEntry(jobId, "error", "Unbekannter Konnektor-Typ", [], 0, []);
        continue;
      }

      const parts: string[] = [];
      if (syncResult.newCaseIds.length > 0) parts.push(`${syncResult.newCaseIds.length} neue Akte(n)`);
      if (syncResult.assignedToCaseIds.length > 0) parts.push(`${syncResult.assignedToCaseIds.length} Dokument(e) zugeordnet`);
      if (syncResult.skipped > 0) parts.push(`${syncResult.skipped} übersprungen`);
      if (syncResult.errors.length > 0) parts.push(`${syncResult.errors.length} Fehler`);
      const resultText = parts.length > 0 ? parts.join(", ") : "Keine neuen Dokumente";

      await updateConnector(connector.id, {
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
    } catch (err) {
      console.error(`[cron] Sync fehlgeschlagen für Konnektor ${connector.id}:`, err);
      await updateConnector(connector.id, {
        lastSyncAt: now.toISOString(),
        lastSyncResult: `Fehler: ${err}`,
        status: "error",
      });
      await finishJobEntry(jobId, "error", `Fehler: ${err}`, [String(err)], 0, []);
    } finally {
      runningSyncs.delete(connector.id);
    }
  }
}

// Globaler Guard verhindert mehrere Scheduler-Instanzen bei Next.js Hot-Reloads
declare global {
  // eslint-disable-next-line no-var
  var __cronSchedulerStarted: boolean | undefined;
}

export function startCronScheduler() {
  if (globalThis.__cronSchedulerStarted) {
    console.log("[cron] Scheduler bereits aktiv – kein zweiter Start.");
    return;
  }
  globalThis.__cronSchedulerStarted = true;

  // Stale Jobs aus vorherigen Prozessen (Hot-Reload, Absturz) bereinigen
  cleanupStaleRunningJobs().catch((err) =>
    console.error("[cron] Stale-Job-Cleanup fehlgeschlagen:", err)
  );

  // Run every 60 seconds and check which connectors are due
  setInterval(() => {
    runDueConnectors().catch((err) =>
      console.error("[cron] Unerwarteter Fehler:", err)
    );
  }, 60_000);

  console.log("[cron] Konnektor-Scheduler gestartet (Intervall: 60s)");
}
