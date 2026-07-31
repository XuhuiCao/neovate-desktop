import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

type GradientBorderWrapperProps = {
  children: ReactNode;
  innerClassName?: string;
};

export function GradientBorderWrapper({ children, innerClassName }: GradientBorderWrapperProps) {
  return (
    <div
      className="rounded-[12px] shadow-[0_4px_4px_rgba(0,0,0,0.04)]"
      style={{
        border: "3px solid transparent",
        background:
          "linear-gradient(var(--card), var(--card)) padding-box,linear-gradient(180deg,var(--border) 0%, color-mix(in srgb, var(--border) 50%, transparent) 100%) border-box",
      }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2 border-transparent text-foreground transition-[border-color,background] duration-200",
          innerClassName,
        )}
        style={{
          background:
            "linear-gradient(var(--card)) padding-box,linear-gradient(0deg,color-mix(in srgb, var(--primary) 30%, transparent) 0,transparent 80%,transparent)border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}
