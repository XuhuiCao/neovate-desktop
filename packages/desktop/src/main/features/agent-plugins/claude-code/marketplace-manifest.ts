import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type { MarketplaceEntry } from "../../../../shared/features/agent-plugins/claude-code/schemas";

/**
 * Plain TS view of one plugin entry in a marketplace's `marketplace.json`.
 * We never need the full schema — only the fields the renderer uses.
 */
export type MarketplaceManifestPlugin = {
  name: string;
  description?: string;
  homepage?: string;
  /** Multi-shape (url / github / directory / file); we don't depth-parse. */
  source?: unknown;
};

export type MarketplaceManifest = {
  name: string;
  plugins: MarketplaceManifestPlugin[];
};

// `passthrough()` keeps any extra Claude-CLI-added fields without exploding
// when the manifest format adds something we don't model.
const PluginSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    homepage: z.string().optional(),
    source: z.unknown().optional(),
  })
  .passthrough();

const ManifestSchema = z
  .object({
    name: z.string(),
    plugins: z.array(PluginSchema),
  })
  .passthrough();

/**
 * Resolve the absolute path to a marketplace's `marketplace.json`, dispatching
 * on the registry entry's `source` type the way the Claude CLI models it:
 *
 *  - git / github / directory → `installLocation` is a DIRECTORY; the manifest
 *    lives at `<installLocation>/.claude-plugin/marketplace.json`.
 *  - url  → `installLocation` IS the downloaded JSON file.
 *  - file → `path` IS the local JSON file (`installLocation` is unusable, "/").
 */
function manifestPathFor(entry: MarketplaceEntry): string {
  switch (entry.source) {
    case "git":
    case "github":
    case "directory":
      return path.join(entry.installLocation, ".claude-plugin/marketplace.json");
    case "url":
      return entry.installLocation;
    case "file":
      return entry.path;
    default: {
      const _exhaustive: never = entry;
      throw new Error(`Unhandled marketplace source: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Read a marketplace's `marketplace.json` and return its parsed manifest. The
 * file's location depends on the entry's `source` type (see `manifestPathFor`).
 * Returns `null` when the manifest file is missing — caller decides whether
 * that's a hard error or "no plugins" (e.g. marketplace just got removed).
 * Throws on JSON-parse or schema-validation failure.
 */
export async function readMarketplaceManifest(
  entry: MarketplaceEntry,
): Promise<MarketplaceManifest | null> {
  const manifestPath = manifestPathFor(entry);
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const json = JSON.parse(raw);
  return ManifestSchema.parse(json);
}
