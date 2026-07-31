import type { FileStat } from "../../../../shared/features/fs/contract";

export const FILE_OPEN_STAT_TIMEOUT_MS = 2_000;

export interface OpenVerifiedFileDeps {
  statNow(path: string, signal: AbortSignal): Promise<FileStat | null>;
  openPath(path: string): Promise<boolean>;
  onOpenFailed(path: string): void;
  timeoutMs?: number;
}

export async function openVerifiedFilePath(
  absolutePath: string,
  deps: OpenVerifiedFileDeps,
): Promise<boolean> {
  let stat: FileStat | null;
  try {
    stat = await deps.statNow(
      absolutePath,
      AbortSignal.timeout(deps.timeoutMs ?? FILE_OPEN_STAT_TIMEOUT_MS),
    );
  } catch {
    return false;
  }

  if (stat?.isFile !== true) return false;

  let handled = false;
  try {
    handled = await deps.openPath(absolutePath);
  } catch {
    // Treat opener failures like an unclaimed path so the user gets feedback.
  }
  if (!handled) deps.onOpenFailed(absolutePath);
  return true;
}
