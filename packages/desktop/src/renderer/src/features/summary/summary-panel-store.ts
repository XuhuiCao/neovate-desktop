import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type SummaryMode = "closed" | "floating" | "pinned";

type SummaryPanelStore = {
  mode: SummaryMode;
  setMode: (mode: SummaryMode) => void;
};

export const summaryPanelStore = createStore<SummaryPanelStore>()(
  persist(
    (set) => ({
      mode: "closed",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "neovate-summary-panel",
      // "floating" is an ephemeral popover state — only persist "pinned" / "closed"
      // so a refresh never restores a hovering popover the user has long forgotten.
      partialize: ({ mode }) => ({ mode: mode === "floating" ? "closed" : mode }),
    },
  ),
);

export const useSummaryPanelMode = () => useStore(summaryPanelStore, (s) => s.mode);
