import { afterEach, describe, expect, it } from "vitest";

import { draftAgentStore } from "../draft-store";

function resetStore() {
  draftAgentStore.setState({ drafts: {}, activeDraftProjectPath: null });
}

afterEach(resetStore);

describe("enterDraft model seed", () => {
  it("seeds model + provider into a fresh draft from the just-left session", () => {
    draftAgentStore.getState().enterDraft("/proj/x", { model: "opus", providerId: "codex" });
    const draft = draftAgentStore.getState().drafts["/proj/x"];
    expect(draft?.selectedModelId).toBe("opus");
    expect(draft?.selectedProviderId).toBe("codex");
  });

  it("pins provider to null (SDK Default) when the session had no provider", () => {
    draftAgentStore.getState().enterDraft("/proj/x", { model: "sonnet" });
    const draft = draftAgentStore.getState().drafts["/proj/x"];
    expect(draft?.selectedModelId).toBe("sonnet");
    expect(draft?.selectedProviderId).toBeNull();
  });

  it("does not overwrite a user-picked, unsent draft model", () => {
    draftAgentStore.getState().enterDraft("/proj/x");
    draftAgentStore.getState().updateDraft("/proj/x", { selectedModelId: "haiku" });
    draftAgentStore.getState().enterDraft("/proj/x", { model: "opus", providerId: "codex" });
    const draft = draftAgentStore.getState().drafts["/proj/x"];
    expect(draft?.selectedModelId).toBe("haiku");
  });

  it("leaves the draft on global fallback when there is nothing to seed", () => {
    draftAgentStore.getState().enterDraft("/proj/x");
    const draft = draftAgentStore.getState().drafts["/proj/x"];
    expect(draft?.selectedModelId).toBeNull();
    expect(draft?.selectedProviderId).toBeUndefined();
  });
});
