import { useProjectStore } from "../project/store";
import { isPathWithin } from "../project/utils";
import { useAgentStore } from "./store";

const FLASH_CLASS = "neo-locate-flash";
const MAX_POLL_MS = 2000;

function scrollAndFlash(sid: string): void {
  const el = document.querySelector(`[data-session-id="${CSS.escape(sid)}"]`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "nearest" });

  el.classList.remove(FLASH_CLASS);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(FLASH_CLASS);
  el.addEventListener("animationend", () => el.classList.remove(FLASH_CLASS), { once: true });
}

function waitForElementThenFlash(sid: string): void {
  const start = performance.now();

  function poll() {
    if (document.querySelector(`[data-session-id="${CSS.escape(sid)}"]`)) {
      requestAnimationFrame(() => scrollAndFlash(sid));
      return;
    }
    if (performance.now() - start >= MAX_POLL_MS) return;
    // Keep dispatching every frame until the element appears. The reveal-session
    // listeners live inside collapsed components (base-ui AccordionPanel is unmounted
    // while closed), so a fixed dispatch count can fire entirely before the listener
    // re-registers post-expansion. All handlers are idempotent, so re-dispatch is safe.
    window.dispatchEvent(new CustomEvent("reveal-session", { detail: { sessionId: sid } }));
    requestAnimationFrame(poll);
  }

  requestAnimationFrame(poll);
}

/**
 * Reveal and scroll to the currently active session in the sidebar.
 *
 * 1. Expand the project accordion if collapsed.
 * 2. Dispatch "reveal-session" so list components auto-expand (show-more, pinned section).
 * 3. Poll for the DOM element, then scrollIntoView + flash highlight.
 */
export function locateActiveSession(): void {
  const { activeSessionId: sid, sessions, agentSessions } = useAgentStore.getState();
  if (!sid) return;

  // The session list must be mounted in the DOM for locate to work. It is unmounted
  // when the primary sidebar is collapsed and the hover panel is inactive (SessionList
  // returns null). The locate buttons live inside the list, so this is normally true
  // when reachable — but check explicitly rather than rely on that implicit coupling,
  // and skip the 2s poll instead of timing out silently.
  if (!document.querySelector('[data-testid="session-list"]')) return;

  const { projects, closedProjectAccordions, setClosedProjectAccordions } =
    useProjectStore.getState();

  const memSession = sessions.get(sid);
  const persistedSession = agentSessions.find((s) => s.sessionId === sid);
  const cwd = memSession?.cwd ?? persistedSession?.cwd;

  if (cwd) {
    const targetProject = projects.find((p) => isPathWithin(cwd, p.path));
    if (targetProject && closedProjectAccordions.includes(targetProject.id)) {
      setClosedProjectAccordions(closedProjectAccordions.filter((id) => id !== targetProject.id));
    }
  }

  requestAnimationFrame(() => {
    waitForElementThenFlash(sid);
  });
}
