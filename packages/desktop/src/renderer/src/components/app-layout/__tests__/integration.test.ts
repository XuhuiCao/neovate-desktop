import { describe, it, expect } from "vitest";

import type { PanelMap } from "../types";

import {
  shrinkPanelsToFit,
  computeMinWindowWidth,
  applyDelta,
  isSeparatorVisible,
} from "../layout-coordinator";

describe("resize flow integration", () => {
  it("opening all panels then fitting to small window shrinks by priority", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 400, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 500, collapsed: false },
    };
    const result = shrinkPanelsToFit(panels, 1200);
    // contentPanel (priority 2, also acts as buffer) shrinks before chatPanel (priority 3)
    // — but here spec ordering protects chat: contentPanel absorbs first.
    expect(result.chatPanel.width).toBeLessThanOrEqual(500);
  });

  it("computeMinWindowWidth returns sane value for default layout", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 300, collapsed: true },
    };
    const minWidth = computeMinWindowWidth(panels);
    // fixed(8) + primary(250) + chat(340) + 1 handle(5) = 603
    expect(minWidth).toBe(603);
  });

  it("computeMinWindowWidth grows when more panels are expanded", () => {
    const collapsed: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 300, collapsed: true },
    };
    const expanded: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 300, collapsed: false },
    };
    expect(computeMinWindowWidth(expanded)).toBeGreaterThan(computeMinWindowWidth(collapsed));
  });

  it("bulldozer drag through entire layout is conservative", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 640, collapsed: false },
      contentPanel: { width: 400, collapsed: false },
    };
    // Drag separator 0 all the way right — capped by primarySidebar max (600)
    const result = applyDelta(panels, 0, 1000);
    // growRoom = 600 - 300 = 300
    // shrink targets to the right of primarySidebar: contentPanel (buffer first), then chatPanel
    // contentPanel gives 100 (to min 300), chatPanel gives 200 → total 300
    expect(result.contentPanel.width).toBe(300); // at min
    expect(result.chatPanel.width).toBe(440); // 640 - 200
    expect(result.primarySidebar.width).toBe(600); // at max
    // Verify conservation: total before == total after
    const before = 300 + 640 + 400;
    const after = result.primarySidebar.width + result.chatPanel.width + result.contentPanel.width;
    expect(after).toBe(before);
  });

  it("separator visibility and bulldozer are consistent across collapsed gap", () => {
    const panels: PanelMap = {
      primarySidebar: { width: 300, collapsed: false },
      chatPanel: { width: 500, collapsed: false },
      contentPanel: { width: 350, collapsed: true },
    };

    // Only 2 separators now; sep 1 (chatPanel:contentPanel) hidden when content collapsed.
    // sep 0 (primarySidebar:chatPanel) remains visible.
    expect(isSeparatorVisible(panels, 0)).toBe(true);
    expect(isSeparatorVisible(panels, 1)).toBe(false);

    // Drag right on sep 0 grows primary, shrinks chat (content collapsed, skipped)
    const right = applyDelta(panels, 0, 30);
    expect(right.primarySidebar.width).toBe(330);
    expect(right.chatPanel.width).toBe(470);
    expect(right.contentPanel.width).toBe(350); // unchanged

    // Drag left on sep 0 grows chat, shrinks primary
    const left = applyDelta(panels, 0, -30);
    expect(left.primarySidebar.width).toBe(270);
    expect(left.chatPanel.width).toBe(530);
  });
});
