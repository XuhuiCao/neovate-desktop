import debug from "debug";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type {
  BuiltinSkill,
  RegistryGroup,
  SkillMeta,
  SkillUpdate,
} from "../../../../shared/features/skills/types";

import { client } from "../../orpc";

const log = debug("neovate:skills:store");

type EndpointState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

type SkillsState = {
  installed: EndpointState<SkillMeta[]>;
  recommended: EndpointState<RegistryGroup[]>;
  builtin: EndpointState<BuiltinSkill[]>;
  updates: EndpointState<SkillUpdate[]>;
  refreshing: boolean;
  ensureLoaded: () => void;
  refresh: () => Promise<void>;
};

const initialEndpoint = <T>(empty: T): EndpointState<T> => ({
  data: empty,
  loading: true,
  error: null,
  loaded: false,
});

// Module-scoped in-flight flags. Kept separate from `state.loading` because
// `loading` is seeded to `true` in the initial state so the first paint shows
// skeletons before `ensureLoaded()` runs inside useEffect. That makes `loading`
// unsafe as a dedupe signal; these flags track actual in-flight fetches.
const inflight: Record<"installed" | "recommended" | "builtin" | "updates", boolean> = {
  installed: false,
  recommended: false,
  builtin: false,
  updates: false,
};

export const useSkillsStore = create<SkillsState>()(
  immer(() => ({
    installed: initialEndpoint<SkillMeta[]>([]),
    recommended: initialEndpoint<RegistryGroup[]>([]),
    builtin: initialEndpoint<BuiltinSkill[]>([]),
    updates: initialEndpoint<SkillUpdate[]>([]),
    refreshing: false,

    ensureLoaded: () => {
      const s = useSkillsStore.getState();
      if (!s.installed.loaded && !inflight.installed) fetchInstalled();
      if (!s.recommended.loaded && !inflight.recommended) fetchRecommended(false);
      if (!s.builtin.loaded && !inflight.builtin) fetchBuiltin();
      if (!s.updates.loaded && !inflight.updates) fetchUpdates();
    },

    refresh: async () => {
      log("refresh start");
      useSkillsStore.setState((s) => {
        s.refreshing = true;
        s.installed.loading = true;
        s.installed.error = null;
        s.recommended.loading = true;
        s.recommended.error = null;
        s.builtin.loading = true;
        s.builtin.error = null;
        s.updates.loading = true;
        s.updates.error = null;
      });
      // allSettled (not all) so one rejection cannot leave `refreshing` stuck.
      await Promise.allSettled([
        fetchInstalled(),
        fetchRecommended(true),
        fetchBuiltin(),
        fetchUpdates(),
      ]);
      useSkillsStore.setState((s) => {
        s.refreshing = false;
      });
      log("refresh done");
    },
  })),
);

async function fetchInstalled(): Promise<void> {
  if (inflight.installed) return;
  inflight.installed = true;
  useSkillsStore.setState((s) => {
    s.installed.loading = true;
  });
  log("fetch installed start");
  try {
    const data = await client.skills.list({ scope: "all" });
    useSkillsStore.setState((s) => {
      s.installed.data = data;
      s.installed.error = null;
      s.installed.loaded = true;
      s.installed.loading = false;
    });
    log("fetch installed done: count=%d", data.length);
  } catch (e: any) {
    log("fetch installed error: %s", e.message);
    useSkillsStore.setState((s) => {
      // Preserve prior `data` on failure — don't wipe last-known-good list.
      s.installed.error = e.message || "Failed to load installed skills";
      s.installed.loaded = true;
      s.installed.loading = false;
    });
  } finally {
    inflight.installed = false;
  }
}

async function fetchRecommended(forceRefresh: boolean): Promise<void> {
  if (inflight.recommended) return;
  inflight.recommended = true;
  useSkillsStore.setState((s) => {
    s.recommended.loading = true;
  });
  log("fetch recommended start forceRefresh=%s", forceRefresh);
  try {
    const data = await client.skills.recommended({ forceRefresh });
    useSkillsStore.setState((s) => {
      s.recommended.data = data;
      s.recommended.error = null;
      s.recommended.loaded = true;
      s.recommended.loading = false;
    });
    log("fetch recommended done: groups=%d", data.length);
  } catch (e: any) {
    log("fetch recommended error: %s", e.message);
    useSkillsStore.setState((s) => {
      s.recommended.error = e.message || "Failed to load recommended skills";
      s.recommended.loaded = true;
      s.recommended.loading = false;
    });
  } finally {
    inflight.recommended = false;
  }
}

async function fetchBuiltin(): Promise<void> {
  if (inflight.builtin) return;
  inflight.builtin = true;
  useSkillsStore.setState((s) => {
    s.builtin.loading = true;
  });
  log("fetch builtin start");
  try {
    const data = await client.skills.builtin();
    useSkillsStore.setState((s) => {
      s.builtin.data = data;
      s.builtin.error = null;
      s.builtin.loaded = true;
      s.builtin.loading = false;
    });
    log("fetch builtin done: count=%d", data.length);
  } catch (e: any) {
    log("fetch builtin error: %s", e.message);
    useSkillsStore.setState((s) => {
      s.builtin.error = e.message || "Failed to load built-in skills";
      s.builtin.loaded = true;
      s.builtin.loading = false;
    });
  } finally {
    inflight.builtin = false;
  }
}

async function fetchUpdates(): Promise<void> {
  if (inflight.updates) return;
  inflight.updates = true;
  useSkillsStore.setState((s) => {
    s.updates.loading = true;
  });
  log("fetch updates start");
  try {
    const data = await client.skills.checkUpdates({ scope: "all" });
    useSkillsStore.setState((s) => {
      s.updates.data = data;
      s.updates.error = null;
      s.updates.loaded = true;
      s.updates.loading = false;
    });
    log("fetch updates done: count=%d", data.length);
  } catch (e: any) {
    log("fetch updates error: %s", e.message);
    useSkillsStore.setState((s) => {
      s.updates.error = e.message || "Failed to check for updates";
      s.updates.loaded = true;
      s.updates.loading = false;
    });
  } finally {
    inflight.updates = false;
  }
}
