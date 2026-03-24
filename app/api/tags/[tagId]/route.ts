import { NextRequest, NextResponse } from "next/server";
import { readTags, writeTags } from "@/lib/storage/tag-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await params;
  const body = await request.json() as { namespace?: string; name?: string; label?: string; color?: string };
  const tags = await readTags();
  const idx = tags.findIndex((t) => t.id === tagId);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  tags[idx] = { ...tags[idx], ...body };
  await writeTags(tags);
  return NextResponse.json(tags[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await params;
  const tags = await readTags();
  const filtered = tags.filter((t) => t.id !== tagId);
  if (filtered.length === tags.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  await writeTags(filtered);
  return new NextResponse(null, { status: 204 });
}
