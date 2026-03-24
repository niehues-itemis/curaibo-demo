import { NextRequest, NextResponse } from "next/server";
import { readNamespaces, writeNamespaces } from "@/lib/storage/namespace-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ns: string }> }
) {
  const { ns } = await params;
  const namespace = decodeURIComponent(ns);
  const body = await request.json() as { label?: string; exclusive?: boolean };
  const namespaces = await readNamespaces();
  const idx = namespaces.findIndex((n) => n.namespace === namespace);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  namespaces[idx] = { ...namespaces[idx], ...body };
  await writeNamespaces(namespaces);
  return NextResponse.json(namespaces[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ns: string }> }
) {
  const { ns } = await params;
  const namespace = decodeURIComponent(ns);
  const namespaces = await readNamespaces();
  const filtered = namespaces.filter((n) => n.namespace !== namespace);
  if (filtered.length === namespaces.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  await writeNamespaces(filtered);
  return new NextResponse(null, { status: 204 });
}
