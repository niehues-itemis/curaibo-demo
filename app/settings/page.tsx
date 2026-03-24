"use client";

import { useEffect, useState } from "react";
import { Bot, Save, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface LiteLLMConfig {
  baseUrl: string;
  apiKey: string;
  apiKeySet?: boolean;
  modelPrimary: string;
  modelFast: string;
}

interface MistralConfig {
  apiKey: string;
  apiKeySet?: boolean;
}

interface AISettings {
  provider: "anthropic" | "litellm";
  ocrProvider: "tesseract" | "claude" | "mistral";
  mistral: MistralConfig;
  litellm: LiteLLMConfig;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    provider: "anthropic",
    ocrProvider: "claude",
    mistral: { apiKey: "" },
    litellm: {
      baseUrl: "https://llms.itesmi.cloud/v1",
      apiKey: "",
      modelPrimary: "gpt-4o",
      modelFast: "gpt-4o-mini",
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: AISettings) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLoadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/settings/models");
      const data = await res.json();
      if (res.ok) {
        setAvailableModels(data.models ?? []);
      } else {
        setModelsError(data.error ?? "Fehler beim Laden der Modelle.");
      }
    } catch {
      setModelsError("Netzwerkfehler beim Laden der Modelle.");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setResult({ ok: true, message: "Einstellungen gespeichert." });
      } else {
        const err = await res.json();
        setResult({ ok: false, message: err.error ?? "Fehler beim Speichern." });
      }
    } catch {
      setResult({ ok: false, message: "Netzwerkfehler." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Bot className="h-7 w-7 text-brand" />
        <h1 className="text-2xl font-bold text-neutral-900">KI-Einstellungen</h1>
      </div>

      {/* Provider-Auswahl */}
      <section className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-4">
          KI-Provider
        </h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="provider"
              value="anthropic"
              checked={settings.provider === "anthropic"}
              onChange={() => setSettings((s) => ({ ...s, provider: "anthropic" }))}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-neutral-900">Anthropic (Claude)</span>
              <p className="text-sm text-neutral-500 mt-0.5">
                Nutzt <code className="bg-neutral-100 px-1 rounded text-xs">ANTHROPIC_API_KEY</code> aus{" "}
                <code className="bg-neutral-100 px-1 rounded text-xs">.env.local</code>.
                Modelle: claude-sonnet-4-6 (Extraktion/Chat), claude-haiku-4-5 (Klassifikation).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="provider"
              value="litellm"
              checked={settings.provider === "litellm"}
              onChange={() => setSettings((s) => ({ ...s, provider: "litellm" }))}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-neutral-900">LiteLLM</span>
              <p className="text-sm text-neutral-500 mt-0.5">
                OpenAI-kompatibler Proxy — nutze beliebige Modelle über deine LiteLLM-Instanz.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* LiteLLM-Konfiguration */}
      {settings.provider === "litellm" && (
        <section className="bg-white border rounded-xl p-6 mb-6 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
            LiteLLM-Konfiguration
          </h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Basis-URL
            </label>
            <input
              type="url"
              value={settings.litellm.baseUrl}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  litellm: { ...s.litellm, baseUrl: e.target.value },
                }))
              }
              placeholder="https://llms.itesmi.cloud/v1"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              API-Key
            </label>
            <input
              type="password"
              value={settings.litellm.apiKey}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  litellm: { ...s.litellm, apiKey: e.target.value },
                }))
              }
              placeholder={settings.litellm.apiKeySet ? "●●●●●●●● (bereits gesetzt)" : "sk-..."}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {settings.litellm.apiKeySet && (
              <p className="text-xs text-neutral-400 mt-1">
                Leer lassen um den gespeicherten Key beizubehalten.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">Modelle</span>
              <button
                type="button"
                onClick={handleLoadModels}
                disabled={modelsLoading || !settings.litellm.baseUrl}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-text disabled:text-neutral-400"
              >
                {modelsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Modelle laden
              </button>
            </div>
            {modelsError && (
              <p className="text-xs text-error-muted mb-2">{modelsError}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Primäres Modell
                  <span className="text-neutral-400 font-normal ml-1">(Chat + Extraktion)</span>
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={settings.litellm.modelPrimary}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        litellm: { ...s.litellm, modelPrimary: e.target.value },
                      }))
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settings.litellm.modelPrimary}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        litellm: { ...s.litellm, modelPrimary: e.target.value },
                      }))
                    }
                    placeholder="gpt-4o"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Schnelles Modell
                  <span className="text-neutral-400 font-normal ml-1">(Klassifikation)</span>
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={settings.litellm.modelFast}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        litellm: { ...s.litellm, modelFast: e.target.value },
                      }))
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settings.litellm.modelFast}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        litellm: { ...s.litellm, modelFast: e.target.value },
                      }))
                    }
                    placeholder="gpt-4o-mini"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* OCR-Provider */}
      <section className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-4">
          OCR-Provider (für eingescannte PDFs)
        </h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="ocrProvider"
              value="claude"
              checked={settings.ocrProvider === "claude"}
              onChange={() => setSettings((s) => ({ ...s, ocrProvider: "claude" }))}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-neutral-900">Claude Vision</span>
              <p className="text-sm text-neutral-500 mt-0.5">
                Standard. Nutzt den konfigurierten KI-Provider. Sehr gute Erkennung, auch bei Handschrift.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="ocrProvider"
              value="tesseract"
              checked={settings.ocrProvider === "tesseract"}
              onChange={() => setSettings((s) => ({ ...s, ocrProvider: "tesseract" }))}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-neutral-900">Tesseract.js</span>
              <p className="text-sm text-neutral-500 mt-0.5">
                Lokal, kostenlos, kein API-Key nötig. Gut für klar gedruckten Text. Kein API-Kontingent verbraucht.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="ocrProvider"
              value="mistral"
              checked={settings.ocrProvider === "mistral"}
              onChange={() => setSettings((s) => ({ ...s, ocrProvider: "mistral" }))}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-neutral-900">Mistral Vision</span>
              <p className="text-sm text-neutral-500 mt-0.5">
                Mistral Pixtral-Modell via Mistral-API. Erfordert einen separaten Mistral API-Key.
              </p>
            </div>
          </label>
        </div>

        {settings.ocrProvider === "mistral" && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Mistral API-Key
            </label>
            <input
              type="password"
              value={settings.mistral.apiKey}
              onChange={(e) =>
                setSettings((s) => ({ ...s, mistral: { ...s.mistral, apiKey: e.target.value } }))
              }
              placeholder={settings.mistral.apiKeySet ? "●●●●●●●● (bereits gesetzt)" : "sk-..."}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {settings.mistral.apiKeySet && (
              <p className="text-xs text-neutral-400 mt-1">Leer lassen um den gespeicherten Key beizubehalten.</p>
            )}
          </div>
        )}
      </section>

      {/* Speichern */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Speichern
        </button>

        {result && (
          <div
            className={`flex items-center gap-2 text-sm ${
              result.ok ? "text-success" : "text-error"
            }`}
          >
            {result.ok ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
