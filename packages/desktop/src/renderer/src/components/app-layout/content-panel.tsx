import type { ReactNode } from "react";

import { Card } from "@neo/ui/components/card";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { APP_LAYOUT_GRID_AREA } from "./constants";
import { usePanelState } from "./store";

const SPRING = { type: "spring" as const, stiffness: 600, damping: 49 };

export function AppLayoutContentPanel({ children }: { children?: ReactNode }) {
  const { collapsed, width, isResizing } = usePanelState("contentPanel");

  return (
    <Card
      data-slot="content-panel"
      style={{ gridArea: APP_LAYOUT_GRID_AREA.contentPanel }}
      className={cn("h-full shrink-0 overflow-hidden", collapsed && "pointer-events-none")}
      render={
        <motion.div
          initial={false}
          // Shrink the Card's 1px border together with the width — otherwise box-sizing
          // floors the collapsed panel at ~2px and a border sliver lingers at width:0.
          animate={{ width: collapsed ? 0 : width, borderWidth: collapsed ? 0 : 1 }}
          transition={isResizing ? { duration: 0 } : SPRING}
        />
      }
    >
      {children}
    </Card>
  );
}
