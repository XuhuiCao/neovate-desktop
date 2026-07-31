import { describe, it, expect } from "vitest";

import type { PanelMap, LayoutContext } from "../types";

import {
  constrainWidth,
  computeMaxAvailableWidth,
  shrinkPanelsToFit,
  computeMinWindowWidth,
  computeTotalWidth,
  setPanelWidth,
  applyDelta,
  isSeparatorVisible,
  openPanel,
  collapsePanel,
} from "../layout-coordinator";
import { getDescriptor } from "../panel-descriptors";

function makePanels(
  overrides: Partial<Record<string, { width: number; collapsed: boolean }>> = {},
): PanelMap {
  return {
    primarySidebar: { width: 300, collapsed: false },
    chatPanel: { width: 500, collapsed: false },
    contentPanel: { width: 300, collapsed: true },
    ...overrides,
  };
}

function makeCtx(panels?: PanelMap, windowWidth = 1200): LayoutContext {
  return { windowWidth, panels: panels ?? makePanels() };
}

describe("constrainWidth", () => {
  it("clamps below min", () => {
    const desc = getDescriptor("primarySidebar");
    expect(constrainWidth(desc, 100, makeCtx())).toBe(250);
  });

  it("clamps above max", () => {
    const desc = getDescriptor("primarySidebar");
    expect(constrainWidth(desc, 700, makeCtx())).toBe(600);
  });

  it("passes through valid width", () => {
    const desc = getDescriptor("primarySidebar");
    expect(constrainWidth(desc, 400, makeCtx())).toBe(400);
  });
});

describe("computeMaxAvailableWidth", () => {
  it("limits panel based on available space", () => {
    const ctx = makeCtx(makePanels(), 800);
    const desc = getDescriptor("primarySidebar");
    const max = computeMaxAvailableWidth(desc, ctx);
    expect(max).toBeLessThan(800);
    expect(max).toBeGreaterThan(0);
  });
});

describe("shrinkPanelsToFit", () => {
  it("returns panels unchanged when they fit", () => {
    const panels = makePanels();
    const result = shrinkPanelsToFit(panels, 1200);
    expect(result).toEqual(panels);
  });

  it("shrinks panels when they overflow", () => {
    const panels = makePanels({
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 500, collapsed: false },
    });
    const result = shrinkPanelsToFit(panels, 900);
    expect(result.chatPanel.width).toBeLessThanOrEqual(500);
  });
});

describe("computeMinWindowWidth", () => {
  it("sums min widths of expanded panels plus fixed elements and handles", () => {
    const panels = makePanels();
    const minWidth = computeMinWindowWidth(panels);
    // fixed(8) + primary(250) + chat(340) + 1 handle between them(5) = 603
    expect(minWidth).toBe(603);
  });

  it("counts handles correctly with all panels expanded", () => {
    const panels = makePanels({
      contentPanel: { width: 300, collapsed: false },
    });
    const minWidth = computeMinWindowWidth(panels);
    // fixed(8) + primary(250) + chat(340) + content(300) + 2 handles(10) = 908
    expect(minWidth).toBe(908);
  });
});

describe("applyDelta", () => {
  it("drag right: grows left panel, shrinks right panel", () => {
    const panels = makePanels();
    const result = applyDelta(panels, 0, 50);
    expect(result.primarySidebar.width).toBe(350); // 300 + 50
    expect(result.chatPanel.width).toBe(450); // 500 - 50
  });

  it("drag left: grows right panel, shrinks left panel", () => {
    const panels = makePanels();
    const result = applyDelta(panels, 0, -50);
    expect(result.primarySidebar.width).toBe(250); // min
    expect(result.chatPanel.width).toBe(550);
  });

  it("bulldozes through multiple panels when dragging right", () => {
    const panels = makePanels({
      chatPanel: { width: 540, collapsed: false },
      contentPanel: { width: 350, collapsed: false },
    });
    // separator 0: drag right 600 — growRoom = 600-300 = 300
    // shrink targets right of primarySidebar: contentPanel (buffer first, gives 50 → min),
    // then chatPanel (gives 200 → min 340). Total shrinkable = 250 < growRoom, so primary
    // only grows by 250 → 550.
    const result = applyDelta(panels, 0, 600);
    expect(result.contentPanel.width).toBe(300); // at min (gave 50)
    expect(result.chatPanel.width).toBe(340); // at min (gave 200)
    expect(result.primarySidebar.width).toBe(550); // 300 + 250
  });

  it("bulldozes through multiple panels when dragging left", () => {
    const panels = makePanels({
      chatPanel: { width: 540, collapsed: false },
      contentPanel: { width: 350, collapsed: false },
    });
    // separator 1: drag left 500 — contentPanel max is Infinity, so no cap from grow side
    // shrink targets left of contentPanel: chatPanel (buffer reorder doesn't apply when
    // contentPanel is the grow target), then primarySidebar
    // chat gives 200 (540-340), primary gives 50 = 250 consumed
    const result = applyDelta(panels, 1, -500);
    expect(result.chatPanel.width).toBe(340); // at min
    expect(result.primarySidebar.width).toBe(250); // at min
    expect(result.contentPanel.width).toBe(350 + 250); // grew by consumed
  });

  it("skips collapsed panels", () => {
    const panels = makePanels({
      chatPanel: { width: 640, collapsed: false },
      contentPanel: { width: 350, collapsed: true },
    });
    // separator 1: drag right — grow side is contentPanel, but it's collapsed → no-op
    const result = applyDelta(panels, 1, 100);
    expect(result).toBe(panels);
  });

  it("returns same panels on zero delta", () => {
    const panels = makePanels();
    expect(applyDelta(panels, 0, 0)).toBe(panels);
  });

  it("caps shrink to grow room (conservative)", () => {
    const panels = makePanels({
      primarySidebar: { width: 580, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
    });
    // separator 0: drag right 100 — primarySidebar max 600, room = 20
    // only 20px of shrink applied to chatPanel, not 100
    const result = applyDelta(panels, 0, 100);
    expect(result.primarySidebar.width).toBe(600); // capped at max
    expect(result.chatPanel.width).toBe(480); // shrunk by only 20
  });

  it("returns unchanged when grow panel is collapsed", () => {
    const panels = makePanels({
      primarySidebar: { width: 300, collapsed: true },
    });
    // separator 0: drag right — grow side (primarySidebar) is collapsed
    const result = applyDelta(panels, 0, 50);
    expect(result).toBe(panels);
  });
});

describe("isSeparatorVisible", () => {
  it("shows handle between adjacent expanded panels", () => {
    const panels = makePanels();
    expect(isSeparatorVisible(panels, 0)).toBe(true); // primary↔chat
  });

  it("hides handle when right panel is collapsed", () => {
    const panels = makePanels();
    expect(isSeparatorVisible(panels, 1)).toBe(false); // chat↔content (content collapsed)
  });

  it("hides all handles when only one panel expanded", () => {
    const panels = makePanels({
      primarySidebar: { width: 300, collapsed: true },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 300, collapsed: true },
    });
    expect(isSeparatorVisible(panels, 0)).toBe(false);
    expect(isSeparatorVisible(panels, 1)).toBe(false);
  });
});

describe("computeMinWindowWidth with all panels expanded", () => {
  it("counts both handles when contentPanel is expanded", () => {
    const panels = makePanels({
      contentPanel: { width: 300, collapsed: false },
    });
    // primary(exp), chat(exp), content(exp) — 2 visible handles
    // fixed(8) + primary(250) + chat(340) + content(300) + 2 handles(10) = 908
    const minWidth = computeMinWindowWidth(panels);
    expect(minWidth).toBe(908);
  });
});

describe("shrinkPanelsToFit with contentPanel expanded", () => {
  it("shrinks contentPanel before chatPanel when contentPanel is expanded", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 500, collapsed: false },
    };
    // Total panel width = 1300, fixed = 8, 2 handles = 10, total = 1318
    // Fit to 1100 → need to shrink 218
    const result = shrinkPanelsToFit(panels, 1100);
    // contentPanel should shrink before chatPanel
    const contentShrink = 500 - result.contentPanel.width;
    const chatShrink = 500 - result.chatPanel.width;
    expect(contentShrink).toBeGreaterThan(0);
    // contentPanel should have given more than (or equal to) chatPanel
    expect(contentShrink).toBeGreaterThanOrEqual(chatShrink);
  });
});

describe("openPanel with contentPanel absorption", () => {
  it("absorbs width from contentPanel when opening a side panel", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: true },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 600, collapsed: false },
    };
    const result = openPanel(panels, "primarySidebar", 1400);
    // primarySidebar should be expanded
    expect(result.primarySidebar.collapsed).toBe(false);
    // contentPanel should have shrunk to absorb the sidebar width
    expect(result.contentPanel.width).toBeLessThan(600);
    // chatPanel should be mostly unaffected
    expect(result.chatPanel.width).toBe(500);
  });

  it("falls through to shrinkPanelsToFit when contentPanel is at min", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: true },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 300, collapsed: false }, // already at min
    };
    const result = openPanel(panels, "primarySidebar", 1200);
    // primarySidebar should still open
    expect(result.primarySidebar.collapsed).toBe(false);
    // contentPanel stays at min since it can't give more
    expect(result.contentPanel.width).toBe(300);
  });
});

describe("collapsePanel with contentPanel absorption", () => {
  it("gives freed width back to contentPanel when collapsing a side panel", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 400, collapsed: false },
    };
    const result = collapsePanel(panels, "primarySidebar");
    // primarySidebar should be collapsed
    expect(result.primarySidebar.collapsed).toBe(true);
    // contentPanel should have gained the freed width
    expect(result.contentPanel.width).toBe(400 + 300);
    // chatPanel should be unchanged
    expect(result.chatPanel.width).toBe(500);
  });

  it("does not absorb when contentPanel is collapsed", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 400, collapsed: true },
    };
    const result = collapsePanel(panels, "primarySidebar");
    expect(result.primarySidebar.collapsed).toBe(true);
    // contentPanel should NOT gain width (it's collapsed)
    expect(result.contentPanel.width).toBe(400);
  });
});

describe("maximize convergence", () => {
  it("converges when contentPanel is proposed at extreme width", () => {
    const panels = makePanels({
      contentPanel: { width: 300, collapsed: false },
    });

    const proposed = setPanelWidth(panels, "contentPanel", Number.MAX_SAFE_INTEGER);
    const resolved = shrinkPanelsToFit(proposed, 1400);

    expect(Number.isFinite(resolved.contentPanel.width)).toBe(true);
    expect(computeTotalWidth(resolved)).toBeLessThanOrEqual(1400);
    expect(resolved.primarySidebar.width).toBeGreaterThanOrEqual(250);
    expect(resolved.chatPanel.width).toBeGreaterThanOrEqual(340);
    expect(resolved.contentPanel.width).toBeGreaterThanOrEqual(300);
  });
});
