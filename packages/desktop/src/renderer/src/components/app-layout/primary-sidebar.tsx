import { Card } from "@neo/ui/components/card";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { APP_LAYOUT_GRID_AREA } from "./constants";
import { SidebarHoverProvider } from "./sidebar-hover-context";
import { usePanelState } from "./store";

const SPRING = { type: "spring" as const, stiffness: 600, damping: 49 };
const HOVER_DISMISS_DELAY = 150;
const COLLAPSE_ANIMATION_MS = 250;

export function AppLayoutPrimarySidebar({ children }: { children: ReactNode }) {
  const { collapsed, width, isResizing } = usePanelState("primarySidebar");
  const [childrenMounted, setChildrenMounted] = useState(!collapsed);

  useEffect(() => {
    if (!collapsed) {
      setChildrenMounted(true);
      return;
    }
    const timer = setTimeout(() => setChildrenMounted(false), COLLAPSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [collapsed]);

  return (
    <>
      <motion.aside
        data-slot="primary-sidebar"
        style={{ gridArea: APP_LAYOUT_GRID_AREA.primarySidebar }}
        className={cn(
          "box-border mt-2 ml-2 shrink-0 overflow-hidden rounded-l-[14px] rounded-r-[10px] pt-2",
          collapsed && "pointer-events-none",
        )}
        initial={false}
        animate={{ width: collapsed ? 0 : width }}
        transition={isResizing ? { duration: 0 } : SPRING}
      >
        {childrenMounted && (
          <div className="flex h-full flex-col" style={{ width }}>
            <div className="shrink-0 h-7" />
            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">{children}</div>
          </div>
        )}
      </motion.aside>

      {collapsed && !childrenMounted && (
        <SidebarHoverPanel width={width}>{children}</SidebarHoverPanel>
      )}
    </>
  );
}

function SidebarHoverPanel({ width, children }: { width: number; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearDismissTimer();
    setHovered(true);
  }, [clearDismissTimer]);

  const handleMouseLeave = useCallback(() => {
    clearDismissTimer();
    dismissTimer.current = setTimeout(() => {
      setHovered(false);
    }, HOVER_DISMISS_DELAY);
  }, [clearDismissTimer]);

  return (
    <>
      {/* Hover trigger zone — thin strip along the left edge, below traffic lights */}
      <div
        data-slot="sidebar-hover-trigger"
        className="fixed left-0 bottom-0 z-40 w-2"
        style={{ top: 40 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* Floating panel */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            data-slot="sidebar-hover-panel"
            className="fixed z-40 flex flex-col"
            style={{ top: 8, left: 8, bottom: 16, width }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Card className="flex h-full flex-col overflow-hidden rounded-[14px] bg-sidebar pt-2 shadow-xl">
              <SidebarHoverProvider value={true}>
                <div className="shrink-0 h-7" />
                <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
                  {children}
                </div>
              </SidebarHoverProvider>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
