import type { JSONContent } from "@tiptap/react";

import debug from "debug";
import { useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { ReactGrabCommentPayload } from "../../../../shared/claude-code/types";
import type { ImageAttachment, PermissionMode } from "../../../../shared/features/agent/types";
import type { SessionTarget } from "../worktree/types";

const log = debug("neovate:draft-agent");

export type DevMode = "free" | "standard";

export type DraftAgent = {
  id?: string;
  createdAt?: string;
  content: JSONContent | null;
  attachments: ImageAttachment[];
  target: SessionTarget | null;
  /** Temporary permission mode override (initialized from config default) */
  permissionMode: PermissionMode | null;
  /** Temporary model override (initialized from global selection) */
  selectedModelId: string | null;
  /** Temporary provider override: undefined = use global, null = force SDK Default, string = specific provider */
  selectedProviderId?: string | null;
  /** Development mode: free (default) or standard (workflow-based) */
  devMode: DevMode;
  pendingReactGrabComments?: ReactGrabCommentPayload | null;
  /** Selected dev-workflow plugin id (`<name>@<marketplace>`) when in
   *  standard mode. Stable across CLI re-fetches; null = no selection yet. */
  devWorkflowPluginId: string | null;
  /** Deeplink auto-send flag, consumed after triggering send */
  autoSend?: boolean;
};

type DraftAgentState = {
  /** Per-project drafts keyed by project path */
  drafts: Record<string, DraftAgent>;
  /** The project path whose draft is currently displayed, null when in active session or no project */
  activeDraftProjectPath: string | null;

  enterDraft: (projectPath: string, modelSeed?: DraftModelSeed) => void;
  exitDraft: () => void;
  updateDraft: (projectPath: string, patch: Partial<DraftAgent>) => void;
};

/** Model/provider carried over from the just-left session to seed a fresh draft. */
export type DraftModelSeed = { model?: string; providerId?: string };

const EMPTY_DRAFT: DraftAgent = {
  content: null,
  attachments: [],
  target: null,
  permissionMode: null,
  selectedModelId: null,
  devMode: "free",
  pendingReactGrabComments: null,
  devWorkflowPluginId: null,
};

export const draftAgentStore: StoreApi<DraftAgentState> = createStore<DraftAgentState>()(
  immer((set) => ({
    drafts: {},
    activeDraftProjectPath: null,

    enterDraft: (projectPath, modelSeed) => {
      log("enterDraft: %s", projectPath);
      set((state) => {
        state.activeDraftProjectPath = projectPath;
        if (!state.drafts[projectPath]) {
          state.drafts[projectPath] = { ...EMPTY_DRAFT, attachments: [] };
        }
        const draft = state.drafts[projectPath];
        // Seed model/provider from the just-left session so a fresh draft defaults
        // to the in-progress model. Only when there's no override yet
        // (selectedModelId == null, the post-send reset state) — a user-picked,
        // unsent draft model is preserved. Provider rides along: a bare model id
        // would otherwise pair with the global provider. undefined providerId means
        // the session used SDK Default, so pin the draft to null (not global).
        if (modelSeed?.model && draft.selectedModelId == null) {
          draft.selectedModelId = modelSeed.model;
          draft.selectedProviderId = modelSeed.providerId ?? null;
        }
      });
    },

    exitDraft: () => {
      log("exitDraft");
      set((state) => {
        state.activeDraftProjectPath = null;
      });
    },

    updateDraft: (projectPath, patch) => {
      set((state) => {
        const existing = state.drafts[projectPath] ?? { ...EMPTY_DRAFT, attachments: [] };
        state.drafts[projectPath] = { ...existing, ...patch };
      });
    },
  })),
);

export function useDraftAgentStore<T>(selector: (state: DraftAgentState) => T): T {
  return useStore(draftAgentStore, selector);
}
