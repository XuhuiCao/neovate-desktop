import type { FileUIPart } from "ai";

import type { ImageAttachment } from "../../../../../shared/features/agent/types";

export function attachmentsToFileParts(attachments?: ImageAttachment[]): FileUIPart[] {
  if (!attachments || attachments.length === 0) return [];
  return attachments.map((a) => ({
    type: "file" as const,
    mediaType: a.mediaType,
    filename: a.filename,
    url: `data:${a.mediaType};base64,${a.base64}`,
  }));
}
