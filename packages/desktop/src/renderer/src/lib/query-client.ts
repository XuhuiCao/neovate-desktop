import { MutationCache, QueryClient, focusManager } from "@tanstack/react-query";

// Electron has no browser tabs — visibilitychange never fires on OS window
// switch. Use window focus/blur events instead so refetchOnWindowFocus works.
// Guarded for non-browser environments (vitest runs this file's importers in
// `node` env where `window` is undefined).
if (typeof window !== "undefined") {
  focusManager.setEventListener((handleFocus) => {
    const onFocus = () => handleFocus(true);
    const onBlur = () => handleFocus(false);
    window.addEventListener("focus", onFocus, false);
    window.addEventListener("blur", onBlur, false);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  });
}

/**
 * Global QueryClient for the renderer.
 *
 * IPC-backed queries don't depend on `navigator.onLine`, so `networkMode` is
 * forced to "always". Mutations keep a zero-retry policy (the link layer is
 * the retry boundary) — `MutationCache.onError` is left as a no-op for now;
 * feature code that wants user-visible error handling wires its own toast at
 * the call site. This is the pure-frontend baseline, no daemon coupling.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      networkMode: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
    },
  },
  mutationCache: new MutationCache({
    onError: () => {
      // Intentional no-op: presentation-level error handling stays feature-local.
    },
  }),
});
