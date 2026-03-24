"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KonnektorenPage from "../konnektoren/page";
import StatusPage from "../status/page";
import SettingsPage from "../settings/page";
import TagSettingsPage from "../settings/tags/page";

type Tab = "konnektoren" | "aktivitaet" | "ki-einstellungen" | "tags";

const TABS: { id: Tab; label: string }[] = [
  { id: "konnektoren", label: "Konnektoren" },
  { id: "aktivitaet", label: "Aktivitätsprotokoll" },
  { id: "ki-einstellungen", label: "KI-Einstellungen" },
  { id: "tags", label: "Tags & Namespaces" },
];

export default function EinstellungenPage() {
  const [tab, setTab] = useState<Tab>("konnektoren");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Page title */}
      <div className="mb-6">
        <Link
          href="/akten"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Akten
        </Link>
        <h1 className="text-xl font-bold text-neutral-900">Einstellungen</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Konnektoren, Aktivitätsprotokoll und KI-Konfiguration</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-brand text-brand-text"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "konnektoren" && <KonnektorenPage />}
      {tab === "aktivitaet" && <StatusPage />}
      {tab === "ki-einstellungen" && <SettingsPage />}
      {tab === "tags" && <TagSettingsPage />}
    </div>
  );
}
