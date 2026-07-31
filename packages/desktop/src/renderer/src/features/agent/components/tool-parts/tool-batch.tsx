import type { ToolUIPart } from "ai";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@neo/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUITools,
} from "../../../../../../shared/claude-code/types";
import type { IndexedBatchPart } from "../../hooks/use-tool-batches";

import { Shimmer } from "../../../../components/ai-elements/shimmer";
import { cn } from "../../../../lib/utils";
import {
  computeBatchTrigger,
  type BatchTriggerLabel,
  type BucketCount,
} from "./compute-batch-trigger";

export type RenderToolPart = (
  message: ClaudeCodeUIMessage,
  part: ToolUIPart<ClaudeCodeUITools>,
) => ReactNode;

interface ToolBatchProps {
  message: ClaudeCodeUIMessage;
  parts: IndexedBatchPart[];
  renderToolPart: RenderToolPart;
  /**
   * Whether the trigger phrase should shimmer. Computed by the parent from
   * `isTrailing && isMessageStreaming` — the batch itself doesn't know either
   * signal alone and intentionally stays agnostic.
   */
  shouldShimmer: boolean;
  className?: string;
}

function useTriggerPhrase(label: BatchTriggerLabel): string {
  const { t } = useTranslation();
  return useMemo(() => {
    if (label.buckets.length === 0) {
      return t("chat.messages.toolBatch.fallback");
    }
    // Each bucket can contribute up to two segments — one for done tools (past
    // tense, e.g. "Read 3 files") and one for still-running tools (present
    // tense, e.g. "reading 1 file"). The done segment goes first within a
    // bucket because that's the chronologically earlier action.
    const segments: string[] = [];
    for (const bucket of label.buckets as BucketCount[]) {
      if (bucket.doneCount > 0) {
        segments.push(
          t(`chat.messages.toolBatch.bucket.${bucket.key}.done`, {
            count: bucket.doneCount,
          }),
        );
      }
      if (bucket.runningCount > 0) {
        segments.push(
          t(`chat.messages.toolBatch.bucket.${bucket.key}.active`, {
            count: bucket.runningCount,
          }),
        );
      }
    }
    return segments.join(t("chat.messages.toolBatch.bucket.separator"));
  }, [label, t]);
}

export function ToolBatch({
  message,
  parts,
  renderToolPart,
  shouldShimmer,
  className,
}: ToolBatchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const batchParts = useMemo(() => parts.map((p) => p.part), [parts]);
  const label = useMemo(() => computeBatchTrigger(batchParts), [batchParts]);
  const phrase = useTriggerPhrase(label);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted/50 rounded-md px-1 -mx-1",
        )}
      >
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 transition-transform duration-150",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
        {shouldShimmer ? (
          <Shimmer duration={2} as="span">
            {phrase}
          </Shimmer>
        ) : (
          <span>{phrase}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 flex flex-col gap-2">
        {parts
          // Reasoning parts stay in the batch data flow but never render
          // anywhere in the chat — the trigger shimmer is the only
          // thinking indicator we surface.
          .filter(({ part }) => part.type !== "reasoning")
          .map(({ part }) => {
            const toolPart = part as ToolUIPart<ClaudeCodeUITools>;
            return <div key={toolPart.toolCallId}>{renderToolPart(message, toolPart)}</div>;
          })}
      </CollapsibleContent>
    </Collapsible>
  );
}
