import debug from "debug";
import { readFileSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute, relative, sep } from "node:path";

import { encodeProjectPath } from "../../../shared/claude-code/paths";
import { MAX_DIFF_SIZE } from "./diff-constants";

const log = debug("neovate:snapshot-reader");

type BackupEntry = { backupFileName: string | null; version: number };
type SnapshotBackups = Record<string, BackupEntry>;

const MARKER = "file-history-snapshot";

export class SnapshotReader {
  private turnSnapshots = new Map<string, SnapshotBackups>();
  private jsonlPath: string | undefined;

  constructor(
    private sessionId: string,
    private cwd: string,
  ) {
    log("init sessionId=%s cwd=%s", sessionId, cwd);
  }

  /** Resolve JSONL path lazily — the file may not exist when SnapshotReader is constructed. */
  private getJsonlPath(): string | undefined {
    if (!this.jsonlPath) {
      this.jsonlPath = resolveJsonlPath(this.sessionId, this.cwd);
    }
    return this.jsonlPath;
  }

  /** Streaming：result 时调，读 JSONL 尾部缓存本 turn 的 snapshot 索引 */
  cacheCurrentTurn(turnUserMessageId: string): void {
    if (this.turnSnapshots.has(turnUserMessageId)) return;
    const snapshot = this.findSnapshotInJsonl(turnUserMessageId);
    if (snapshot) this.turnSnapshots.set(turnUserMessageId, snapshot);
  }

  /**
   * Read the JSONL once and cache every snapshot row keyed by messageId
   * (last occurrence wins, mirroring findSnapshotInJsonl). Cold-load can
   * call this upfront so per-turn lookups are pure in-memory hits.
   */
  prefetchAll(): void {
    const jsonlPath = this.getJsonlPath();
    if (!jsonlPath) return;
    try {
      const content = readFileSync(jsonlPath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line || !line.includes(MARKER)) continue;
        try {
          const row = JSON.parse(line);
          if (row.type !== MARKER) continue;
          const messageId = row.snapshot?.messageId;
          if (!messageId) continue;
          // Forward iteration, overwrite → last occurrence wins.
          this.turnSnapshots.set(messageId, row.snapshot.trackedFileBackups ?? {});
        } catch {}
      }
    } catch (e) {
      log("prefetchAll failed: %s", e instanceof Error ? e.message : e);
    }
  }

  /** 读 pre-turn 文件内容（从 backup 文件） */
  readPreTurnContent(turnUserMessageId: string, filePath: string): string | undefined {
    const snapshot = this.turnSnapshots.get(turnUserMessageId);
    if (!snapshot) return undefined;
    const entry = this.findEntry(snapshot, filePath);
    if (!entry) return undefined;
    if (entry.backupFileName === null) return "";
    return readBackupFile(this.sessionId, entry.backupFileName);
  }

  /**
   * Mirrors SDK's `null backupFileName` semantics: the file did not exist in
   * the pre-turn snapshot. Used to apply SDK's rule "if backupFileName is null
   * and the file exists now, the turn created the file — count as changed".
   */
  preTurnBackupIsNull(turnUserMessageId: string, filePath: string): boolean {
    const snapshot = this.turnSnapshots.get(turnUserMessageId);
    if (!snapshot) return false;
    return this.findEntry(snapshot, filePath)?.backupFileName === null;
  }

  /** 读取某 turn 的备份文件内容。优先走已缓存的 snapshot，否则按需扫 JSONL 尾部。 */
  readFile(
    turnUserMessageId: string,
    filePath: string,
  ): string | "file_too_large" | "snapshot_unavailable" {
    const snapshot = this.loadSnapshot(turnUserMessageId);
    if (!snapshot) return "snapshot_unavailable";
    const result = this.readFromBackups(snapshot, filePath);
    return result === undefined ? "snapshot_unavailable" : result;
  }

  /**
   * All files tracked at this turn's snapshot, returned as absolute paths.
   * SDK snapshot inheritance + fileHistoryTrackEdit makes this equal to the
   * cumulative `state.trackedFiles` set as-of turn end. Returns undefined
   * when the snapshot is missing.
   */
  listFilesAt(turnUserMessageId: string): string[] | undefined {
    const snapshot = this.loadSnapshot(turnUserMessageId);
    if (!snapshot) return undefined;
    return Object.keys(snapshot).map((k) => this.denormalizeKey(k));
  }

  /**
   * Files whose pre-turn content differs between two snapshots, returned as
   * absolute paths. Identity check uses `backupFileName` — same backup file
   * means identical content (mirrors the SDK's reuse-vs-createBackup decision
   * in fileHistoryMakeSnapshot).
   *
   * Only files present in BOTH snapshots are considered. SDK snapshot
   * inheritance guarantees that a file tracked in turn K appears in every
   * snapshot from K onwards; therefore "in B but not A" means "first tracked
   * after turn A", i.e. turn A did not touch it. Returns undefined when
   * either snapshot is missing — caller treats that as no info.
   */
  listChangedFilesBetween(turnA: string, turnB: string): string[] | undefined {
    const a = this.loadSnapshot(turnA);
    const b = this.loadSnapshot(turnB);
    if (!a || !b) return undefined;
    const changed: string[] = [];
    for (const [k, entryA] of Object.entries(a)) {
      const entryB = b[k];
      if (!entryB) continue;
      if ((entryA.backupFileName ?? null) !== (entryB.backupFileName ?? null)) {
        changed.push(this.denormalizeKey(k));
      }
    }
    return changed;
  }

  private loadSnapshot(turnUserMessageId: string): SnapshotBackups | undefined {
    const cached = this.turnSnapshots.get(turnUserMessageId);
    if (cached) return cached;
    const fresh = this.findSnapshotInJsonl(turnUserMessageId);
    if (fresh) this.turnSnapshots.set(turnUserMessageId, fresh);
    return fresh;
  }

  private denormalizeKey(key: string): string {
    if (!key) return this.cwd;
    return isAbsolute(key) ? key : join(this.cwd, key);
  }

  private findSnapshotInJsonl(turnUserMessageId: string): SnapshotBackups | undefined {
    const jsonlPath = this.getJsonlPath();
    if (!jsonlPath) return undefined;
    try {
      const content = readFileSync(jsonlPath, "utf8");
      const lines = content.split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line || !line.includes(MARKER)) continue;
        try {
          const row = JSON.parse(line);
          if (row.type !== MARKER) continue;
          if (row.snapshot?.messageId !== turnUserMessageId) continue;
          return (row.snapshot.trackedFileBackups ?? {}) as SnapshotBackups;
        } catch {}
      }
    } catch (e) {
      log("findSnapshotInJsonl failed: %s", e instanceof Error ? e.message : e);
    }
    return undefined;
  }

  private readFromBackups(
    backups: SnapshotBackups,
    filePath: string,
  ): string | "file_too_large" | undefined {
    const entry = this.findEntry(backups, filePath);
    if (!entry) return undefined;
    if (entry.backupFileName === null) return "";
    const bp = backupFilePath(this.sessionId, entry.backupFileName);
    try {
      if (statSync(bp).size > MAX_DIFF_SIZE) return "file_too_large";
      return readFileSync(bp, "utf8");
    } catch (e) {
      log("readFromBackups failed: %s", e instanceof Error ? e.message : e);
      return undefined;
    }
  }

  /** Mirrors SDK's zq7: cwd-relative if inside cwd, absolute otherwise. */
  private normalizeKey(filePath: string): string {
    if (!isAbsolute(filePath)) return filePath;
    if (filePath === this.cwd) return "";
    if (filePath.startsWith(this.cwd + sep)) return relative(this.cwd, filePath);
    return filePath;
  }

  private findEntry(snapshot: SnapshotBackups, filePath: string): BackupEntry | undefined {
    return snapshot[this.normalizeKey(filePath)];
  }
}

function resolveJsonlPath(sessionId: string, cwd: string): string | undefined {
  const candidate = join(
    homedir(),
    ".claude",
    "projects",
    encodeProjectPath(cwd),
    `${sessionId}.jsonl`,
  );
  try {
    if (existsSync(candidate)) return candidate;
  } catch {}
  return undefined;
}

function backupFilePath(sessionId: string, backupFileName: string): string {
  return join(homedir(), ".claude", "file-history", sessionId, backupFileName);
}

function readBackupFile(sessionId: string, backupFileName: string): string {
  return readFileSync(backupFilePath(sessionId, backupFileName), "utf8");
}
