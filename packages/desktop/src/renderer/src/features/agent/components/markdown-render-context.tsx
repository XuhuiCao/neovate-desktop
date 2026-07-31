import { createContext, useContext, type ReactNode } from "react";

export interface MarkdownRenderContextValue {
  /** Non-empty absolute path, or undefined. Never an empty string. */
  cwd: string | undefined;
}

const MarkdownRenderContext = createContext<MarkdownRenderContextValue | null>(null);

/**
 * Single coercion point for cwd. Callers pass whatever they have (string | undefined |
 * empty | non-absolute); the Provider normalizes to either a non-empty absolute path or
 * undefined. Downstream consumers (parseFilePath, resolvePathForOpen,
 * useMarkdownComponents) never see "" or non-absolute strings.
 *
 * Per spec FR6, dev-warns on observable caller bugs:
 *   - rawCwd === "" — caller flattened a missing value into an empty string
 *     (the `?? ""` anti-pattern). The bad input is observable, not silent.
 *   - rawCwd is a non-empty, non-absolute string — caller passed a path that
 *     can't anchor workspace-relative detection.
 *
 * rawCwd === undefined is silent — that's an honest "I don't have a cwd yet" signal.
 */
export function MarkdownRenderProvider({
  cwd: rawCwd,
  children,
}: {
  cwd: string | undefined;
  children: ReactNode;
}) {
  const cwd = rawCwd != null && rawCwd.length > 0 && rawCwd.startsWith("/") ? rawCwd : undefined;

  if (import.meta.env.DEV && rawCwd !== undefined && cwd === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      "[MarkdownRenderProvider] received invalid cwd %o (expected non-empty absolute path); " +
        "falling back to undefined. Workspace-relative path detection will be disabled in this subtree. " +
        'Hint: do NOT use `sessionCwd ?? activeDraftProjectPath ?? projectCwd ?? ""` — pass `string | undefined`.',
      rawCwd,
    );
  }

  return (
    <MarkdownRenderContext.Provider value={{ cwd }}>{children}</MarkdownRenderContext.Provider>
  );
}

/** Returns null when not wrapped by a provider — caller decides whether that's a defect or an acceptable degradation. */
export function useMarkdownRenderContext(): MarkdownRenderContextValue | null {
  return useContext(MarkdownRenderContext);
}
