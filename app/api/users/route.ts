import { NextResponse } from "next/server";
import { readAllUsers } from "@/lib/storage/user-store";

export async function GET() {
  const users = await readAllUsers();
  return NextResponse.json(users);
}
