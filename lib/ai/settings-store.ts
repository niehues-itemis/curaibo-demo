import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export interface LiteLLMConfig {
  baseUrl: string;
  apiKey: string;
  modelPrimary: string;
  modelFast: string;
}

export interface MistralConfig {
  apiKey: string;
}

export interface AISettings {
  provider: "anthropic" | "litellm";
  ocrProvider: "tesseract" | "claude" | "mistral";
  mistral: MistralConfig;
  litellm: LiteLLMConfig;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: "anthropic",
  ocrProvider: "claude",
  mistral: { apiKey: "" },
  litellm: {
    baseUrl: "https://llms.itesmi.cloud/v1",
    apiKey: "",
    modelPrimary: "gpt-4o",
    modelFast: "gpt-4o-mini",
  },
};

export async function loadSettings(): Promise<AISettings> {
  if (!existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return {
      provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
      ocrProvider: parsed.ocrProvider ?? DEFAULT_SETTINGS.ocrProvider,
      mistral: {
        ...DEFAULT_SETTINGS.mistral,
        ...parsed.mistral,
      },
      litellm: {
        ...DEFAULT_SETTINGS.litellm,
        ...parsed.litellm,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AISettings): Promise<void> {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}
