import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { QueuedMessage } from "../store";

import { cn } from "../../../lib/utils";
import { useAgentStore, useQueuedMessages } from "../store";
import { extractText } from "../utils/extract-text";
import { stripReactGrabCommentsFromText } from "../utils/react-grab-comments";
import { ReactGrabCommentAttachment } from "./react-grab-comment-attachment";

type Props = {
  sessionId: string;
  onEdit: (msg: QueuedMessage) => void;
};

export function QueuedMessagesPreview({ sessionId, onEdit }: Props) {
  const queued = useQueuedMessages(sessionId);
  if (queued.length === 0) return null;
  return (
    <div className="px-4 pb-2 pt-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {queued.map((q) => (
          <QueuedRow key={q.id} item={q} sessionId={sessionId} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

function QueuedRow({
  item,
  sessionId,
  onEdit,
}: {
  item: QueuedMessage;
  sessionId: string;
  onEdit: (msg: QueuedMessage) => void;
}) {
  const { t } = useTranslation();
  const text = stripReactGrabCommentsFromText(extractText(item.content));
  const hasAttachments = item.attachments.length > 0;
  const hasText = text.trim().length > 0;

  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const measureClamp = useCallback((el: HTMLDivElement | null) => {
    textRef.current = el;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, [text, expanded]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(item);
        }
      }}
      className={cn(
        "group relative flex flex-col items-end gap-1.5",
        "opacity-60 transition-opacity hover:opacity-90 focus-visible:opacity-90",
        "cursor-pointer outline-none",
      )}
      title={t("chat.queue.editHint")}
    >
      <div className="relative max-w-[78%] rounded-[10px] border border-dashed border-border bg-card px-3.5 py-2.5">
        {hasAttachments && (
          <div className={cn("flex flex-wrap gap-2", hasText && "mb-2")}>
            {item.attachments.map((a) => (
              <img
                key={a.id}
                src={`data:${a.mediaType};base64,${a.base64}`}
                alt=""
                className="h-[72px] w-[72px] rounded-md object-cover ring-1 ring-border/50"
              />
            ))}
          </div>
        )}
        {item.reactGrabComments && (
          <div className={cn((hasAttachments || hasText) && "mb-2")}>
            <ReactGrabCommentAttachment payload={item.reactGrabComments} popupAlign="end" />
          </div>
        )}
        {hasText && (
          <div className="relative">
            <div
              ref={measureClamp}
              className={cn(
                "whitespace-pre-wrap break-words text-sm leading-[1.55]",
                !expanded && "line-clamp-4",
              )}
            >
              {text}
            </div>
            {isClamped && !expanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
            )}
            {isClamped && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUpIcon className="h-3 w-3" />
                    {t("chat.queue.collapse")}
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-3 w-3" />
                    {t("chat.queue.expand")}
                  </>
                )}
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          aria-label={t("chat.queue.discardAria")}
          onClick={(e) => {
            e.stopPropagation();
            useAgentStore.getState().removeQueued(sessionId, item.id);
          }}
          className={cn(
            "absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full",
            "bg-black/70 text-white opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100",
          )}
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
      <div className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="font-mono text-[10.5px] uppercase tracking-[.14em]">
          {t("chat.queue.label")}
        </span>
        <span className="text-[10.5px]">{t("chat.queue.autoSendHint")}</span>
      </div>
    </div>
  );
}
