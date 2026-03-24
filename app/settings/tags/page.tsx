"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Tag, Trash2, ArrowRight, Settings2 } from "lucide-react";
import { TAG_SWATCHES, TAG_COLORS } from "@/lib/tags";
import type { Tag as TagType, NamespaceConfig } from "@/lib/tags";

function toSlug(label: string): string {
  return label.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function TagSettingsPage() {
  const [namespaces, setNamespaces] = useState<NamespaceConfig[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);

  // New namespace form
  const [newNsLabel, setNewNsLabel] = useState("");
  const [newNsParent, setNewNsParent] = useState("");
  const [newNsExclusive, setNewNsExclusive] = useState(false);
  const [creatingNs, setCreatingNs] = useState(false);

  // New tag form: keyed by namespace
  const [newTagForms, setNewTagForms] = useState<Record<string, { label: string; color: string }>>({});
  const [creatingTag, setCreatingTag] = useState<string | null>(null);

  // Move tag: tagId -> target namespace
  const [movingTag, setMovingTag] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [deletingNs, setDeletingNs] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nsRes, tagsRes] = await Promise.all([
      fetch("/api/namespaces").then((r) => r.json()).catch(() => []),
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
    ]);
    setNamespaces(nsRes as NamespaceConfig[]);
    setTags(tagsRes as TagType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExclusive = async (ns: NamespaceConfig) => {
    await fetch(`/api/namespaces/${encodeURIComponent(ns.namespace)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclusive: !ns.exclusive }),
    });
    await load();
  };

  const createNamespace = async () => {
    if (!newNsLabel.trim()) return;
    setCreatingNs(true);
    const slug = toSlug(newNsLabel.trim());
    const namespace = newNsParent ? `${newNsParent}/${slug}` : slug;
    await fetch("/api/namespaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace, label: newNsLabel.trim(), exclusive: newNsExclusive }),
    });
    setNewNsLabel(""); setNewNsParent(""); setNewNsExclusive(false);
    setCreatingNs(false);
    await load();
  };

  const createTag = async (namespace: string) => {
    const form = newTagForms[namespace];
    if (!form?.label.trim()) return;
    setCreatingTag(namespace);
    const name = toSlug(form.label.trim());
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace, name, label: form.label.trim(), color: form.color || "gray" }),
    });
    setNewTagForms((prev) => ({ ...prev, [namespace]: { label: "", color: "gray" } }));
    setCreatingTag(null);
    await load();
  };

  const moveTag = async (tag: TagType, targetNs: string) => {
    setMovingTag(tag.id);
    const name = toSlug(tag.name);
    await fetch(`/api/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namespace: targetNs, name }),
    });
    setMovingTag(null);
    await load();
  };

  const deleteTag = async (tagId: string) => {
    await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
    setDeletingTag(null);
    await load();
  };

  const deleteNamespace = async (namespace: string) => {
    await fetch(`/api/namespaces/${encodeURIComponent(namespace)}`, { method: "DELETE" });
    setDeletingNs(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // Build a list of all namespace strings that appear in tags but have no config
  const configuredNs = new Set(namespaces.map((n) => n.namespace));
  const unconfiguredNs = Array.from(new Set(tags.map((t) => t.namespace))).filter((ns) => !configuredNs.has(ns));

  const allNsOptions = [...namespaces.map((n) => n.namespace), ...unconfiguredNs];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Tag className="h-7 w-7 text-brand" />
        <h1 className="text-2xl font-bold text-neutral-900">Tags & Namespaces</h1>
      </div>

      {/* Namespace sections */}
      <div className="space-y-6">
        {namespaces.map((ns) => {
          const nsTags = tags.filter((t) => t.namespace === ns.namespace);
          const form = newTagForms[ns.namespace] ?? { label: "", color: "gray" };
          const tagsHaveNone = nsTags.length === 0;

          return (
            <section key={ns.namespace} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              {/* Namespace header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-semibold text-neutral-800 text-sm">{ns.label}</span>
                  <code className="text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                    {ns.namespace || "(global)"}
                  </code>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ns.exclusive}
                      onChange={() => toggleExclusive(ns)}
                      className="rounded"
                    />
                    Exklusiv
                  </label>
                  {tagsHaveNone && (
                    <button
                      onClick={() => setDeletingNs(ns.namespace)}
                      className="p-1 text-neutral-300 hover:text-error transition-colors"
                      title="Namespace löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {deletingNs === ns.namespace && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500">Löschen?</span>
                      <button onClick={() => deleteNamespace(ns.namespace)} className="text-error font-medium hover:underline">Ja</button>
                      <button onClick={() => setDeletingNs(null)} className="text-neutral-400 hover:underline">Nein</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tag list */}
              <div className="divide-y divide-neutral-50">
                {nsTags.length === 0 && (
                  <p className="text-xs text-neutral-400 px-4 py-3 italic">Noch keine Tags in diesem Namespace.</p>
                )}
                {nsTags.map((tag) => {
                  const swatch = TAG_SWATCHES[tag.color] ?? "bg-gray-400";
                  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
                  const tagMoveTarget = moveTarget[tag.id] ?? "";
                  return (
                    <div key={tag.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 group">
                      <span className={`h-3.5 w-3.5 rounded-full flex-shrink-0 ${swatch}`} />
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                        {tag.label}
                      </span>
                      <code className="text-[11px] text-neutral-400 font-mono">{tag.name}</code>
                      <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Move to namespace */}
                        <div className="flex items-center gap-1">
                          <select
                            value={tagMoveTarget}
                            onChange={(e) => setMoveTarget((p) => ({ ...p, [tag.id]: e.target.value }))}
                            className="text-xs border border-neutral-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                          >
                            <option value="">Verschieben …</option>
                            {allNsOptions.filter((n) => n !== ns.namespace).map((n) => (
                              <option key={n} value={n}>{n || "(global)"}</option>
                            ))}
                          </select>
                          {tagMoveTarget && (
                            <button
                              onClick={() => moveTag(tag, tagMoveTarget)}
                              disabled={movingTag === tag.id}
                              className="p-0.5 text-brand hover:text-brand-hover"
                            >
                              {movingTag === tag.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                        {/* Delete */}
                        {deletingTag === tag.id ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-neutral-500">Löschen?</span>
                            <button onClick={() => deleteTag(tag.id)} className="text-error font-medium hover:underline">Ja</button>
                            <button onClick={() => setDeletingTag(null)} className="text-neutral-400 hover:underline">Nein</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingTag(tag.id)}
                            className="p-1 text-neutral-300 hover:text-error transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add tag form */}
              <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center gap-2">
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setNewTagForms((p) => ({ ...p, [ns.namespace]: { ...form, label: e.target.value } }))}
                  onKeyDown={(e) => e.key === "Enter" && createTag(ns.namespace)}
                  placeholder="Neuer Tag …"
                  className="flex-1 text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand bg-white placeholder:text-neutral-400"
                />
                {/* Mini color picker */}
                <div className="flex gap-0.5 flex-wrap max-w-[120px]">
                  {(["gray", "blue", "green", "red", "orange", "purple", "sky", "teal", "amber", "rose"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagForms((p) => ({ ...p, [ns.namespace]: { ...form, color: c } }))}
                      className={`h-3.5 w-3.5 rounded-full ${TAG_SWATCHES[c]} ${form.color === c ? "ring-2 ring-offset-1 ring-neutral-500" : "opacity-60 hover:opacity-100"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => createTag(ns.namespace)}
                  disabled={!form.label.trim() || creatingTag === ns.namespace}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-brand text-white rounded-lg disabled:opacity-40 hover:bg-brand-hover transition-colors"
                >
                  {creatingTag === ns.namespace ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Hinzufügen
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Create new namespace */}
      <section className="mt-8 bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Neuen Namespace erstellen
        </h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-neutral-500 mb-1">Name / Label</label>
            <input
              type="text"
              value={newNsLabel}
              onChange={(e) => setNewNsLabel(e.target.value)}
              placeholder="z.B. Priorität"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs text-neutral-500 mb-1">Übergeordnet (optional)</label>
            <select
              value={newNsParent}
              onChange={(e) => setNewNsParent(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">(Kein übergeordneter Namespace)</option>
              {namespaces.map((n) => (
                <option key={n.namespace} value={n.namespace}>{n.label} ({n.namespace || "global"})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer mb-1">
              <input type="checkbox" checked={newNsExclusive} onChange={(e) => setNewNsExclusive(e.target.checked)} className="rounded" />
              Exklusiv
            </label>
          </div>
          <button
            onClick={createNamespace}
            disabled={!newNsLabel.trim() || creatingNs}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-hover disabled:opacity-40 transition-colors"
          >
            {creatingNs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Namespace erstellen
          </button>
        </div>
        {newNsLabel && (
          <p className="text-xs text-neutral-400 mt-2">
            Namespace-Pfad: <code className="bg-neutral-100 px-1 rounded">{newNsParent ? `${newNsParent}/${toSlug(newNsLabel)}` : toSlug(newNsLabel)}</code>
          </p>
        )}
      </section>
    </div>
  );
}
