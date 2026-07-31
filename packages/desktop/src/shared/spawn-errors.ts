// Cross-process source of truth for detecting a TRANSIENT child_process.spawn
// failure — a bad/unavailable file descriptor at spawn-setup time under
// concurrent spawns (EBADF), or a transient resource shortage (EAGAIN). The
// child never launched in these cases, so the operation is safe to retry.
//
// NOT included: EMFILE (fd exhaustion — won't clear on a short backoff) or
// ENOENT (bad executable path — a permanent error). See
// docs/specs/2026-06-12-spawn-ebadf-concurrent-spawn-fix.md.

export const TRANSIENT_SPAWN_ERROR_CODES = ["EBADF", "EAGAIN"] as const;

const TRANSIENT_SPAWN_MESSAGE_RE = /spawn\s+(?:EBADF|EAGAIN)\b/i;

/**
 * Match a transient spawn-setup failure from an error MESSAGE string. Used by
 * the renderer (which only receives the serialized message over oRPC) and as a
 * fallback in main when `err.code` is not preserved — simple-git wraps the
 * original error in a `GitError` whose message reads `Error: spawn EBADF`.
 */
export function isTransientSpawnErrorMessage(message: string): boolean {
  return TRANSIENT_SPAWN_MESSAGE_RE.test(message);
}
