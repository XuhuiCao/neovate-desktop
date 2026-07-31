import type { Editor } from "@tiptap/react";

import { useEffect } from "react";

import { useLatestRef } from "../../hooks/use-latest-ref";
import { draftAgentStore } from "./draft-store";

/**
 * Two-way binding between the composer editor and the draft store: every editor
 * change is written straight to `drafts[draftPath].content`, so the store is the
 * single source of truth for an unsent draft.
 *
 * This is why a draft survives navigating away to a session and back — the
 * content is already persisted at the moment it changes (including the
 * slash-command node the dev-mode toggle inserts), rather than being copied out
 * lazily on unmount, which raced with navigation clearing the active draft path.
 *
 * `draftPath` is read through a ref so the listener always targets the current
 * draft without re-subscribing. Pass `null` for an active-session composer to
 * opt out of persistence.
 */
export function useDraftContentSync(editor: Editor | null, draftPath: string | null): void {
  const draftPathRef = useLatestRef(draftPath);
  useEffect(() => {
    if (!editor) return;
    const persist = () => {
      const path = draftPathRef.current;
      if (!path) return;
      draftAgentStore.getState().updateDraft(path, { content: editor.getJSON() });
    };
    editor.on("update", persist);
    return () => {
      editor.off("update", persist);
    };
  }, [editor, draftPathRef]);
}
