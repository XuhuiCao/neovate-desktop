/**
 * Categorises a Claude CLI stderr string into one of the known
 * user-actionable shapes. Used by the dev-workflow router middleware to
 * attach structured `data` to the `ORPCError` it throws, so the renderer
 * can render a localised Chinese sentence instead of the raw English
 * stderr line.
 *
 * Why per-shape:
 *   - The CLI rejects "set X to value V" when V already matches the
 *     scope's current value (`is already enabled/disabled at <scope>
 *     scope`). This is the symmetric form of the "already-installed"
 *     constraint and it surfaces every time `settings.local.json`
 *     overrides `settings.json` — the user sees the Switch flip back
 *     and a useless English error.
 *   - The `not found in marketplace` shape is rarer but its phrasing
 *     hints at the fix ("local marketplace copy may be out of date") —
 *     worth localising so users notice that hint.
 *
 * The matcher is intentionally permissive: real stderr may include
 * debug preamble or trailing whitespace; we look for the diagnostic
 * sentence anywhere in the string.
 *
 * Anything we don't recognise returns `{ kind: "unrecognized" }`; the
 * caller is expected to fall back to surfacing the raw stderr verbatim,
 * so the user still sees *something* (just not localised).
 */
import type { CliStderrCategory } from "../../../shared/features/dev-workflow/cli-error";

// `scope` is pinned to CLI's known set (user/project/local). Anything else
// falls through to `unrecognized` — the renderer then shows the raw stderr
// instead of fabricating a "foo 维度本来就是启用状态" message. Trades a
// rare future stderr rephrase for guaranteed-meaningful localisation.
const ALREADY_AT_SCOPE_RE = /is already (enabled|disabled) at (user|project|local) scope/i;
const NOT_FOUND_IN_MARKETPLACE_RE = /not found in marketplace "([^"]+)"/i;

export function classifyCliStderr(stderr: string): CliStderrCategory {
  const alreadyAt = stderr.match(ALREADY_AT_SCOPE_RE);
  if (alreadyAt) {
    const [, rawState, scope] = alreadyAt;
    const state = rawState.toLowerCase() as "enabled" | "disabled";
    return { kind: "alreadyAtScope", state, scope: scope.toLowerCase() };
  }
  const notFound = stderr.match(NOT_FOUND_IN_MARKETPLACE_RE);
  if (notFound) {
    return { kind: "notFoundInMarketplace", marketplace: notFound[1] };
  }
  return { kind: "unrecognized" };
}
