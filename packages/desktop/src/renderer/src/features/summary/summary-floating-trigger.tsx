import type { ReactNode } from "react";

import { CheckListIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PinIcon, PinOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { useSummaryTranslation } from "./i18n";
import { summaryPanelStore, useSummaryPanelMode } from "./summary-panel-store";
import SummaryView from "./summary-view";

// ─── Provider ────────────────────────────────────────────────────────────────

// The store is a global singleton — no React context is needed for state.
// This Provider exists solely to enforce the "floating popover is ephemeral"
// rule on chat-session remount, mirroring the previous behaviour.
export function SummaryPanelProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (summaryPanelStore.getState().mode === "floating") {
      summaryPanelStore.getState().setMode("closed");
    }
  }, []);
  return <>{children}</>;
}

// ─── Trigger Button + Floating Popover ───────────────────────────────────────

export function SummaryTriggerButton() {
  const { t } = useSummaryTranslation();
  const mode = useSummaryPanelMode();
  const setMode = summaryPanelStore.getState().setMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const isActive = mode !== "closed";

  const handleClick = () => {
    if (mode === "closed") {
      setMode("floating");
    } else {
      setMode("closed");
    }
  };

  // Click outside to close floating popover
  useEffect(() => {
    if (mode !== "floating") return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMode("closed");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode, setMode]);

  // Dynamic max-height for popover
  useEffect(() => {
    if (mode !== "floating" || !containerRef.current) return;

    function computeMaxHeight() {
      const triggerEl = containerRef.current;
      if (!triggerEl) return;
      const chatContainer = triggerEl.closest("[data-slot='chat-session']") as HTMLElement | null;
      if (!chatContainer) return;

      const chatColumn = chatContainer.querySelector(
        ":scope > div:first-child",
      ) as HTMLElement | null;
      const inputArea = chatColumn?.querySelector(":scope > div.shrink-0") as HTMLElement | null;
      const containerRect = chatContainer.getBoundingClientRect();
      const triggerBottom = triggerEl.getBoundingClientRect().bottom;

      const inputAreaHeight = inputArea ? inputArea.getBoundingClientRect().height : 140;
      const bottomReserve = inputAreaHeight + 16;
      const availableBelow = containerRect.bottom - triggerBottom - bottomReserve;
      setMaxHeight(Math.max(180, availableBelow));
    }

    computeMaxHeight();

    const observer = new ResizeObserver(computeMaxHeight);
    const chatContainer = containerRef.current.closest(
      "[data-slot='chat-session']",
    ) as HTMLElement | null;
    if (chatContainer) observer.observe(chatContainer);

    window.addEventListener("resize", computeMaxHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computeMaxHeight);
    };
  }, [mode]);

  if (mode === "pinned") return null;

  return (
    <div ref={containerRef} className="absolute top-3 right-3 z-[60]">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center justify-center rounded-md transition-[width,height,opacity,background-color,border-color]",
          "bg-background/60 backdrop-blur-md border border-border/40",
          "shadow-sm hover:bg-background/80",
          isActive && "bg-background/90 border-primary/30",
          // Compact + dimmed in a narrow chat container (@container/chat in agent-chat.tsx)
          "size-7 @max-[850px]/chat:size-6 @max-[850px]/chat:opacity-60 @max-[850px]/chat:hover:opacity-100",
        )}
      >
        <HugeiconsIcon
          icon={CheckListIcon}
          size={15}
          strokeWidth={1.8}
          className={cn(
            "text-muted-foreground @max-[850px]/chat:size-[13px]",
            isActive && "text-primary",
          )}
        />
      </button>

      {mode === "floating" && (
        <div
          className={cn(
            "absolute top-9 right-0 w-72",
            "rounded-lg border border-border/60 bg-popover shadow-lg",
            "animate-in fade-in slide-in-from-top-1 duration-150",
          )}
          style={{ maxHeight: maxHeight ? `${maxHeight}px` : "min(400px, 50vh)" }}
        >
          <div
            className="overflow-y-auto overscroll-contain"
            style={{
              maxHeight: maxHeight ? `${maxHeight}px` : "min(400px, 50vh)",
              scrollbarWidth: "none",
            }}
          >
            <SummaryView
              compact
              headerExtra={
                <button
                  type="button"
                  onClick={() => setMode("pinned")}
                  className="flex size-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/50 transition-colors"
                  title={t("summary.pin")}
                >
                  <PinIcon className="size-3" />
                </button>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pinned Panel ────────────────────────────────────────────────────────────

const MIN_CHAT_WIDTH_FOR_PIN = 480;

export function SummaryPinnedPanel() {
  const { t } = useSummaryTranslation();
  const mode = useSummaryPanelMode();
  const setMode = summaryPanelStore.getState().setMode;
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-unpin when container is too narrow
  useEffect(() => {
    if (mode !== "pinned" || !panelRef.current) return;

    const container = panelRef.current.closest("[data-slot='chat-session']") as HTMLElement | null;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width < MIN_CHAT_WIDTH_FOR_PIN) {
        setMode("closed");
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, setMode]);

  // Only mount SummaryView (and its data subscriptions) when actually pinned.
  // Otherwise a hidden w-0 wrapper would keep a second SummaryView alive
  // alongside the one in the floating popover.
  if (mode !== "pinned") return null;

  return (
    <div
      ref={panelRef}
      className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-l border-border/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground">{t("summary.title")}</span>
        <button
          type="button"
          onClick={() => setMode("closed")}
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/50 transition-colors"
          title={t("summary.unpin")}
        >
          <PinOffIcon className="size-3.5" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <SummaryView />
      </div>
    </div>
  );
}
