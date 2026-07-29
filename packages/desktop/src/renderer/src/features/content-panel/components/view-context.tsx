import type React from "react";

import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";

import type { ContentPanelStoreState } from "../types";

import { useRendererApp } from "../../../core";
import { useProjectStore } from "../../project/store";

// Preserve context identity across HMR to prevent provider/consumer mismatch.
// Without this, HMR re-evaluates this module, createContext() returns a new object,
// and mounted providers/consumers diverge — causing useContext() to return null.
interface ViewContextValue {
  viewId: string;
  projectPath: string;
}

const hotData = import.meta.hot?.data;
const ViewContext: React.Context<ViewContextValue | null> =
  hotData?.ViewContext ?? createContext<ViewContextValue | null>(null);

if (hotData) {
  hotData.ViewContext = ViewContext;
}

export function ContentPanelViewContextProvider({
  viewId,
  projectPath,
  children,
}: {
  viewId: string;
  projectPath: string;
  children: ReactNode;
}) {
  return <ViewContext.Provider value={{ viewId, projectPath }}>{children}</ViewContext.Provider>;
}

export interface ContentPanelViewContextValue {
  viewId: string;
  projectPath: string;
  viewState: Record<string, unknown>;
  /** Whether this view is the currently active tab in its project. False when the project is not active. */
  isActive: boolean;
}

const EMPTY_STATE: Record<string, unknown> = {};

export function useContentPanelViewContext(): ContentPanelViewContextValue {
  const context = useContext(ViewContext);
  if (!context)
    throw new Error(
      "useContentPanelViewContext must be used within ContentPanelViewContextProvider",
    );
  const { viewId, projectPath } = context;

  const app = useRendererApp();
  const contentPanel = app.workbench.contentPanel;

  const viewState = useStore(contentPanel.store, (s: ContentPanelStoreState) => {
    for (const [, ps] of Object.entries(s.projects)) {
      const tab = ps.tabs.find((t) => t.id === viewId);
      if (tab) return tab.state;
    }
    return EMPTY_STATE;
  });

  const activeProjectPath = useProjectStore((s) => s.activeProject?.path ?? null);

  const isActive = useStore(contentPanel.store, (s: ContentPanelStoreState) => {
    if (activeProjectPath !== projectPath) {
      return false;
    }
    for (const [path, ps] of Object.entries(s.projects)) {
      if (path !== projectPath) {
        continue;
      }
      const tab = ps.tabs.find((t) => t.id === viewId);
      if (tab) return ps.activeTabId === viewId;
    }
    return false;
  });

  return { viewId, projectPath, viewState, isActive };
}
