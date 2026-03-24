/** Shared Tag types and pure helper functions — no Node.js dependencies, safe for client use */

export interface Tag {
  id: string;
  /**
   * Hierarchical namespace.
   * ""            → global tag, assignable to any entity
   * "akten"       → general akten tag (multiple allowed)
   * "akten/status"→ exclusive akten tag (only one per namespace)
   * "role", "team", etc. → user-specific tags
   */
  namespace: string;
  name: string;
  label: string;
  color: string;
}

/** Full path reference: "<namespace>/<name>", e.g. "role/rechtsanwalt", "akten/status/neu" */
export type TagRef = string;

/**
 * Splits a TagRef into namespace and name.
 * The last path segment is always the name; everything before it is the namespace.
 * e.g. "akten/status/neu" → { namespace: "akten/status", name: "neu" }
 *      "role/rechtsanwalt" → { namespace: "role", name: "rechtsanwalt" }
 */
export function parseTagRef(ref: TagRef): { namespace: string; name: string } {
  const lastSlash = ref.lastIndexOf("/");
  if (lastSlash === -1) return { namespace: "", name: ref };
  return { namespace: ref.slice(0, lastSlash), name: ref.slice(lastSlash + 1) };
}

/**
 * Returns true if this namespace is a sub-namespace (contains "/").
 * Sub-namespaces are exclusive: only one tag per sub-namespace per entity.
 * e.g. "akten/status" → true (exclusive), "akten" → false (multiple allowed)
 */
export function isExclusiveNamespace(namespace: string): boolean {
  return namespace.includes("/");
}

/** Returns a human-readable label from the last namespace segment, capitalized. */
export function namespaceLabel(namespace: string): string {
  if (!namespace) return "Übergreifend";
  const segment = namespace.split("/").pop() ?? namespace;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function getTagsByNamespace(tags: Tag[], namespace: string): Tag[] {
  return tags.filter((t) => t.namespace === namespace);
}

export function lookupTag(tags: Tag[], ref: TagRef): Tag | undefined {
  const { namespace, name } = parseTagRef(ref);
  return tags.find((t) => t.namespace === namespace && t.name === name);
}

export function resolveTags(allTags: Tag[], refs: TagRef[]): Tag[] {
  return refs.map((r) => lookupTag(allTags, r)).filter((t): t is Tag => t !== undefined);
}

/** Saturated swatch background for color pickers. All classes are static for Tailwind to include. */
export const TAG_SWATCHES: Record<string, string> = {
  sky:           "bg-sky-500",
  "sky-dark":    "bg-sky-700",
  blue:          "bg-blue-500",
  "blue-dark":   "bg-blue-700",
  cyan:          "bg-cyan-500",
  "cyan-dark":   "bg-cyan-700",
  teal:          "bg-teal-500",
  "teal-dark":   "bg-teal-700",
  emerald:       "bg-emerald-500",
  "emerald-dark":"bg-emerald-700",
  green:         "bg-green-500",
  "green-dark":  "bg-green-700",
  lime:          "bg-lime-500",
  yellow:        "bg-yellow-400",
  amber:         "bg-amber-500",
  orange:        "bg-orange-500",
  "orange-dark": "bg-orange-700",
  red:           "bg-red-500",
  "red-dark":    "bg-red-700",
  rose:          "bg-rose-500",
  pink:          "bg-pink-500",
  "pink-dark":   "bg-pink-700",
  fuchsia:       "bg-fuchsia-500",
  purple:        "bg-purple-500",
  "purple-dark": "bg-purple-700",
  violet:        "bg-violet-500",
  indigo:        "bg-indigo-500",
  "indigo-dark": "bg-indigo-700",
  gray:          "bg-gray-400",
  slate:         "bg-slate-400",
  zinc:          "bg-zinc-400",
  stone:         "bg-stone-400",
};

export interface NamespaceConfig {
  namespace: string;
  label: string;
  /** If true, only one tag from this namespace may be assigned per entity */
  exclusive: boolean;
}

/**
 * Returns whether a namespace is exclusive, using config when available.
 * Falls back to checking for "/" in the namespace string.
 */
export function isExclusiveNs(namespace: string, configs: NamespaceConfig[]): boolean {
  const cfg = configs.find((c) => c.namespace === namespace);
  if (cfg) return cfg.exclusive;
  return namespace.includes("/");
}

/** Tailwind color classes for each tag color value. Use TAG_COLORS[tag.color] ?? TAG_COLORS.gray */
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // ── Blues & Cyans ──────────────────────────────────────────────────────────
  sky:         { bg: "bg-sky-50",         text: "text-sky-700",         border: "border-sky-200"         },
  "sky-dark":  { bg: "bg-sky-100",        text: "text-sky-800",         border: "border-sky-300"         },
  blue:        { bg: "bg-blue-50",        text: "text-blue-700",        border: "border-blue-200"        },
  "blue-dark": { bg: "bg-blue-100",       text: "text-blue-800",        border: "border-blue-300"        },
  cyan:        { bg: "bg-cyan-50",        text: "text-cyan-700",        border: "border-cyan-200"        },
  "cyan-dark": { bg: "bg-cyan-100",       text: "text-cyan-800",        border: "border-cyan-300"        },
  // ── Greens ────────────────────────────────────────────────────────────────
  teal:          { bg: "bg-teal-50",       text: "text-teal-700",       border: "border-teal-200"       },
  "teal-dark":   { bg: "bg-teal-100",      text: "text-teal-800",       border: "border-teal-300"       },
  emerald:       { bg: "bg-emerald-50",    text: "text-emerald-700",    border: "border-emerald-200"    },
  "emerald-dark":{ bg: "bg-emerald-100",   text: "text-emerald-800",    border: "border-emerald-300"    },
  green:         { bg: "bg-green-50",      text: "text-green-700",      border: "border-green-200"      },
  "green-dark":  { bg: "bg-green-100",     text: "text-green-800",      border: "border-green-300"      },
  lime:          { bg: "bg-lime-50",       text: "text-lime-700",       border: "border-lime-200"       },
  // ── Yellows & Oranges ─────────────────────────────────────────────────────
  yellow: { bg: "bg-yellow-50",  text: "text-yellow-700",  border: "border-yellow-200"  },
  amber:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  orange: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  "orange-dark": { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  // ── Reds & Pinks ──────────────────────────────────────────────────────────
  red:         { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200"      },
  "red-dark":  { bg: "bg-red-100",     text: "text-red-800",      border: "border-red-300"      },
  rose:        { bg: "bg-rose-50",     text: "text-rose-700",     border: "border-rose-200"     },
  pink:        { bg: "bg-pink-50",     text: "text-pink-700",     border: "border-pink-200"     },
  "pink-dark": { bg: "bg-pink-100",    text: "text-pink-800",     border: "border-pink-300"     },
  // ── Purples ───────────────────────────────────────────────────────────────
  fuchsia:       { bg: "bg-fuchsia-50",   text: "text-fuchsia-700",   border: "border-fuchsia-200"   },
  purple:        { bg: "bg-purple-50",    text: "text-purple-700",    border: "border-purple-200"    },
  "purple-dark": { bg: "bg-purple-100",   text: "text-purple-800",    border: "border-purple-300"    },
  violet:        { bg: "bg-violet-50",    text: "text-violet-700",    border: "border-violet-200"    },
  indigo:        { bg: "bg-indigo-50",    text: "text-indigo-700",    border: "border-indigo-200"    },
  "indigo-dark": { bg: "bg-indigo-100",   text: "text-indigo-800",    border: "border-indigo-300"    },
  // ── Neutrals ──────────────────────────────────────────────────────────────
  gray:    { bg: "bg-gray-100",    text: "text-gray-600",    border: "border-gray-200"    },
  slate:   { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200"   },
  zinc:    { bg: "bg-zinc-100",    text: "text-zinc-600",    border: "border-zinc-200"    },
  stone:   { bg: "bg-stone-100",   text: "text-stone-600",   border: "border-stone-200"   },
};
