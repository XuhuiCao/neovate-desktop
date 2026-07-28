import debug from "debug";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

const log = debug("neovate:claude-code-plugins");

type MarketplaceEntry = { autoUpdate?: boolean } & Record<string, unknown>;
type SettingsFile = {
  extraKnownMarketplaces?: Record<string, MarketplaceEntry>;
} & Record<string, unknown>;

function claudeSettingsPath(home: string): string {
  return path.join(home, ".claude", "settings.json");
}

/**
 * Parse `<home>/.claude/settings.json`. Returns `null` when the file is
 * missing, unreadable, or not a JSON object — callers treat all three the
 * same ("no setting"), and never clobber an unparsable file.
 */
async function readSettingsOrNull(settingsPath: string): Promise<SettingsFile | null> {
  let raw: string;
  try {
    raw = await readFile(settingsPath, "utf8");
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? (json as SettingsFile) : null;
  } catch {
    return null;
  }
}

/**
 * Read the user-scope `autoUpdate` flag Claude Code uses for `name` —
 * `~/.claude/settings.json` → `extraKnownMarketplaces[name].autoUpdate`.
 * Anything absent/false/unreadable reads as `false`.
 */
export async function getMarketplaceAutoUpdate(home: string, name: string): Promise<boolean> {
  const settings = await readSettingsOrNull(claudeSettingsPath(home));
  return settings?.extraKnownMarketplaces?.[name]?.autoUpdate === true;
}

/**
 * Set that same `autoUpdate` flag, touching only that one key and preserving
 * every other key in the file. No-op (with a log) when the marketplace isn't
 * already registered in `extraKnownMarketplaces` — this writer never creates
 * a marketplace entry, only flips its flag. Write is atomic (tmp + rename) so
 * `settings.json` is never left half-written.
 */
export async function setMarketplaceAutoUpdate(
  home: string,
  name: string,
  enabled: boolean,
): Promise<void> {
  const settingsPath = claudeSettingsPath(home);
  const settings = await readSettingsOrNull(settingsPath);
  const entry = settings?.extraKnownMarketplaces?.[name];
  if (!settings || !entry) {
    log("setMarketplaceAutoUpdate no-op: %s absent from extraKnownMarketplaces", name);
    return;
  }
  const updated: SettingsFile = {
    ...settings,
    extraKnownMarketplaces: {
      ...settings.extraKnownMarketplaces,
      [name]: { ...entry, autoUpdate: enabled },
    },
  };
  const tmp = `${settingsPath}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(updated, null, 2) + "\n");
  await rename(tmp, settingsPath);
}
