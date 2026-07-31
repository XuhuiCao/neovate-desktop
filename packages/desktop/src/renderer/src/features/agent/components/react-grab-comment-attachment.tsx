import { Button } from "@neo/ui/components/button";
import {
  CheckIcon,
  ImageOffIcon,
  MessageSquareTextIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import type { ReactGrabCommentPayload } from "../../../../../shared/claude-code/types";

import { buildNeoFileSchemeUrl } from "../../../../../shared/features/file/protocol";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../components/ui/hover-card";
import { cn } from "../../../lib/utils";

type Props = {
  payload: ReactGrabCommentPayload;
  onRemove?: () => void;
  onDeleteComment?: (commentId: string) => void;
  onUpdateComment?: (commentId: string, commentText: string) => void;
  className?: string;
  popupAlign?: "start" | "center" | "end";
};

export function ReactGrabCommentAttachment({
  payload,
  onRemove,
  onDeleteComment,
  onUpdateComment,
  className,
  popupAlign = "start",
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const canEdit = Boolean(onDeleteComment || onUpdateComment);

  if (payload.count <= 0) return null;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "inline-flex h-8 cursor-default select-none items-center gap-1.5 rounded-md bg-muted/60 px-2 text-sm font-medium text-foreground ring-1 ring-border/60",
            className,
          )}
        >
          <MessageSquareTextIcon className="size-3.5 text-muted-foreground" />
          <span>{payload.summary}</span>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="-mr-1 size-5"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align={popupAlign} className="w-80 p-2">
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {payload.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 rounded-md p-1.5">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
                {comment.screenshotPath ? (
                  <img
                    src={buildNeoFileSchemeUrl(comment.screenshotPath)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageOffIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === comment.id ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={editingText}
                      className="min-h-16 resize-none rounded border bg-background px-2 py-1 text-sm leading-5 outline-none focus:border-primary"
                      onChange={(event) => setEditingText(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingId(null);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingId(null)}
                      >
                        <XIcon className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          onUpdateComment?.(comment.id, editingText);
                          setEditingId(null);
                        }}
                      >
                        <CheckIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-5">
                      {comment.commentText}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-0.5">
                        {onUpdateComment && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditingText(comment.commentText);
                            }}
                          >
                            <PencilIcon className="size-3" />
                          </Button>
                        )}
                        {onDeleteComment && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onDeleteComment(comment.id)}
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
