/**
 * Structured categorisation of a Claude CLI stderr line, used as the
 * `data` field of `ORPCError` instances thrown by the dev-workflow
 * router. The renderer reads this off the deserialised error to render
 * a localised toast description instead of the raw English stderr.
 *
 * Categories are intentionally narrow — we only enumerate the ones the
 * user can act on. Anything else collapses to `"unrecognized"` and the
 * renderer falls back to surfacing the original `err.message`.
 */
export type CliStderrCategory =
  | { kind: "alreadyAtScope"; state: "enabled" | "disabled"; scope: string }
  | { kind: "notFoundInMarketplace"; marketplace: string }
  | { kind: "unrecognized" };
