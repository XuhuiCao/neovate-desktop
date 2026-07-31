"use client";

import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStickToBottomContext } from "use-stick-to-bottom";

import type { ClaudeCodeUIMessage } from "../../../../shared/claude-code/types";

import { useAnchorPositions } from "../../features/agent/hooks/use-anchor-positions";
import { cn } from "../../lib/utils";

const MotionButton = motion.create("button");

export interface ConversationAnchorScrollbarProps {
  messages: ClaudeCodeUIMessage[];
  className?: string;
}

export function ConversationAnchorScrollbar({
  messages,
  className,
}: ConversationAnchorScrollbarProps) {
  const { t } = useTranslation();
  const { scrollRef, contentRef, isAtBottom } = useStickToBottomContext();
  const { anchors, scrollToMessage } = useAnchorPositions(
    scrollRef,
    contentRef,
    messages,
    isAtBottom,
  );
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || anchors.length === 0) return;

    let rafId = 0;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight === 0) return;
      const center = (scrollTop + clientHeight / 2) / scrollHeight;
      let idx = 0;
      for (let i = 0; i < anchors.length; i++) {
        if (anchors[i].topRatio <= center) idx = i;
      }
      if (activeIndexRef.current === idx) return;
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      cancelAnimationFrame(rafId);
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef, anchors]);

  const handleAnchorClick = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  if (messages.length === 0 || anchors.length <= 1) return null;

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-0 flex items-center overflow-hidden transition-[width,padding,opacity] pointer-events-none",
        // Compact + dimmed in a narrow chat container (@container/chat in agent-chat.tsx)
        "w-10 pr-5",
        "@max-[850px]/chat:w-6 @max-[850px]/chat:pr-2 @max-[850px]/chat:opacity-50 @max-[850px]/chat:hover:opacity-100",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col items-end gap-[6px] pointer-events-auto">
        <TooltipProvider delay={100} closeDelay={0}>
          {anchors.map((anchor, index) => (
            <Tooltip key={anchor.messageId}>
              <TooltipTrigger
                render={
                  <MotionButton
                    aria-label={t("chat.anchorScrollbar.goToMessage", { index: index + 1 })}
                    className={cn(
                      "relative shrink-0 cursor-pointer rounded-full origin-right",
                      "before:absolute before:-inset-x-[4px] before:-inset-y-[3px] before:content-['']",
                      "transition-[transform,background-color] duration-200",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                      "h-1 w-2 @max-[850px]/chat:h-0.5 @max-[850px]/chat:w-1.5",
                      index === activeIndex
                        ? "bg-primary/45"
                        : isHovered
                          ? "bg-primary/25"
                          : "bg-primary/15",
                      isHovered && "hover:scale-x-[1.75] hover:bg-primary/60",
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    onClick={() => handleAnchorClick(anchor.messageId)}
                    type="button"
                  />
                }
              />
              {anchor.summary && (
                <TooltipPopup side="left" sideOffset={10}>
                  <p className="max-w-48 text-xs leading-relaxed">{anchor.summary}</p>
                </TooltipPopup>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
