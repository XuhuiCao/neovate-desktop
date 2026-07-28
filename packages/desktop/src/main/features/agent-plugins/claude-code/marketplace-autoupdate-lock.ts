import debug from "debug";
import path from "node:path";
import * as lockfile from "proper-lockfile";

const log = debug("neovate:claude-code-plugins");

// A crashed holder is reclaimed after this long. proper-lockfile refreshes the
// lock's mtime on a heartbeat (~stale/2) while held, so an in-progress batch is
// never seen as stale — only a truly dead holder is reclaimed. This removes the
// hand-rolled-TTL steal race entirely.
const STALE_MS = 10 * 60_000;

/**
 * Best-effort cross-process advisory lock. Returns a release fn, or `null` when
 * another process already holds it (caller should skip — auto-update is
 * deferrable) or the lock cannot be taken (e.g. `~/.claude` missing). Uses
 * `proper-lockfile` (atomic mkdir + mtime staleness + heartbeat), which avoids
 * the steal/recreate TOCTOU of a hand-rolled O_EXCL lock. Advisory only:
 * cooperating Neo processes respect it; a raw `claude` in a terminal does not.
 */
export async function acquireAutoUpdateLock(home: string): Promise<(() => Promise<void>) | null> {
  // `realpath: false` — the resource need not exist; proper-lockfile creates
  // `<resource>.lock` as a directory beside it (its parent dir must exist).
  const resource = path.join(home, ".claude", ".plugin-autoupdate-with-neo");
  try {
    const release = await lockfile.lock(resource, {
      realpath: false,
      stale: STALE_MS,
      retries: 0, // held ⇒ fail fast and let the caller skip
      onCompromised: (err) => log("autoupdate lock compromised: %O", err), // never re-throw
    });
    return release;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ELOCKED") log("autoupdate lock held by another process — skipping");
    else log("autoupdate lock acquire failed: %O", err); // e.g. ENOENT (~/.claude missing)
    return null;
  }
}
