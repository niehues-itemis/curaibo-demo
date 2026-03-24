import { NextRequest, NextResponse } from "next/server";
import { readTags, writeTags } from "@/lib/storage/tag-store";
import { ensureDokumentKategorienSeeded } from "@/lib/dokument-kategorien-seed";

export async function GET() {
  await ensureDokumentKategorienSeeded();
  const tags = await readTags();
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { namespace?: string; name?: string; label?: string; color?: string };
  const { namespace, name, label, color = "gray" } = body;

  if (!namespace || !name || !label) {
    return NextResponse.json({ error: "namespace, name, label required" }, { status: 400 });
  }

  const tags = await readTags();

  // Check for duplicates
  const existing = tags.find((t) => t.namespace === namespace && t.name === name);
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const newTag = {
    id: `tag-${namespace.slice(0, 1)}${Date.now()}`,
    namespace,
    name,
    label,
    color,
  };
  tags.push(newTag);
  await writeTags(tags);
  return NextResponse.json(newTag, { status: 201 });
}
