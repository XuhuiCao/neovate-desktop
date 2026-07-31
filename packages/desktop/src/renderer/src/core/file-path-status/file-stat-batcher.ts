import type { FileStat } from "../../../../shared/features/fs/contract";
import type { StatManyFiles } from "./file-stat-client";

export const FILE_STAT_BATCH_WINDOW_MS = 16;
export const STAT_MANY_BATCH_SIZE = 100;

interface Request {
  path: string;
  promise: Promise<FileStat | null>;
  resolve: (value: FileStat | null) => void;
  reject: (reason: unknown) => void;
}

export interface FileStatBatcher {
  load(absolutePath: string): Promise<FileStat | null>;
  reset(): void;
}

function makeRequest(path: string): Request {
  let resolve!: Request["resolve"];
  let reject!: Request["reject"];
  const promise = new Promise<FileStat | null>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { path, promise, resolve, reject };
}

export function createFileStatBatcher(statMany: StatManyFiles): FileStatBatcher {
  const requests = new Map<string, Request>();
  let pending: Request[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const settle = (request: Request, action: () => void): void => {
    action();
    if (requests.get(request.path) === request) requests.delete(request.path);
  };

  const dispatch = async (chunk: readonly Request[]): Promise<void> => {
    try {
      const results = await statMany(chunk.map((request) => request.path));
      if (results.length !== chunk.length) {
        throw new Error(`fs.statMany returned ${results.length} results for ${chunk.length} paths`);
      }
      chunk.forEach((request, index) => {
        settle(request, () => request.resolve(results[index] ?? null));
      });
    } catch (error) {
      chunk.forEach((request) => {
        settle(request, () => request.reject(error));
      });
    }
  };

  const flush = (): void => {
    timer = null;
    const snapshot = pending;
    pending = [];
    for (let start = 0; start < snapshot.length; start += STAT_MANY_BATCH_SIZE) {
      void dispatch(snapshot.slice(start, start + STAT_MANY_BATCH_SIZE));
    }
  };

  return {
    load(absolutePath) {
      const existing = requests.get(absolutePath);
      if (existing) return existing.promise;

      const request = makeRequest(absolutePath);
      requests.set(absolutePath, request);
      pending.push(request);
      timer ??= setTimeout(flush, FILE_STAT_BATCH_WINDOW_MS);
      return request.promise;
    },

    reset() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = [];
      const error = new Error("file stat batcher reset");
      for (const request of requests.values()) request.reject(error);
      requests.clear();
    },
  };
}
