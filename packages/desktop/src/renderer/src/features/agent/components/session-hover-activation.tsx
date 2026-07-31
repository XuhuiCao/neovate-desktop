import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * List-scoped "hover activation" state for session list items.
 *
 * The first time any session item's hover popover opens, we mark the list
 * activated. From then on, items skip the entry hover delay and pop instantly
 * as the cursor moves between them — the user has signaled intent, so the
 * delay meant to avoid accidental triggers on fast sweeps is no longer useful.
 *
 * The state is one-way (never resets): re-entering the list later still pops
 * instantly, which matches the "I'm browsing conversations" intent.
 */
interface SessionHoverActivationValue {
  activated: boolean;
  markActivated: () => void;
  /** sessionId of the popover currently open in the list, or null if none. */
  openSessionId: string | null;
  /** Open this session's popover, closing any other open one in the same list. */
  openSession: (sessionId: string) => void;
  /** Close whatever popover is currently open. */
  closeSession: () => void;
}

const SessionHoverActivationContext = createContext<SessionHoverActivationValue | null>(null);

export function SessionHoverActivationProvider({ children }: { children: ReactNode }) {
  const [activated, setActivated] = useState(false);
  const markActivated = useCallback(() => setActivated(true), []);

  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const openSession = useCallback((sessionId: string) => setOpenSessionId(sessionId), []);
  const closeSession = useCallback(() => setOpenSessionId(null), []);

  const value = useMemo(
    () => ({ activated, markActivated, openSessionId, openSession, closeSession }),
    [activated, markActivated, openSessionId, openSession, closeSession],
  );

  return (
    <SessionHoverActivationContext.Provider value={value}>
      {children}
    </SessionHoverActivationContext.Provider>
  );
}

export function useSessionHoverActivation(): SessionHoverActivationValue {
  const ctx = useContext(SessionHoverActivationContext);
  if (!ctx) {
    throw new Error("useSessionHoverActivation must be used within SessionHoverActivationProvider");
  }
  return ctx;
}
