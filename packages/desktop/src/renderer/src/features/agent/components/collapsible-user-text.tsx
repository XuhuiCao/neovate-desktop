import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";

// Markers for neodebug react-grab annotation blocks the model may echo back.
// The open-source build has no neodebug bridge, so these never appear in
// practice — stripping is a no-op safety net matching the internal behavior.
const REACT_GRAB_COMMENTS_START = "<neodebug-react-grab-comments>";
const REACT_GRAB_COMMENTS_END = "</neodebug-react-grab-comments>";
const USER_PAGE_ANNOTATIONS_START = "<user-page-annotations>";
const USER_PAGE_ANNOTATIONS_END = "</user-page-annotations>";

function stripBetween(text: string, startMarker: string, endMarker: string): string | null {
  const startIndex = text.indexOf(startMarker);
  if (startIndex < 0) return null;
  const endIndex = text.indexOf(endMarker, startIndex);
  if (endIndex < 0) return text.slice(0, startIndex).trimEnd();
  return `${text.slice(0, startIndex)}${text.slice(endIndex + endMarker.length)}`.trimEnd();
}

function stripReactGrabCommentsFromText(text: string): string {
  return (
    stripBetween(text, USER_PAGE_ANNOTATIONS_START, USER_PAGE_ANNOTATIONS_END) ??
    stripBetween(text, REACT_GRAB_COMMENTS_START, REACT_GRAB_COMMENTS_END) ??
    text
  );
}

// NOTE: internal build splits `@<path>/.neo/.context/attachments/*.png` refs
// into AttachmentChip tags here. The open-source build sends images inline as
// base64 (no attachment refs), so renderUserText returns the text unchanged.
// When the chat.attachments disk-save flow is migrated, reintroduce AttachmentChip.
function renderUserText(text: string): ReactNode {
  return text;
}

export function CollapsibleUserText({ text }: { text: string }) {
  const { t } = useTranslation();
  const visibleText = stripReactGrabCommentsFromText(text);
  const ref = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight);
  }, [visibleText]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div>
      <p
        ref={ref}
        style={
          !expanded && clamped
            ? { maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" }
            : undefined
        }
        className={cn("m-0 whitespace-pre-wrap break-words", !expanded && "line-clamp-[9]")}
      >
        {renderUserText(visibleText)}
      </p>
      {clamped && (
        <span
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => e.key === "Enter" && toggle()}
          className="inline-block mt-0.5 text-xs text-primary/70 hover:text-primary transition-colors cursor-pointer select-none"
        >
          {expanded ? t("chat.userMessage.showLess") : t("chat.userMessage.showMore")}
        </span>
      )}
    </div>
  );
}
