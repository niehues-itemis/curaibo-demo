import { NextResponse } from "next/server";
import { listUnassignedDocuments } from "@/lib/storage/case-store";

export async function GET() {
  const docs = await listUnassignedDocuments();
  return NextResponse.json(docs);
}
