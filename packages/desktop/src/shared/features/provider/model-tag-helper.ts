import type { ModelTagName, ProviderModelEntry } from "./types";

import { MODEL_TAG_NAMES } from "./types";

const MODEL_TAG_NAME_SET = new Set<string>(MODEL_TAG_NAMES);

// Render order for the visible badges — mirrors the web nchat model dropdown
// (yuyanAssets). Names without an entry sort last.
const MODEL_TAG_DISPLAY_ORDER: Partial<Record<ModelTagName, number>> = {
  DEFAULT: 1,
  BETA: 2,
  CHAT: 3,
  MULTI_MODEL: 4,
  CONTEXT: 5,
};
const FALLBACK_TAG_DISPLAY_ORDER = 100;

// A tag that survives filtering always carries a non-empty display label (`cname`,
// server-provided). `value` is only set for length-style tags (CONTEXT: "1m").
export type VisibleModelTag = { name: ModelTagName; cname: string; value?: string };

// A CONTEXT-style value carries a length like "1m" / "256k". Empty or the literal
// "true" is treated as "no value" so a bare CONTEXT tag isn't shown without a length.
function contextValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "true") return undefined;
  return trimmed;
}

// The server marks the pre-selected model with a DEFAULT tag (value "true"); the
// desktop uses it to seed modelMap.model. Kept separate from the badge list because
// DEFAULT drives selection, not display.
export function isDefaultModel(entry: ProviderModelEntry): boolean {
  return Boolean(entry.tags?.some((tag) => tag.name === "DEFAULT" && tag.value === "true"));
}

// Visible badge tags for a model, deduped by name and ordered for display. Mirrors
// the web nchat model dropdown: a tag renders only when it is a known enum name AND
// the server gave it a non-empty localized `cname`. Unknown names and label-less
// tags are dropped (desktop's hardcoded providers carry no cname, so their tags
// don't render — consistent with web); CONTEXT additionally needs a length value.
export function getVisibleModelTags(entry: ProviderModelEntry): VisibleModelTag[] {
  const seen = new Set<string>();
  const tags: Array<VisibleModelTag & { index: number }> = [];

  (entry.tags ?? []).forEach((tag, index) => {
    const cname = typeof tag.cname === "string" ? tag.cname.trim() : "";
    if (!MODEL_TAG_NAME_SET.has(tag.name) || !cname || seen.has(tag.name)) return;
    if (tag.name === "CONTEXT") {
      const value = contextValue(tag.value);
      if (!value) return;
      seen.add(tag.name);
      tags.push({ name: tag.name, cname, value, index });
      return;
    }
    seen.add(tag.name);
    tags.push({ name: tag.name, cname, index });
  });

  return tags
    .sort((a, b) => {
      const ao = MODEL_TAG_DISPLAY_ORDER[a.name] ?? FALLBACK_TAG_DISPLAY_ORDER;
      const bo = MODEL_TAG_DISPLAY_ORDER[b.name] ?? FALLBACK_TAG_DISPLAY_ORDER;
      return ao - bo || a.index - b.index;
    })
    .map(({ index: _index, ...tag }) => tag);
}
