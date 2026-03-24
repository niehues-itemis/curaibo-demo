import { NextRequest, NextResponse } from "next/server";
import { readNamespaces, writeNamespaces } from "@/lib/storage/namespace-store";
import type { NamespaceConfig } from "@/lib/tags";

export async function GET() {
  const namespaces = await readNamespaces();
  return NextResponse.json(namespaces);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<NamespaceConfig>;
  const { namespace, label, exclusive = false } = body;
  if (namespace === undefined || !label) {
    return NextResponse.json({ error: "namespace and label required" }, { status: 400 });
  }
  const namespaces = await readNamespaces();
  if (namespaces.find((n) => n.namespace === namespace)) {
    return NextResponse.json({ error: "namespace already exists" }, { status: 409 });
  }
  const newNs: NamespaceConfig = { namespace, label, exclusive };
  namespaces.push(newNs);
  await writeNamespaces(namespaces);
  return NextResponse.json(newNs, { status: 201 });
}
