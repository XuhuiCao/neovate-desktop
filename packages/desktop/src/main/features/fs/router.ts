import { implement } from "@orpc/server";

import type { AppContext } from "../../router";

import { fsContract } from "../../../shared/features/fs/contract";

const os = implement({ fs: fsContract }).$context<AppContext>();

export const fsRouter = os.fs.router({
  readTextFile: os.fs.readTextFile.handler(async ({ input, context }) => {
    return context.fsService.readTextFile(input.path);
  }),

  writeTextFile: os.fs.writeTextFile.handler(async ({ input, context }) => {
    return context.fsService.writeTextFile(input.path, input.content);
  }),

  stat: os.fs.stat.handler(async ({ input, context }) => {
    return context.fsService.stat(input.path);
  }),

  statMany: os.fs.statMany.handler(async ({ input, context }) => {
    return context.fsService.statMany(input);
  }),
});
