import debug from "debug";

import { layoutStore } from "../../components/app-layout/store";
import { NEO_FLAG_ROUTER_CHAT } from "../../core/router-chat-flag";
import { router } from "../../router";
import { useProjectStore } from "../project/store";
import { draftAgentStore } from "./draft-store";
import { useAgentStore } from "./store";

const log = debug("neovate:navigation");

/** Navigate to draft state for a project. Clears any active session. */
export function navigateToDraft(projectPath: string) {
  log("navigateToDraft: %s", projectPath);
  // Two-mode coexistence (same as navigateToSession): when NEO_FLAG_ROUTER_CHAT is on,
  // also drive the router to the draft (new-session) surface ("/draft"). Do NOT
  // return — the store path below keeps running so the old draft logic stays
  // correct.
  if (NEO_FLAG_ROUTER_CHAT) {
    void router.navigate({ to: "/draft" });
  }
  // WORKAROUND: navigation shouldn't know about layout panels directly.
  // TODO: introduce a router architecture so layout can react to navigation changes.
  layoutStore.getState().closeFullRightPanel();
  useAgentStore.getState().setRemoteMode(false);
  // Carry the in-progress session's model into the fresh draft (see enterDraft).
  const leavingId = useAgentStore.getState().activeSessionId;
  const leaving = leavingId ? useAgentStore.getState().sessions.get(leavingId) : undefined;
  useAgentStore.getState().setActiveSession(null);
  draftAgentStore
    .getState()
    .enterDraft(
      projectPath,
      leaving?.currentModel
        ? { model: leaving.currentModel, providerId: leaving.providerId }
        : undefined,
    );
  useProjectStore.getState().setCwd(projectPath);
  // Switch active project to match the draft path (ensures UI state consistency)
  useProjectStore.getState().switchToProjectByPath(projectPath);
}

/** Navigate to an active session. Clears draft state. */
export function navigateToSession(sessionId: string) {
  // Two-mode coexistence (gates the MODE, not whether the router is mounted —
  // RouterProvider is always mounted globally). When NEO_FLAG_ROUTER_CHAT is on we
  // ALSO drive the router to the new SessionRoute — but deliberately do NOT
  // return: the store-driven path below keeps running so activeSessionId (and
  // everything that still reads it) stays correct and the old logic remains
  // fully usable. The two worlds run in lockstep; store dependencies get peeled
  // off incrementally until the router path can stand alone (cutover), when
  // activeSessionId is finally removed.
  if (NEO_FLAG_ROUTER_CHAT) {
    void router.navigate({ to: "/session/$sessionId", params: { sessionId } });
  }
  log("navigateToSession: %s", sessionId.slice(0, 8));
  // WORKAROUND: navigation shouldn't know about layout panels directly.
  // TODO: introduce a router architecture so layout can react to navigation changes.
  layoutStore.getState().closeFullRightPanel();
  draftAgentStore.getState().exitDraft();
  useAgentStore.getState().setActiveSession(sessionId);
  const session = useAgentStore.getState().sessions.get(sessionId);
  if (session?.cwd) {
    useProjectStore.getState().setCwd(session.cwd);
  }
}
