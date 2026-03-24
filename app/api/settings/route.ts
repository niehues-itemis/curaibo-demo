import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/ai/settings-store";
import type { AISettings } from "@/lib/ai/settings-store";

export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json({
    ...settings,
    mistral: {
      apiKey: settings.mistral.apiKey ? "***" : "",
      apiKeySet: settings.mistral.apiKey.length > 0,
    },
    litellm: {
      ...settings.litellm,
      apiKeySet: settings.litellm.apiKey.length > 0,
      apiKey: settings.litellm.apiKey ? "***" : "",
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Partial<AISettings> & {
      mistral?: Partial<AISettings["mistral"]> & { apiKey?: string };
      litellm?: Partial<AISettings["litellm"]> & { apiKey?: string };
    };

    const current = await loadSettings();

    const updated: AISettings = {
      provider: body.provider ?? current.provider,
      ocrProvider: body.ocrProvider ?? current.ocrProvider,
      mistral: {
        apiKey: (body.mistral?.apiKey && body.mistral.apiKey !== "***")
          ? body.mistral.apiKey
          : current.mistral.apiKey,
      },
      litellm: {
        baseUrl: body.litellm?.baseUrl ?? current.litellm.baseUrl,
        apiKey: (body.litellm?.apiKey && body.litellm.apiKey !== "***")
          ? body.litellm.apiKey
          : current.litellm.apiKey,
        modelPrimary: body.litellm?.modelPrimary ?? current.litellm.modelPrimary,
        modelFast: body.litellm?.modelFast ?? current.litellm.modelFast,
      },
    };

    await saveSettings(updated);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
