import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

export interface ModuleIntroBannerProps {
  /**
   * Module title
   */
  title: string;
  /**
   * Module description
   */
  description: string;
  /**
   * Icon to display in the placeholder area
   */
  icon: LucideIcon;
  /**
   * Optional action element on the right side (e.g., toggle buttons)
   */
  action?: ReactNode;
  /**
   * Optional additional className
   */
  className?: string;
}

/**
 * A consistent banner component for module introduction in project info tabs.
 * Used by WorkflowsTab and InsightsTab to maintain visual consistency.
 */
export function ModuleIntroBanner({
  title,
  description,
  icon: Icon,
  action,
  className,
}: ModuleIntroBannerProps) {
  return (
    <div
      className={cn(
        "relative w-full h-28 shrink-0 rounded-xl bg-gradient-to-br from-primary/5 via-muted/50 to-muted/30 border border-border/40 overflow-hidden",
        className,
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      {/* Content */}
      <div className="relative h-full flex items-center px-5 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground mb-0.5">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Right side: action or icon placeholder */}
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center shrink-0">
            <Icon className="size-6 text-muted-foreground/20" />
          </div>
        )}
      </div>
    </div>
  );
}
