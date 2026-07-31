/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ContentPanelView } from "../../../core/plugin/contributions";

import {
  VIEW_AVAILABILITY_QUERY_KEY,
  useAvailableViews,
  viewAvailabilityQueryOptions,
} from "../use-available-views";

function view(over: Partial<any> & { viewType: string }): any {
  return {
    name: over.viewType,
    component: async () => ({ default: () => null }),
    ...over,
  };
}

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const types = (views: ContentPanelView[]) => views.map((v) => v.viewType);

describe("useAvailableViews", () => {
  it("shows views without isAvailable immediately", () => {
    const views = [view({ viewType: "a" }), view({ viewType: "b" })];
    const { result } = renderHook(() => useAvailableViews(views, "/p", null), {
      wrapper: createWrapper(),
    });
    expect(types(result.current)).toEqual(["a", "b"]);
  });

  it("hides views whose discoverable is false", () => {
    const views = [view({ viewType: "a" }), view({ viewType: "hidden", discoverable: false })];
    const { result } = renderHook(() => useAvailableViews(views, "/p", null), {
      wrapper: createWrapper(),
    });
    expect(types(result.current)).toEqual(["a"]);
  });

  it("evaluates the function form of discoverable", () => {
    const views = [
      view({ viewType: "on", discoverable: () => true }),
      view({ viewType: "off", discoverable: () => false }),
    ];
    const { result } = renderHook(() => useAvailableViews(views, "/p", null), {
      wrapper: createWrapper(),
    });
    expect(types(result.current)).toEqual(["on"]);
  });

  it("hides views whose projectType does not match", () => {
    const views = [view({ viewType: "only-node", supportedProjectTypes: ["node"] })];
    const { result } = renderHook(() => useAvailableViews(views, "/p", "python"), {
      wrapper: createWrapper(),
    });
    expect(types(result.current)).toEqual([]);
  });

  it("shows an async view only after it resolves true; hides on reject", async () => {
    const views = [
      view({ viewType: "ok", isAvailable: async () => true }),
      view({ viewType: "no", isAvailable: async () => false }),
      view({
        viewType: "boom",
        isAvailable: async () => {
          throw new Error("x");
        },
      }),
    ];
    const { result } = renderHook(() => useAvailableViews(views, "/p", null), {
      wrapper: createWrapper(),
    });
    // not yet resolved -> none of the async ones present
    expect(types(result.current)).toEqual([]);
    await waitFor(() => expect(types(result.current)).toEqual(["ok"]));
  });

  it("builds per-view query keys under the shared invalidation prefix", () => {
    const opts = viewAvailabilityQueryOptions(view({ viewType: "x" }), "/p");
    expect(opts.queryKey.slice(0, VIEW_AVAILABILITY_QUERY_KEY.length)).toEqual([
      ...VIEW_AVAILABILITY_QUERY_KEY,
    ]);
  });

  it("renders progressively: a fast async view appears before a slow one", async () => {
    let resolveSlow: (v: boolean) => void = () => {};
    const slow = new Promise<boolean>((r) => {
      resolveSlow = r;
    });
    const views = [
      view({ viewType: "fast", isAvailable: async () => true }),
      view({ viewType: "slow", isAvailable: () => slow }),
    ];
    const { result } = renderHook(() => useAvailableViews(views, "/p", null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(types(result.current)).toEqual(["fast"]));
    resolveSlow(true);
    await waitFor(() => expect(types(result.current)).toEqual(["fast", "slow"]));
  });
});
