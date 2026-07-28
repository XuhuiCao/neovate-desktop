import { EventPublisher } from "@orpc/server";
import { Mutex } from "async-mutex";
import debug from "debug";
import fs from "node:fs";
import git from "simple-git";

import type { CloneProgress } from "../../../shared/plugins/git/contract";

const log = debug("neovate:git:clone");

/**
 * Kill any git subprocess whose stdio is silent for this long.
 * This catches hung auth prompts (e.g. HTTPS URLs waiting for credentials
 * in a headless Electron environment) while leaving normal clone progress
 * unaffected — clone streams output continuously while receiving objects.
 */
const GIT_BLOCK_TIMEOUT_MS = 15_000;

/**
 * Convert an HTTPS git URL to SSH format.
 * e.g. https://github.com/org/repo → git@github.com:org/repo
 * Already-SSH URLs are returned unchanged.
 * URLs with an explicit port are not converted (SSH uses ~/.ssh/config).
 */
function toSshUrl(url: string): string {
  const match = url.match(/^https:\/\/([^/:]+)\/(.+)/);
  return match ? `git@${match[1]}:${match[2]}` : url;
}

/** Error messages that indicate an authentication / credential failure. */
const AUTH_ERROR_PATTERNS = [
  "could not read Username",
  "Authentication failed",
  "fatal: could not read",
  "Permission denied",
  "access denied",
  "HTTP 403",
  "HTTP 401",
  "status code 403",
  "status code 401",
  "timed out",
];

function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERNS.some((p) => message.includes(p));
}

export class CloneService {
  private _progress: CloneProgress | null = null;
  private disposed = false;
  private cloneMutex = new Mutex();
  /** AbortController to signal all active subscriptions to terminate */
  private abortController = new AbortController();
  readonly publisher = new EventPublisher<{ progress: CloneProgress }>();

  get progress(): CloneProgress | null {
    return this._progress;
  }

  private setProgress(progress: CloneProgress | null) {
    if (this.disposed) return;
    log("progress update %O", progress);
    this._progress = progress;
    if (progress) {
      this.publisher.publish("progress", progress);
    }
  }

  async clone(
    url: string,
    targetDir: string,
  ): Promise<{ success: boolean; data?: { path: string; name: string }; error?: string }> {
    if (this.disposed) {
      return { success: false, error: "CloneService has been disposed" };
    }

    // Serialize clone operations to prevent race conditions on shared progress state.
    return this.cloneMutex.runExclusive(async () => {
      if (this.disposed) {
        return { success: false, error: "CloneService has been disposed" };
      }

      log("clone: starting", { url, targetDir });

      this.setProgress({ phase: "initiating", percent: 0, message: "Starting clone..." });

      const sshUrl = toSshUrl(url);
      const shouldFallback = sshUrl !== url;

      try {
        const gitClient = git({
          timeout: { block: GIT_BLOCK_TIMEOUT_MS },
          unsafe: { allowUnsafeCustomBinary: true },
          progress: (data: {
            method: string;
            stage: string;
            progress: number;
            processed: number;
            total: number;
          }) => {
            if (this.disposed) return;
            log("progress callback: %O", data);

            const stage: CloneProgress["phase"] = [
              "compressing",
              "counting",
              "receiving",
              "resolving",
              "writing",
            ].includes(data.stage)
              ? (data.stage as CloneProgress["phase"])
              : "receiving";

            const message =
              data.total > 0
                ? `${data.stage.charAt(0).toUpperCase() + data.stage.slice(1)}... ${data.progress}% (${data.processed.toLocaleString()}/${data.total.toLocaleString()})`
                : "Connecting...";

            this.setProgress({
              phase: stage,
              percent: data.progress,
              message,
            });
          },
        });

        try {
          await gitClient.clone(url, targetDir);
        } catch (firstError) {
          // If HTTPS clone fails with an auth error or times out (likely
          // waiting for credential input that can't be provided in Electron),
          // retry with SSH which uses key-based auth.
          const msg = String(firstError);
          if (shouldFallback && isAuthError(msg)) {
            log("clone: HTTPS failed (%s), retrying with SSH: %s", msg.slice(0, 80), sshUrl);
            // Clean up partial clone artifacts before retrying
            fs.rmSync(targetDir, { recursive: true, force: true });
            this.setProgress({ phase: "initiating", percent: 0, message: "Retrying with SSH..." });
            await git({
              timeout: { block: GIT_BLOCK_TIMEOUT_MS },
              unsafe: { allowUnsafeCustomBinary: true },
            }).clone(sshUrl, targetDir);
          } else {
            throw firstError;
          }
        }
        const name = targetDir.split("/").pop() || "repo";

        log("clone: success", { path: targetDir, name });
        this.setProgress(null);

        return { success: true, data: { path: targetDir, name } };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Clone failed";
        log("clone: error", { error: errorMessage });
        this.setProgress({ phase: "error", percent: 0, message: errorMessage, error: true });

        // Reset after error
        setTimeout(() => this.setProgress(null), 1000);

        return { success: false, error: errorMessage };
      }
    });
  }

  /**
   * Get the AbortSignal for subscription cleanup.
   * Subscribers should pass this signal to publisher.subscribe().
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  dispose() {
    log("dispose: cleaning up CloneService");
    this.disposed = true;

    // Notify subscribers that service is being disposed
    this.setProgress({ phase: "error", percent: 0, message: "Service disposed", error: true });

    // Abort all active subscriptions - this will terminate any pending for-await loops
    this.abortController.abort();

    // Clear progress state
    this._progress = null;

    // Create a new AbortController in case service is reused (though typically not)
    this.abortController = new AbortController();
  }
}

export const cloneService = new CloneService();
