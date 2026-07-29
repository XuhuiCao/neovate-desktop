import type { RefObject } from "react";

import debug from "debug";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

const log = debug("neovate:anchor-positions");

export type AnchorData = {
  messageId: string;
  topRatio: number;
  heightRatio: number;
  summary: string;
  textLength: number;
};

export type ViewportData = {
  top: number;
  height: number;
};

const IDLE_VIEWPORT: ViewportData = { top: 0, height: 1 };
const MAX_SUMMARY_LENGTH = 50;
const POSITION_EPSILON = 0.0001;

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < POSITION_EPSILON;
}

function anchorsEqual(a: AnchorData[], b: AnchorData[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((anchor, index) => {
    const next = b[index];
    return (
      anchor.messageId === next.messageId &&
      anchor.summary === next.summary &&
      anchor.textLength === next.textLength &&
      almostEqual(anchor.topRatio, next.topRatio) &&
      almostEqual(anchor.heightRatio, next.heightRatio)
    );
  });
}

function viewportEqual(a: ViewportData, b: ViewportData): boolean {
  return almostEqual(a.top, b.top) && almostEqual(a.height, b.height);
}

function extractUserText(message: ClaudeCodeUIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && "text" in part) {
      texts.push(part.text);
    }
  }
  const full = texts.join(" ").trim();
  if (full.length <= MAX_SUMMARY_LENGTH) return full;
  return full.slice(0, MAX_SUMMARY_LENGTH) + "…";
}

export function useAnchorPositions(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  messages: ClaudeCodeUIMessage[],
  isAtBottom: boolean,
): {
  anchors: AnchorData[];
  viewport: ViewportData;
  scrollToMessage: (messageId: string) => void;
} {
  const [anchors, setAnchors] = useState<AnchorData[]>([]);
  const [viewport, setViewport] = useState<ViewportData>(IDLE_VIEWPORT);

  const isAtBottomRef = useRef(isAtBottom);
  isAtBottomRef.current = isAtBottom;

  const userMessages = useMemo(() => messages.filter((m) => m.role === "user"), [messages]);

  const userMessageMap = useMemo(() => {
    const map = new Map<string, { summary: string; textLength: number }>();
    for (const m of userMessages) {
      const full = m.parts
        .filter(
          (p): p is { type: "text"; text: string } & Record<string, unknown> =>
            p.type === "text" && "text" in p,
        )
        .map((p) => p.text)
        .join(" ")
        .trim();
      map.set(m.id, {
        summary: extractUserText(m),
        textLength: full.length,
      });
    }
    return map;
  }, [userMessages]);

  const messageIdSet = userMessages.map((m) => m.id).join(",");

  // --- ResizeObserver: 计算锚点位置 ---
  useEffect(() => {
    const contentEl = contentRef.current;
    const scrollEl = scrollRef.current;
    if (!contentEl || !scrollEl) return;

    let rafId = 0;

    const computeAnchors = () => {
      const scrollHeight = scrollEl.scrollHeight;
      const clientHeight = scrollEl.clientHeight;
      if (scrollHeight === 0 || clientHeight === 0) return;

      const elements = contentEl.querySelectorAll<HTMLElement>("[data-message-id]");
      const result: AnchorData[] = [];

      for (const el of elements) {
        const messageId = el.getAttribute("data-message-id");
        const role = el.getAttribute("data-message-role") as "user" | "assistant";
        if (!messageId || role !== "user") continue;

        const meta = userMessageMap.get(messageId);
        if (!meta) continue;

        const elRect = el.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();

        const relativeTop = elRect.top - scrollRect.top + scrollEl.scrollTop;
        const topRatio = relativeTop / scrollHeight;
        const heightRatio = elRect.height / scrollHeight;

        if (topRatio >= 0 && topRatio <= 1.05) {
          result.push({
            messageId,
            topRatio,
            heightRatio,
            summary: meta.summary,
            textLength: meta.textLength,
          });
        }
      }

      setAnchors((current) => (anchorsEqual(current, result) ? current : result));
    };

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeAnchors);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(contentEl);
    observer.observe(scrollEl);

    computeAnchors();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [contentRef, scrollRef, messageIdSet, userMessageMap]);

  // --- Scroll listener: 更新视口指示器 ---
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let rafId = 0;

    const computeViewport = () => {
      const scrollHeight = scrollEl.scrollHeight;
      const clientHeight = scrollEl.clientHeight;
      if (scrollHeight === 0 || clientHeight === 0) return;

      if (isAtBottomRef.current) {
        const heightRatio = clientHeight / scrollHeight;
        const nextViewport = { top: 1 - heightRatio, height: heightRatio };
        setViewport((current) => (viewportEqual(current, nextViewport) ? current : nextViewport));
        return;
      }

      const topRatio = scrollEl.scrollTop / scrollHeight;
      const heightRatio = clientHeight / scrollHeight;
      const nextViewport = { top: topRatio, height: heightRatio };
      setViewport((current) => (viewportEqual(current, nextViewport) ? current : nextViewport));
    };

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeViewport);
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    computeViewport();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      scrollEl.removeEventListener("scroll", handleScroll);
    };
  }, [scrollRef, isAtBottom]);

  // --- 滚动到指定消息 ---
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const scrollEl = scrollRef.current;
      const contentEl = contentRef.current;
      if (!scrollEl || !contentEl) return;

      const target = contentEl.querySelector(`[data-message-id="${messageId}"]`);
      if (!target) {
        log("scrollToMessage: target not found id=%s", messageId.slice(0, 8));
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const offset = targetRect.top - scrollRect.top + scrollEl.scrollTop;

      scrollEl.scrollTo({
        top: Math.max(0, offset - 16),
        behavior: "smooth",
      });
      log("scrollToMessage: id=%s offset=%d", messageId.slice(0, 8), offset);
    },
    [scrollRef, contentRef],
  );

  return { anchors, viewport, scrollToMessage };
}
