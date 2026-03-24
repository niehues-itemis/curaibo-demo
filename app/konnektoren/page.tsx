"use client";

import { useEffect, useState } from "react";
import {
  Folder,
  FolderOpen,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  X,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Connector, ConnectorType } from "@/lib/connectors/types";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "Noch nie";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusChip({ status }: { status: Connector["status"] }) {
  const configs = {
    active: { label: "Aktiv", icon: CheckCircle, cls: "bg-success-light text-success-text" },
    inactive: { label: "Inaktiv", icon: Clock, cls: "bg-neutral-100 text-neutral-600" },
    error: { label: "Fehler", icon: XCircle, cls: "bg-error-light text-error-text" },
  };
  const { label, icon: Icon, cls } = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// ─── Ordner-Picker ────────────────────────────────────────────────────────────

interface BrowseResult {
  current: string;
  parent: string | null;
  dirs: { name: string; path: string }[];
}

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

function FolderPickerDialog({ onSelect, onClose }: FolderPickerProps) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browse = async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `/api/fs/browse?path=${encodeURIComponent(path)}`
        : "/api/fs/browse";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Fehler"); return; }
      setData(json);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { browse(); }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-warning-muted" />
            <h3 className="font-semibold text-neutral-900">Ordner auswählen</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pfad-Anzeige */}
        {data && (
          <div className="px-5 py-2 bg-neutral-50 border-b text-xs font-mono text-neutral-600 truncate">
            {data.current}
          </div>
        )}

        {/* Verzeichnis-Liste */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-neutral-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade…
            </div>
          )}
          {error && (
            <p className="text-sm text-error px-2 py-4">{error}</p>
          )}
          {!loading && data && (
            <ul className="space-y-0.5">
              {/* Übergeordneter Ordner */}
              {data.parent && (
                <li>
                  <button
                    onClick={() => browse(data.parent!)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100 transition-colors"
                  >
                    <ChevronUp className="h-4 w-4 flex-shrink-0" />
                    <span className="font-mono">..</span>
                  </button>
                </li>
              )}
              {data.dirs.length === 0 && (
                <li className="text-sm text-neutral-400 px-3 py-4 text-center">
                  Keine Unterordner vorhanden
                </li>
              )}
              {data.dirs.map((dir) => (
                <li key={dir.path}>
                  <button
                    onClick={() => browse(dir.path)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-warning-subtle hover:text-warning-dark transition-colors group"
                  >
                    <Folder className="h-4 w-4 flex-shrink-0 text-warning-muted group-hover:text-warning-muted" />
                    <span className="flex-1 text-left truncate">{dir.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-warning-muted flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-400 font-mono truncate flex-1">
            {data?.current ?? ""}
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
            <Button
              size="sm"
              disabled={!data}
              onClick={() => data && onSelect(data.current)}
            >
              Diesen Ordner wählen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add-Konnektor-Dialog ──────────────────────────────────────────────────────

interface AddDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddConnectorDialog({ onClose, onSaved }: AddDialogProps) {
  const [type, setType] = useState<ConnectorType>("filesystem");
  const [name, setName] = useState("");
  const [watchPath, setWatchPath] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [mailbox, setMailbox] = useState("INBOX");
  const [tls, setTls] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { setError("Bitte einen Namen eingeben."); return; }

    const config =
      type === "filesystem"
        ? { watchPath: watchPath.trim() }
        : { host: host.trim(), port: parseInt(port), user: user.trim(), password, mailbox: mailbox.trim(), tls };

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim(), config }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler beim Speichern."); return; }
      onSaved();
      onClose();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    {showPicker && (
      <FolderPickerDialog
        onSelect={(path) => { setWatchPath(path); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Konnektor hinzufügen</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Typ-Auswahl */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Typ</label>
            <div className="grid grid-cols-2 gap-2">
              {(["filesystem", "email"] as ConnectorType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    type === t
                      ? "border-brand bg-brand-subtle text-brand-text"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {t === "filesystem" ? <Folder className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  {t === "filesystem" ? "Dateisystem" : "E-Mail (IMAP)"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "filesystem" ? "Eingangsordner Büro" : "Kanzlei-Email"}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Typ-spezifische Felder */}
          {type === "filesystem" ? (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Ordnerpfad</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={watchPath}
                  onChange={(e) => setWatchPath(e.target.value)}
                  placeholder="/Users/kanzlei/eingang"
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand font-mono min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors flex-shrink-0"
                  title="Ordner auswählen"
                >
                  <FolderOpen className="h-4 w-4 text-warning-muted" />
                  Durchsuchen
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Absoluter Pfad zu dem Ordner, der auf neue PDFs überwacht werden soll.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">IMAP-Server</label>
                  <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="imap.gmail.com" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Port</label>
                  <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Benutzername / E-Mail</label>
                <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="kanzlei@example.com" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Passwort</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Mailbox</label>
                  <input type="text" value={mailbox} onChange={(e) => setMailbox(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input type="checkbox" checked={tls} onChange={(e) => setTls(e.target.checked)} className="rounded" />
                    TLS/SSL
                  </label>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Bei Gmail: App-Passwort verwenden und IMAP in den Einstellungen aktivieren.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (type === "email" ? "Verbinde…" : "Speichern…") : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Interval-Optionen ────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 h" },
  { value: 120, label: "2 h" },
];

function nextSyncLabel(lastSyncAt: string | null, intervalMinutes: number): string {
  if (!lastSyncAt) return "Ausstehend";
  const next = new Date(new Date(lastSyncAt).getTime() + intervalMinutes * 60 * 1000);
  const diff = next.getTime() - Date.now();
  if (diff <= 0) return "Fällig";
  const m = Math.ceil(diff / 60000);
  if (m < 60) return `in ${m} min`;
  return `in ${Math.ceil(m / 60)} h`;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function KonnektorenPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadConnectors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connectors");
      if (res.ok) setConnectors(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConnectors(); }, []);

  const handleSync = async (connector: Connector) => {
    setSyncing(connector.id);
    try {
      const res = await fetch(`/api/connectors/${connector.id}/sync`, { method: "POST" });
      if (res.ok) await loadConnectors();
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (connector: Connector) => {
    if (!confirm(`Konnektor "${connector.name}" wirklich löschen?`)) return;
    await fetch(`/api/connectors/${connector.id}`, { method: "DELETE" });
    setConnectors((prev) => prev.filter((c) => c.id !== connector.id));
  };

  const handleToggleEnabled = async (connector: Connector) => {
    const newEnabled = !connector.enabled;
    setConnectors((prev) =>
      prev.map((c) => c.id === connector.id ? { ...c, enabled: newEnabled } : c)
    );
    await fetch(`/api/connectors/${connector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled }),
    });
  };

  const handleIntervalChange = async (connector: Connector, minutes: number) => {
    setConnectors((prev) =>
      prev.map((c) => c.id === connector.id ? { ...c, pollIntervalMinutes: minutes } : c)
    );
    await fetch(`/api/connectors/${connector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollIntervalMinutes: minutes }),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Konnektoren</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Automatische Dokumentenüberwachung und -verarbeitung
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Konnektor hinzufügen
        </Button>
      </div>

      {showAdd && (
        <AddConnectorDialog onClose={() => setShowAdd(false)} onSaved={loadConnectors} />
      )}

      {/* Info-Box */}
      <div className="bg-brand-subtle border border-brand-border rounded-xl p-4 mb-6 text-sm text-brand-dark">
        <p className="font-medium mb-1">Wie funktionieren Konnektoren?</p>
        <p>
          Konnektoren überwachen automatisch Ordner oder E-Mail-Postfächer auf neue Dokumente.
          Eingehende PDFs werden per KI analysiert, der richtigen Akte zugeordnet und —
          bei VInsO-Formularen — automatisch extrahiert.
        </p>
      </div>

      {/* Connector-Liste */}
      {loading ? (
        <div className="p-12 text-center text-neutral-400">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-30" />
          <p>Konnektoren werden geladen…</p>
        </div>
      ) : connectors.length === 0 ? (
        <div className="p-16 text-center text-neutral-400 border-2 border-dashed rounded-2xl">
          <div className="flex justify-center gap-4 mb-4 opacity-30">
            <Folder className="h-12 w-12" />
            <Mail className="h-12 w-12" />
          </div>
          <p className="text-lg font-medium text-neutral-600">Noch keine Konnektoren konfiguriert</p>
          <p className="text-sm mt-1">
            Fügen Sie einen Dateisystem- oder E-Mail-Konnektor hinzu, um automatisch Akten zu verarbeiten.
          </p>
          <Button onClick={() => setShowAdd(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Ersten Konnektor hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {connectors.map((connector) => {
            const enabled = connector.enabled ?? true;
            const interval = connector.pollIntervalMinutes ?? 15;
            return (
              <div
                key={connector.id}
                className={`bg-white rounded-xl border p-5 transition-opacity ${!enabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-2 rounded-lg ${
                      connector.type === "filesystem" ? "bg-warning-subtle" : "bg-brand-subtle"
                    }`}>
                      {connector.type === "filesystem" ? (
                        <Folder className="h-5 w-5 text-warning" />
                      ) : (
                        <Mail className="h-5 w-5 text-brand" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-neutral-900">{connector.name}</span>
                        <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                          {connector.type === "filesystem" ? "Dateisystem" : "E-Mail (IMAP)"}
                        </span>
                        <StatusChip status={connector.status} />
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                        {connector.type === "filesystem"
                          ? (connector.config as { watchPath: string }).watchPath
                          : `${(connector.config as { host: string; user: string }).user}@${(connector.config as { host: string }).host}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleEnabled(connector)}
                      title={enabled ? "Deaktivieren" : "Aktivieren"}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        enabled ? "bg-brand" : "bg-neutral-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${
                          enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleSync(connector)}
                      disabled={syncing === connector.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-subtle hover:bg-brand-light text-brand-text rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncing === connector.id ? "animate-spin" : ""}`} />
                      {syncing === connector.id ? "Läuft…" : "Sync jetzt"}
                    </button>
                    <button
                      onClick={() => handleDelete(connector)}
                      className="p-1.5 text-neutral-400 hover:text-error hover:bg-error-subtle rounded-lg transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sync-Settings + Stats */}
                <div className="mt-3 pt-3 border-t flex items-center gap-4 flex-wrap text-xs text-neutral-500">
                  {/* Interval Selector */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>Intervall:</span>
                    <select
                      value={interval}
                      onChange={(e) => handleIntervalChange(connector, Number(e.target.value))}
                      className="text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand text-neutral-700"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {enabled && (
                    <span className="text-neutral-400">
                      Nächster Sync: {nextSyncLabel(connector.lastSyncAt, interval)}
                    </span>
                  )}

                  <span className="flex items-center gap-1">
                    Letzter Sync: {formatDate(connector.lastSyncAt)}
                  </span>

                  {connector.lastSyncResult && (
                    <span className={connector.status === "error" ? "text-error" : "text-success"}>
                      {connector.lastSyncResult}
                    </span>
                  )}
                  {connector.processedCount > 0 && (
                    <span>{connector.processedCount} Dokument(e) verarbeitet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
