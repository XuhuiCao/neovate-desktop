// `attachments` is a feature assembled into the RPCHandler tree in buildRouter
// (main/router.ts). AttachmentService is injected via the AppContext
// ($context<AppContext>), like fs/worktree. The `.use(...)` middleware maps
// AttachmentServiceError → ORPCError so the renderer receives the
// AttachmentErrorCode as the message; without it RPCHandler masks non-ORPCError
// throws as "Internal server error".
import { implement, ORPCError } from "@orpc/server";

import type { AppContext } from "../../../router";

import { attachmentsContract } from "../../../../shared/features/chat/attachments/contract";
import { AttachmentServiceError } from "./service";

const os = implement({ chat: { attachments: attachmentsContract } })
  .$context<AppContext>()
  .use(async ({ next }) => {
    try {
      return await next();
    } catch (e) {
      if (e instanceof AttachmentServiceError) {
        // message is the AttachmentErrorCode; the renderer maps it to a toast.
        throw new ORPCError("BAD_REQUEST", { message: e.code });
      }
      throw e;
    }
  });

export const attachmentsRouter = os.chat.attachments.router({
  save: os.chat.attachments.save.handler(async ({ input, context }) =>
    context.attachmentService.save(input),
  ),
});
