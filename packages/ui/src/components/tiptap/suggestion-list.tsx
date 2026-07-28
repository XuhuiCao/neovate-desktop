import type * as React from "react";

import { cn } from "#lib/utils";

import type { SuggestionItem } from "./suggestion-menu-types";

export interface SuggestionListProps {
  items: SuggestionItem[];
  selectedIndex?: number;
  onSelect: (item: SuggestionItem) => void;
  className?: string;
  /** Shown when there are no items. Pass a translated string; defaults to English. */
  emptyLabel?: React.ReactNode;
}

function SuggestionBadge({ badge }: { badge: SuggestionItem["badge"] }) {
  if (!badge) {
    return null;
  }
  if (typeof badge === "string") {
    return <span className="shrink-0 text-muted-foreground">{badge}</span>;
  }
  const Badge = badge;
  return <Badge className="size-4 shrink-0 text-muted-foreground" />;
}

/**
 * Full-width suggestion list — fills the width of the input it anchors to
 * (not a caret-anchored Notion popup). Render it inside <SuggestionMenu>'s
 * render prop, driven by { items, selectedIndex, onSelect }.
 *
 * `--suggestion-menu-max-height` is set by the floating layer's size middleware;
 * it falls back to 320px when unset.
 */
export function SuggestionList({
  items,
  selectedIndex,
  onSelect,
  className,
  emptyLabel = "No results",
}: SuggestionListProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "w-full rounded-xl border bg-popover px-3 py-2 text-muted-foreground text-sm shadow-lg",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex max-h-[var(--suggestion-menu-max-height,320px)] w-full flex-col overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg",
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={`${item.title}-${index}`}
          type="button"
          data-selected={index === selectedIndex || undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-popover-foreground text-sm",
            "hover:bg-accent data-[selected]:bg-accent",
          )}
          // Prevent mousedown from blurring the editor, so the caret/query survive.
          onPointerDown={(event) => {
            event.preventDefault();
            onSelect(item);
          }}
        >
          <SuggestionBadge badge={item.badge} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.title}</span>
            {item.subtext ? (
              <span className="truncate text-muted-foreground text-xs">{item.subtext}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
