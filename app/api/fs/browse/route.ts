import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join, resolve, dirname } from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path") || os.homedir();

  // Pfad normalisieren und sichern (kein Path-Traversal über Wurzel hinaus)
  const safePath = resolve(rawPath);

  try {
    const entries = await readdir(safePath, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: join(safePath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const parentPath = dirname(safePath);

    return NextResponse.json({
      current: safePath,
      parent: parentPath !== safePath ? parentPath : null,
      dirs,
    });
  } catch {
    return NextResponse.json({ error: `Kein Zugriff auf: ${safePath}` }, { status: 403 });
  }
}
