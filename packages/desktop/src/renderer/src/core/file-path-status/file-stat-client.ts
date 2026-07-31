import type { FileStat } from "../../../../shared/features/fs/contract";

import { client } from "../../orpc";

export type StatManyFiles = (paths: readonly string[]) => Promise<Array<FileStat | null>>;

export const statManyFiles: StatManyFiles = (paths) => client.fs.statMany([...paths]);

export async function statFileNow(
  absolutePath: string,
  signal: AbortSignal,
): Promise<FileStat | null> {
  const results = await client.fs.statMany([absolutePath], { signal });
  if (results.length !== 1) {
    throw new Error(`fs.statMany returned ${results.length} results for one path`);
  }
  return results[0] ?? null;
}
