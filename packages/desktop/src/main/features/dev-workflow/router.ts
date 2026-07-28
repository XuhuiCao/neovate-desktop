import { implement } from "@orpc/server";

import type { AppContext } from "../../router";

import { devWorkflowContract } from "../../../shared/features/dev-workflow/contract";

const os = implement({ devWorkflow: devWorkflowContract }).$context<AppContext>();

export const devWorkflowRouter = os.devWorkflow.router({
  get: os.devWorkflow.get.handler(({ context }) => {
    return context.devWorkflowService.get();
  }),

  set: os.devWorkflow.set.handler(({ input, context }) => {
    return context.devWorkflowService.set(input);
  }),
});
