import { describe, expect, it } from "vitest";

import { CFUSE_PROXY_TEMPLATE } from "../cfuse-proxy";

// Guards the hand-maintained tag→model mapping: a wrong/missing tag is silently a
// no-op in the UI.
describe("CFUSE_PROXY_TEMPLATE model tags", () => {
  const models = CFUSE_PROXY_TEMPLATE.models;

  it("tags antchat/Kimi-K2.5 as multimodal only", () => {
    expect(models["antchat/Kimi-K2.5"]?.tags).toEqual([{ name: "MULTI_MODEL" }]);
  });

  it("leaves the remaining antchat models untagged", () => {
    for (const id of [
      "antchat/Ring-2.6-1T",
      "antchat/Ling-2.6-1T",
      "antchat/GLM-5.1",
      "antchat/GLM-5.2",
      "antchat/MiniMax-M2.5",
      "antchat/DeepSeek-V4-Flash",
      "antchat/DeepSeek-V4-Pro",
    ]) {
      expect(models[id]?.tags, id).toBeUndefined();
    }
  });
});

// Guards the Claude Opus removal: only antchat/ models remain, and every modelMap
// slot routes to the antchat/GLM-5.1 default.
describe("CFUSE_PROXY_TEMPLATE model routing", () => {
  it("exposes only antchat/ models (no glink/claude-opus ids)", () => {
    for (const id of Object.keys(CFUSE_PROXY_TEMPLATE.models)) {
      expect(id.startsWith("antchat/"), id).toBe(true);
    }
  });

  it("routes all four modelMap slots to antchat/GLM-5.1", () => {
    expect(CFUSE_PROXY_TEMPLATE.modelMap).toEqual({
      model: "antchat/GLM-5.1",
      opus: "antchat/GLM-5.1",
      sonnet: "antchat/GLM-5.1",
      haiku: "antchat/GLM-5.1",
    });
  });
});
