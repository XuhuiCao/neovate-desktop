import { implement } from "@orpc/server";

import type { AppContext } from "../../router";

import { tokenUsageContract } from "../../../shared/features/token-usage/contract";

const os = implement({ tokenUsage: tokenUsageContract }).$context<AppContext>();

export const tokenUsageRouter = os.tokenUsage.router({
  getSessionUsage: os.tokenUsage.getSessionUsage.handler(({ input, context }) => {
    return context.tokenReporter.getSessionUsage(input.sessionId);
  }),

  getTotalUsage: os.tokenUsage.getTotalUsage.handler(({ context }) => {
    return context.tokenReporter.getTotalUsage();
  }),
});
