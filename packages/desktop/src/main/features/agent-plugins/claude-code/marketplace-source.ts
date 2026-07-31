import type { MarketplaceEntry } from "../../../../shared/features/agent-plugins/claude-code/schemas";

/**
 * Does a marketplace registry entry actually point at the expected source?
 * Git/github sources compare against the source URL; directory/file sources
 * compare the absolute path. Anything else (an unrecognized source variant
 * we don't model) fails closed — we'd rather refuse than silently trust.
 *
 * Used by callers that want to defend against marketplace name-spoofing (an
 * attacker registering a marketplace with the same name pointing at their
 * own content). The generic service intentionally does *not* enforce this —
 * source-identity is caller policy, not a service concern.
 */
export function marketplaceSourceMatches(entry: MarketplaceEntry, expected: string): boolean {
  switch (entry.source) {
    case "git":
      return entry.url === expected;
    case "github":
      return entry.repo === expected;
    case "url":
      return entry.url === expected;
    case "directory":
      return entry.path === expected;
    case "file":
      return entry.path === expected;
    default:
      return false;
  }
}
