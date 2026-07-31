import { describe, expect, it } from "vitest";

import type { Provider } from "../types";

import { providerDefaultModel } from "../model";

const makeProvider = (overrides: Partial<Provider>): Provider => ({
  id: "p1",
  name: "P1",
  enabled: true,
  baseURL: "https://example.com",
  apiKey: "key",
  models: {},
  modelMap: {},
  envOverrides: {},
  ...overrides,
});

describe("providerDefaultModel", () => {
  it("returns modelMap.model when set", () => {
    const provider = makeProvider({
      models: { "model-a": {}, "model-b": {} },
      modelMap: { model: "model-b" },
    });
    expect(providerDefaultModel(provider)).toBe("model-b");
  });

  it("falls back to the first catalog key when modelMap.model is unset", () => {
    const provider = makeProvider({
      models: { "model-a": {}, "model-b": {} },
      modelMap: {},
    });
    expect(providerDefaultModel(provider)).toBe("model-a");
  });

  it("uses nullish-coalescing, not truthiness (empty modelMap.model falls through)", () => {
    const provider = makeProvider({
      models: { "model-a": {} },
      // An empty string is a real (if odd) value; `??` keeps it, unlike `||`.
      modelMap: { model: "" },
    });
    expect(providerDefaultModel(provider)).toBe("");
  });
});
