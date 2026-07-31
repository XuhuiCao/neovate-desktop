import type { ReactNode } from "react";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../../lib/utils";

interface SectionHeaderProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  sticky?: boolean;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  collapsed,
  onToggle,
  actions,
  sticky,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "group/section flex items-center justify-between px-2.5 py-1",
        sticky && "sticky top-0 z-10 bg-sidebar",
      )}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        onClick={onToggle}
      >
        {title}
        <span className="opacity-0 transition-opacity group-hover/section:opacity-100">
          {collapsed ? (
            <ChevronRightIcon size={12} strokeWidth={2} />
          ) : (
            <ChevronDownIcon size={12} strokeWidth={2} />
          )}
        </span>
      </button>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
});
