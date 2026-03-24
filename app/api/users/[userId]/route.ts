import { NextRequest, NextResponse } from "next/server";
import { updateFilterPreferences } from "@/lib/storage/user-store";
import type { UserFilterPreferences } from "@/lib/storage/user-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await request.json() as { filterPreferences?: Partial<UserFilterPreferences> };

  if (!body.filterPreferences) {
    return NextResponse.json({ error: "filterPreferences required" }, { status: 400 });
  }

  const updated = await updateFilterPreferences(userId, body.filterPreferences);
  return NextResponse.json(updated);
}
