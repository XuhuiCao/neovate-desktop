import { describe, expect, it } from "vitest";

import type { ModelTag, ProviderModelEntry } from "../types";

import { getVisibleModelTags, isDefaultModel } from "../model-tag-helper";

const entry = (tags?: ModelTag[]): ProviderModelEntry => ({ displayName: "m", tags });

describe("isDefaultModel", () => {
  it("is true only for a DEFAULT tag carrying value 'true'", () => {
    expect(isDefaultModel(entry([{ name: "DEFAULT", value: "true" }]))).toBe(true);
  });

  it("is false for a DEFAULT tag without value 'true'", () => {
    expect(isDefaultModel(entry([{ name: "DEFAULT" }]))).toBe(false);
    expect(isDefaultModel(entry([{ name: "DEFAULT", value: "false" }]))).toBe(false);
  });

  it("is false when there are no tags", () => {
    expect(isDefaultModel(entry())).toBe(false);
    expect(isDefaultModel(entry([]))).toBe(false);
  });
});

describe("getVisibleModelTags", () => {
  it("returns nothing when there are no tags", () => {
    expect(getVisibleModelTags(entry())).toEqual([]);
    expect(getVisibleModelTags(entry([]))).toEqual([]);
  });

  it("only returns known enum tags that carry a non-empty cname", () => {
    const tags: ModelTag[] = [
      { name: "MULTI_MODEL", cname: "多模态" },
      { name: "CHAT" }, // known enum but no cname → dropped (e.g. server CHAT)
      { name: "EXTERNAL", cname: "  " }, // whitespace-only cname → dropped
      { name: "UNKNOWN", cname: "junk" } as unknown as ModelTag, // not in enum → dropped
    ];
    expect(getVisibleModelTags(entry(tags))).toEqual([{ name: "MULTI_MODEL", cname: "多模态" }]);
  });

  it("dedupes by name (first wins) and trims cname", () => {
    const tags: ModelTag[] = [
      { name: "BETA", cname: " 试运行 " },
      { name: "BETA", cname: "dup" },
    ];
    expect(getVisibleModelTags(entry(tags))).toEqual([{ name: "BETA", cname: "试运行" }]);
  });

  it("hides a CONTEXT tag lacking either a cname or a length value", () => {
    expect(getVisibleModelTags(entry([{ name: "CONTEXT", value: "1m" }]))).toEqual([]); // no cname
    expect(getVisibleModelTags(entry([{ name: "CONTEXT", cname: "上下文" }]))).toEqual([]); // no value
    expect(
      getVisibleModelTags(entry([{ name: "CONTEXT", cname: "上下文", value: "true" }])),
    ).toEqual([]);
  });

  it("shows a CONTEXT tag when it has both cname and a length value", () => {
    expect(getVisibleModelTags(entry([{ name: "CONTEXT", cname: "上下文", value: "1m" }]))).toEqual(
      [{ name: "CONTEXT", cname: "上下文", value: "1m" }],
    );
  });

  it("orders badges DEFAULT, BETA, CHAT, MULTI_MODEL, CONTEXT regardless of input order", () => {
    const tags: ModelTag[] = [
      { name: "CONTEXT", cname: "上下文", value: "256k" },
      { name: "MULTI_MODEL", cname: "多模态" },
      { name: "CHAT", cname: "对话" },
      { name: "BETA", cname: "试运行" },
      { name: "DEFAULT", cname: "默认", value: "true" },
    ];
    expect(getVisibleModelTags(entry(tags)).map((t) => t.name)).toEqual([
      "DEFAULT",
      "BETA",
      "CHAT",
      "MULTI_MODEL",
      "CONTEXT",
    ]);
  });
});
