import type { RewindFilesResult } from "@anthropic-ai/claude-agent-sdk";

import debug from "debug";
import path from "node:path";

import { MAX_DIFF_SIZE } from "./diff-constants";
import { SnapshotReader } from "./snapshot-reader";

const log = debug("neovate:turn-diff");

type RewindFiles = (
  userMessageId: string,
  options?: { dryRun?: boolean },
) => Promise<RewindFilesResult>;

export interface TurnFilesResult {
  filesChanged?: string[];
  error?: string;
}

export interface TurnFileDiff {
  success: boolean;
  data?: { oldContent: string; newContent: string };
  error?: string;
}

export interface TurnFileStat {
  path: string;
  insertions: number;
  deletions: number;
}

/**
 * Owns everything about a session's "what changed in turn N" view:
 * the SnapshotReader cache, the rewindFiles call, on-demand file diffs,
 * and per-file stat computation. SessionManager holds one per session.
 */
export class TurnDiffService {
  private readonly reader: SnapshotReader;

  constructor(
    sessionId: string,
    private readonly cwd: string,
    private readonly rewindFiles: RewindFiles,
  ) {
    this.reader = new SnapshotReader(sessionId, cwd);
  }

  async listChangedFiles(turnUserMessageId: string): Promise<TurnFilesResult> {
    try {
      const result = await this.rewindFiles(turnUserMessageId, { dryRun: true });
      return { filesChanged: result.filesChanged, error: result.error };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to get last turn files",
      };
    }
  }

  /** Cache the snapshot index for the just-completed turn (called on `result`). */
  cacheTurn(turnUserMessageId: string): void {
    this.reader.cacheCurrentTurn(turnUserMessageId);
  }

  /** Prefetch every snapshot row in the JSONL into the in-memory cache. */
  prefetchAllTurns(): void {
    this.reader.prefetchAll();
  }

  async readDiff(turnUserMessageId: string, file: string): Promise<TurnFileDiff> {
    const absPath = path.isAbsolute(file) ? file : path.resolve(this.cwd, file);
    const old = this.reader.readFile(turnUserMessageId, absPath);
    if (old === "file_too_large") return { success: false, error: "file_too_large" };
    if (old === "snapshot_unavailable") {
      log("readDiff: snapshot unavailable turn=%s file=%s", turnUserMessageId, absPath);
      return { success: false, error: "snapshot_unavailable" };
    }

    const { stat, readFile } = await import("node:fs/promises");
    let newContent = "";
    try {
      const s = await stat(absPath);
      if (s.size > MAX_DIFF_SIZE) {
        log("readDiff: current file too large (%d bytes)", s.size);
        return { success: false, error: "file_too_large" };
      }
      newContent = await readFile(absPath, "utf8");
    } catch (e) {
      log("readDiff: stat/read failed (file deleted?) err=%s", e instanceof Error ? e.message : e);
    }
    return { success: true, data: { oldContent: old, newContent } };
  }

  /**
   * Per-turn delta. Mirrors the SDK's `fileHistoryGetDiffStats` structure:
   * candidate set from snapshot data, parallel per-file processing with
   * per-file try/catch, `diffLines` for the line stats. Two modes:
   *
   *   - With `nextTurnId`: compares snapshot(turnId) vs snapshot(nextTurnId).
   *     Candidate set comes from `listChangedFilesBetween` (cheap
   *     backupFileName-identity filter), so any candidate is already known
   *     to differ — no fast-equality short-circuit needed.
   *
   *   - Without `nextTurnId`: last-turn fallback that compares snapshot(turnId)
   *     vs the current filesystem. Walks every file tracked at turn end and
   *     drops unchanged ones via content equality. Mirrors SDK's `null backup
   *     + pathExists` rule so files created in the turn count as changed.
   */
  async computeTurnChanges(turnId: string, nextTurnId?: string): Promise<TurnFileStat[]> {
    this.cacheTurn(turnId);
    if (nextTurnId) this.cacheTurn(nextTurnId);

    const candidates = nextTurnId
      ? this.reader.listChangedFilesBetween(turnId, nextTurnId)
      : this.reader.listFilesAt(turnId);
    if (!candidates?.length) return [];

    const results = await Promise.all(
      candidates.map(async (absPath) => {
        try {
          return await this.computeOneFileStat(absPath, turnId, nextTurnId);
        } catch (err) {
          log(
            "computeOneFileStat failed file=%s err=%s",
            absPath,
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      }),
    );
    return results.filter((r): r is TurnFileStat => r !== null);
  }

  private async computeOneFileStat(
    absPath: string,
    turnId: string,
    nextTurnId?: string,
  ): Promise<TurnFileStat | null> {
    const oldContent = this.reader.readPreTurnContent(turnId, absPath) ?? "";
    if (oldContent.length > MAX_DIFF_SIZE) {
      return { path: absPath, insertions: 0, deletions: 0 };
    }

    let newContent = "";
    let currentExists = true;
    if (nextTurnId) {
      newContent = this.reader.readPreTurnContent(nextTurnId, absPath) ?? "";
    } else {
      const { stat, readFile } = await import("node:fs/promises");
      try {
        const s = await stat(absPath);
        if (s.size > MAX_DIFF_SIZE) {
          return { path: absPath, insertions: 0, deletions: 0 };
        }
        newContent = await readFile(absPath, "utf8");
      } catch {
        currentExists = false;
      }
      if (oldContent === newContent) {
        // Mirror SDK fileHistoryGetDiffStats: when backupFileName is null
        // (file did not exist pre-turn) and the file exists now, count as
        // changed even though diffLines reports 0/0.
        if (currentExists && this.reader.preTurnBackupIsNull(turnId, absPath)) {
          return { path: absPath, insertions: 0, deletions: 0 };
        }
        return null;
      }
    }

    if (newContent.length > MAX_DIFF_SIZE) {
      return { path: absPath, insertions: 0, deletions: 0 };
    }

    const { diffLines } = await import("diff");
    const changes = diffLines(oldContent, newContent);
    let insertions = 0;
    let deletions = 0;
    for (const c of changes) {
      if (c.added) insertions += c.count ?? 0;
      else if (c.removed) deletions += c.count ?? 0;
    }
    return { path: absPath, insertions, deletions };
  }

  async computeFileStats(
    turnUserMessageId: string,
    filesChanged: string[],
  ): Promise<TurnFileStat[]> {
    const { structuredPatch } = await import("diff");
    const { stat, readFile } = await import("node:fs/promises");

    return Promise.all(
      filesChanged.map(async (filePath) => {
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.cwd, filePath);
        const oldContent = this.reader.readPreTurnContent(turnUserMessageId, absPath) ?? "";

        // Guard the old backup independently — a deleted file (stat throws)
        // skips the inner guard, leaving structuredPatch to chew through a
        // multi-MB backup.
        if (oldContent.length > MAX_DIFF_SIZE) {
          return { path: filePath, insertions: 0, deletions: 0 };
        }

        let newContent = "";
        try {
          const s = await stat(absPath);
          if (s.size > MAX_DIFF_SIZE) {
            return { path: filePath, insertions: 0, deletions: 0 };
          }
          newContent = await readFile(absPath, "utf8");
        } catch {
          // file deleted — let newContent stay empty string
        }

        const patch = structuredPatch("", "", oldContent, newContent, "", "", { context: 0 });
        let insertions = 0;
        let deletions = 0;
        for (const hunk of patch.hunks) {
          for (const line of hunk.lines) {
            if (line.startsWith("+")) insertions++;
            else if (line.startsWith("-")) deletions++;
          }
        }
        return { path: filePath, insertions, deletions };
      }),
    );
  }
}
