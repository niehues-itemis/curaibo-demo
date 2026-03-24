import { NextRequest, NextResponse } from "next/server";
import { listConnectors, saveConnector } from "@/lib/connectors/connector-store";
import { testEmailConnection } from "@/lib/connectors/email-connector";
import type { EmailConnectorConfig } from "@/lib/connectors/types";

export async function GET() {
  const connectors = await listConnectors();
  return NextResponse.json(connectors);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, config } = body;

    if (!type || !name || !config) {
      return NextResponse.json({ error: "type, name und config sind erforderlich." }, { status: 400 });
    }

    let status: "active" | "inactive" | "error" = "active";

    // Bei Email-Connector: Verbindungstest
    if (type === "email") {
      const ok = await testEmailConnection(config as EmailConnectorConfig);
      status = ok ? "active" : "error";
    }

    const id = await saveConnector({
      type,
      name,
      config,
      status,
      lastSyncAt: null,
      lastSyncResult: null,
      enabled: true,
      pollIntervalMinutes: 15,
      processedCount: 0,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/connectors]", err);
    return NextResponse.json({ error: "Konnektor konnte nicht erstellt werden." }, { status: 500 });
  }
}
