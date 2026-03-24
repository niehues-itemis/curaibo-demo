import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { loadSettings } from "./settings-store";

const ANTHROPIC_PRIMARY = "claude-sonnet-4-6";
const ANTHROPIC_FAST = "claude-haiku-4-5-20251001";

/**
 * Gibt das konfigurierte KI-Modell zurück.
 * - "primary": für Chat, Extraktion, OCR
 * - "fast": für Dokument-Klassifikation (günstiger/schneller)
 *
 * Fällt auf Anthropic zurück wenn LiteLLM-Config unvollständig.
 */
export async function getModel(type: "primary" | "fast"): Promise<LanguageModel> {
  const settings = await loadSettings();

  if (settings.provider === "litellm") {
    const { baseUrl, apiKey, modelPrimary, modelFast } = settings.litellm;
    if (baseUrl && apiKey) {
      const openai = createOpenAI({ baseURL: baseUrl, apiKey });
      return openai(type === "fast" ? modelFast : modelPrimary) as LanguageModel;
    }
  }

  // Anthropic-Fallback
  return anthropic(type === "fast" ? ANTHROPIC_FAST : ANTHROPIC_PRIMARY) as LanguageModel;
}
