import { NextRequest, NextResponse } from "next/server";
import { loadConnector, updateConnector, deleteConnector } from "@/lib/connectors/connector-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const connector = await loadConnector(id);
  if (!connector) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(connector);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await updateConnector(id, body);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Konnektor nicht gefunden" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteConnector(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Konnektor nicht gefunden" }, { status: 404 });
  }
}
