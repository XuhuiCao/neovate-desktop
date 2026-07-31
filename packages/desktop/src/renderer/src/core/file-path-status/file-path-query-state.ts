import { queryClient } from "../../lib/query-client";
import { orpcQueryUtils } from "../../orpc";

/** Fail closed after a fresh open-time check cannot confirm a regular file. */
export function markFilePathUnavailable(absolutePath: string): void {
  queryClient.setQueryData(orpcQueryUtils.fs.statMany.key({ input: [absolutePath] }), [null]);
}
