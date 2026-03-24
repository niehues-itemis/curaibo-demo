import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/ai/settings-store";

export async function GET() {
  const settings = await loadSettings();
  const { baseUrl, apiKey } = settings.litellm;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "LiteLLM nicht konfiguriert." }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `LiteLLM Fehler: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    // OpenAI-compatible: { data: [{ id: "gpt-4o", ... }, ...] }
    const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id).sort();
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
