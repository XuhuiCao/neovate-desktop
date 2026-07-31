// packages/desktop/src/shared/features/chat/attachments/contract.ts
import { oc } from "@orpc/contract";
import { z } from "zod";

export const AttachmentTypeSchema = z.enum(["image"]); // future: "pdf" | "text" | …
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export type AttachmentErrorCode =
  | "invalid_media_type"
  | "write_failed"
  | "forbidden_path"
  | "not_found"
  | "read_failed";

export const SaveAttachmentResultSchema = z.object({
  attachmentId: z.string(),
  absolutePath: z.string(),
  name: z.string(),
});
export type SaveAttachmentResult = z.infer<typeof SaveAttachmentResultSchema>;

// Binary is carried as Blob/File — NOT Uint8Array. Codex verified the current
// message-port oRPC serializer does not round-trip a raw Uint8Array; it does
// support Blob/File. Task 0 spikes this before anything is built on it.
export const attachmentsContract = {
  save: oc
    .input(
      z.object({
        cwd: z.string(),
        type: AttachmentTypeSchema,
        name: z.string().optional(),
        mediaType: z.string(),
        file: z.instanceof(Blob), // File is a Blob subclass
      }),
    )
    .output(SaveAttachmentResultSchema),
};

// Reject oversized pastes before they cross the MessagePort / hit disk; large
// images also risk the model's per-image limit when the agent reads the file.
export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;
