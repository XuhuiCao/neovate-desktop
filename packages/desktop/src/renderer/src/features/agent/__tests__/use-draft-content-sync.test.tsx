/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { draftAgentStore } from "../draft-store";
import { useDraftContentSync } from "../use-draft-content-sync";
import { extractText } from "../utils/extract-text";

let editor: Editor;

function resetStore() {
  draftAgentStore.setState({ drafts: {}, activeDraftProjectPath: null });
}

beforeEach(() => {
  resetStore();
  editor = new Editor({ extensions: [StarterKit] });
});

afterEach(() => {
  editor.destroy();
});

describe("useDraftContentSync", () => {
  it("persists editor content to the bound draft on every change, so it survives navigate-away", () => {
    draftAgentStore.getState().enterDraft("/proj/x");
    renderHook((draftPath: string | null) => useDraftContentSync(editor, draftPath), {
      initialProps: "/proj/x" as string | null,
    });

    act(() => {
      editor.commands.insertContent("hello world");
    });

    const saved = draftAgentStore.getState().drafts["/proj/x"]?.content;
    expect(saved).toBeTruthy();
    expect(extractText(saved!)).toContain("hello world");

    // Simulate navigateToSession(): exitDraft() clears the active draft path
    // before the composer would unmount. The content is already in the store,
    // so it is unaffected — this is the regression the bug was about.
    act(() => {
      draftAgentStore.getState().exitDraft();
    });

    expect(draftAgentStore.getState().drafts["/proj/x"]?.content).toEqual(saved);
  });

  it("does not persist when bound to an active session (draftPath is null)", () => {
    renderHook(() => useDraftContentSync(editor, null));

    act(() => {
      editor.commands.insertContent("session composer text");
    });

    expect(draftAgentStore.getState().drafts).toEqual({});
  });
});
