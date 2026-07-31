import { SendIcon } from "lucide-react";
import { memo, useMemo } from "react";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { Message, MessageActions, MessageContent } from "../../../components/ai-elements/message";
import { cn } from "../../../lib/utils";
import { CollapsibleUserText } from "./collapsible-user-text";
import { ImageOverlay } from "./image-overlay";
import { MessageRewindButton } from "./message-rewind-button";
import { ReactGrabCommentAttachment } from "./react-grab-comment-attachment";

type ImageFilePart = { type: "file"; url: string; mediaType: string; filename?: string };

function isImageFilePart(part: unknown): part is ImageFilePart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "file" &&
    "mediaType" in part &&
    typeof (part as { mediaType: unknown }).mediaType === "string" &&
    (part as { mediaType: string }).mediaType.startsWith("image/")
  );
}

function ImageThumbnail({ url, alt }: { url: string; alt?: string }) {
  return (
    <ImageOverlay src={url} alt={alt}>
      <img
        src={url}
        alt={alt ?? ""}
        className="h-20 w-20 rounded-lg object-cover ring-1 ring-border/50 cursor-zoom-in transition-opacity hover:opacity-80"
      />
    </ImageOverlay>
  );
}

export const UserMessageParts = memo(function UserMessageParts({
  message,
  sessionId,
  isStreaming = false,
}: {
  message: ClaudeCodeUIMessage;
  sessionId?: string;
  isStreaming?: boolean;
}) {
  const lastTextIndex = message.parts.findLastIndex((part) => part.type === "text");
  const imageFileParts = useMemo(() => message.parts.filter(isImageFilePart), [message.parts]);
  const firstImageIndex = message.parts.findIndex(isImageFilePart);
  const reactGrabComments = message.metadata?.reactGrabComments;

  return (
    <div className="flex flex-col gap-3 w-full">
      {reactGrabComments && (
        <div className="flex justify-end">
          <ReactGrabCommentAttachment payload={reactGrabComments} popupAlign="end" />
        </div>
      )}
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text": {
            const isLastText = index === lastTextIndex;
            const canShowUserActions = isLastText && !!sessionId;
            const remoteSource = isLastText ? message.metadata?.source : undefined;
            return (
              <Message
                key={`${message.id}-${index}`}
                data-key={`${message.id}-${index}`}
                data-testid="chat-message-user"
                from={message.role}
              >
                <MessageContent>
                  <CollapsibleUserText text={part.text} />
                </MessageContent>
                {remoteSource && (
                  <span className="mt-1 ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <SendIcon className="size-2.5" />
                    {remoteSource.platform.charAt(0).toUpperCase() + remoteSource.platform.slice(1)}
                  </span>
                )}
                {canShowUserActions && (
                  <MessageActions className="mt-1 ml-auto">
                    <MessageRewindButton
                      sessionId={sessionId!}
                      messageId={message.id}
                      disabled={isStreaming}
                    />
                  </MessageActions>
                )}
              </Message>
            );
          }
          case "file": {
            if (!isImageFilePart(part)) return null;
            if (index !== firstImageIndex) return null;
            return (
              <div
                key={`${message.id}-images`}
                className={cn("flex flex-wrap gap-1.5 justify-end")}
              >
                {imageFileParts.map((img, i) => (
                  <ImageThumbnail key={`${message.id}-img-${i}`} url={img.url} alt={img.filename} />
                ))}
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
});
