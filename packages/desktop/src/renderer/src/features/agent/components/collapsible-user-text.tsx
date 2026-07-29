import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import { AttachmentChip } from "./attachment-chip";

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

// Matches an attachment reference the composer serialized into the prompt:
// `@<absolutePath>` where the path runs through .neo/.context/attachments/ and
// ends at an image extension. Filenames may contain spaces and `@`, so the
// image extension is the only reliable right boundary (renderer-only heuristic).
const ATTACHMENT_REF =
  /@(\/[^\n]*?\/\.neo\/\.context\/attachments\/[^\n]*?\.(?:png|jpe?g|gif|webp|svg|bmp))/gi;

// Split the message text into plain-text runs and inline attachment chips. Text
// with no attachment reference returns a single string (unchanged behavior).
// The open-source composer still sends images inline as base64, so in practice
// no refs reach here yet — once composer serialization switches to disk-save +
// `@<absolutePath>` refs, chips render automatically. No base64 path is touched.
function renderUserText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  ATTACHMENT_REF.lastIndex = 0;
  for (let m = ATTACHMENT_REF.exec(text); m !== null; m = ATTACHMENT_REF.exec(text)) {
    const absolutePath = m[1];
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const name = absolutePath.slice(absolutePath.lastIndexOf("/") + 1);
    parts.push(<AttachmentChip key={`att-${key++}`} absolutePath={absolutePath} name={name} />);
    lastIndex = m.index + m[0].length;
  }
  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
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
