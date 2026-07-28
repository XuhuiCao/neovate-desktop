/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
});

import SummaryView from "../summary-view";

const {
  open,
  openView,
  useSummaryData,
  useAgentStore,
  useProjectStore,
  getChangesStore,
  projectStoreGetState,
} = vi.hoisted(() => {
  const projectStoreGetState = vi.fn<() => { activeProject: { path: string | null } | null }>(
    () => ({ activeProject: null }),
  );
  const useProjectStore = Object.assign(vi.fn(), { getState: projectStoreGetState });
  return {
    open: vi.fn(),
    openView: vi.fn(),
    useSummaryData: vi.fn(),
    useAgentStore: vi.fn(),
    useProjectStore,
    getChangesStore: vi.fn(),
    projectStoreGetState,
  };
});

vi.mock("../hooks/use-summary-data", () => ({
  useSummaryData,
}));

vi.mock("../../../core/app", () => ({
  useRendererApp: () => ({
    opener: { open },
    workbench: { contentPanel: { openView } },
  }),
}));

vi.mock("../../agent/store", () => ({
  useAgentStore,
}));

vi.mock("../../project/store", () => ({
  useProjectStore,
}));

vi.mock("../../changes/hooks", () => ({
  getChangesStore,
}));

vi.mock("../i18n", () => ({
  useSummaryTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const labels: Record<string, string> = {
        "summary.title": "Summary",
        "summary.empty": "No summary yet",
        "summary.progress": "Progress",
        "summary.progress.empty.title": "No progress yet",
        "summary.progress.empty.description": "Task progress will appear here",
        "summary.liveFileChanges": "Last turn changes",
        "summary.liveFileChanges.empty.title": "No changes yet",
        "summary.liveFileChanges.empty.description": "Files modified this turn will appear here",
        "summary.branchDetails": "Branch details",
        "summary.branchDetails.empty.title": "No branch info yet",
        "summary.branchDetails.empty.description": "Current branch status will appear here",
        "summary.artifacts": "Artifacts",
        "summary.artifacts.empty.title": "No artifacts yet",
        "summary.artifacts.empty.description": "Generated files will appear here",
        "summary.noChanges": "No changes",
        "summary.branchLabel": "Branch",
        "summary.changesLabel": "Changes",
        "summary.fileChanges": `${values?.count ?? 0} changed files`,
        "summary.fileCount": `${values?.count ?? 0} files`,
      };
      return labels[key] ?? key;
    },
  }),
}));

function emptyLocalChanges() {
  return {
    statusSummary: { data: null },
    branchName: null,
  };
}

describe("SummaryView", () => {
  beforeEach(() => {
    open.mockReset();
    openView.mockReset();
    useAgentStore.mockImplementation((selector) => selector({ activeSessionId: null }));
    useProjectStore.mockImplementation((selector) => selector({ activeProject: null }));
    projectStoreGetState.mockReturnValue({ activeProject: null });
    const changesState = {
      setCategory: vi.fn(),
      expandFile: vi.fn(),
      setForceVisible: vi.fn(),
      selectFile: vi.fn(),
    };
    getChangesStore.mockReturnValue({ getState: () => changesState });
    useSummaryData.mockReturnValue({
      progress: null,
      artifacts: [],
      liveFileChanges: [],
      localChanges: emptyLocalChanges(),
    });
  });

  it("always shows all sections with empty state placeholders when there is no data", () => {
    render(<SummaryView />);

    // All section headers are always visible
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("Last turn changes")).toBeTruthy();
    expect(screen.getByText("Branch details")).toBeTruthy();
    expect(screen.getByText("Artifacts")).toBeTruthy();
    // Empty state titles are shown
    expect(screen.getByText("No progress yet")).toBeTruthy();
    expect(screen.getByText("No changes yet")).toBeTruthy();
    expect(screen.getByText("No branch info yet")).toBeTruthy();
    expect(screen.getByText("No artifacts yet")).toBeTruthy();
    // Empty state descriptions are shown
    expect(screen.getByText("Task progress will appear here")).toBeTruthy();
    expect(screen.getByText("Files modified this turn will appear here")).toBeTruthy();
    expect(screen.getByText("Current branch status will appear here")).toBeTruthy();
    expect(screen.getByText("Generated files will appear here")).toBeTruthy();
  });

  it("renders progress, change count, artifact filenames, and opens panels by path", () => {
    useAgentStore.mockImplementation((selector) => selector({ activeSessionId: "s1" }));
    useProjectStore.mockImplementation((selector) =>
      selector({ activeProject: { path: "/repo" } }),
    );
    useSummaryData.mockReturnValue({
      progress: {
        total: 2,
        completed: 1,
        inProgress: 1,
        pending: 0,
        todos: [
          { content: "Done", label: "Done", status: "completed" },
          { content: "Write UI", label: "Writing UI", status: "in_progress" },
        ],
      },
      artifacts: [
        {
          id: "file:/repo/docs/result.md",
          label: "result.md",
          target: "/repo/docs/result.md",
          kind: "file",
        },
      ],
      liveFileChanges: [],
      localChanges: {
        branchName: "main",
        statusSummary: {
          data: {
            files: 4,
            insertions: 10,
            deletions: 2,
          },
        },
      },
    });

    render(<SummaryView />);

    expect(screen.getByText("Writing UI")).toBeTruthy();
    // "Done" is completed, should have line-through
    expect(screen.getByText("Done").className).toContain("line-through");
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("4 files")).toBeTruthy();
    // Branch details no longer shows line counts
    expect(screen.queryByText("+10")).toBeNull();
    expect(screen.queryByText("-2")).toBeNull();
    expect(screen.getByText("result.md")).toBeTruthy();

    fireEvent.click(screen.getByText("4 files"));
    expect(openView).toHaveBeenCalledWith("changes");

    fireEvent.click(screen.getByText("result.md"));

    expect(open).toHaveBeenCalledWith("/repo/docs/result.md");
  });

  it("opens the last-turn changes panel for the clicked live file change", () => {
    projectStoreGetState.mockReturnValue({ activeProject: { path: "/repo" } });

    useSummaryData.mockReturnValue({
      progress: null,
      artifacts: [],
      liveFileChanges: [
        {
          path: "/repo/src/renderer/src/plugins/summary/summary-view.tsx",
          insertions: 12,
          deletions: 3,
        },
      ],
      localChanges: emptyLocalChanges(),
    });

    render(<SummaryView />);

    expect(screen.getByText("Last turn changes")).toBeTruthy();
    expect(screen.getByText("summary-view.tsx")).toBeTruthy();
    expect(screen.getByText("+12").className).toContain("text-green-600");
    expect(screen.getByText("-3").className).toContain("text-red-600");

    fireEvent.click(screen.getByText("summary-view.tsx"));
    expect(open).not.toHaveBeenCalled();
    expect(openView).toHaveBeenCalledWith("changes", {
      state: { category: "last-turn" },
    });
  });

  it("always shows insertion and deletion counts, including zero", () => {
    useSummaryData.mockReturnValue({
      progress: null,
      artifacts: [],
      liveFileChanges: [
        {
          path: "/repo/src/claude-code-provider-roundtrip.test.ts",
          insertions: 22,
          deletions: 0,
        },
      ],
      localChanges: emptyLocalChanges(),
    });

    render(<SummaryView />);

    expect(screen.getByText("claude-code-provider-roundtrip.test.ts")).toBeTruthy();
    expect(screen.getByText("+22").className).toContain("text-green-600");
    expect(screen.getByText("-0").className).toContain("text-red-600");
  });

  it("shows only file count in branch details without line counts", () => {
    useSummaryData.mockReturnValue({
      progress: null,
      artifacts: [],
      liveFileChanges: [],
      localChanges: {
        branchName: "feature/test",
        statusSummary: {
          data: {
            files: 2,
            insertions: 5,
            deletions: 3,
          },
        },
      },
    });

    render(<SummaryView />);

    expect(screen.getByText("2 files")).toBeTruthy();
    // Line counts should not be shown in branch details
    expect(screen.queryByText("+5")).toBeNull();
    expect(screen.queryByText("-3")).toBeNull();
  });

  it("renders no changes as static text", () => {
    useSummaryData.mockReturnValue({
      progress: null,
      artifacts: [],
      liveFileChanges: [],
      localChanges: {
        branchName: "main",
        statusSummary: {
          data: {
            files: 0,
            insertions: 0,
            deletions: 0,
          },
        },
      },
    });

    render(<SummaryView />);

    expect(screen.getByText("No changes")).toBeTruthy();

    fireEvent.click(screen.getByText("No changes"));
    expect(openView).not.toHaveBeenCalled();
  });

  it("collapses and expands sections on trigger click", () => {
    render(<SummaryView />);

    // All sections should be expanded by default (empty state titles visible)
    expect(screen.getByText("No progress yet")).toBeTruthy();

    // Click the Progress trigger to collapse
    fireEvent.click(screen.getByText("Progress"));

    // After collapsing, the empty state title should be hidden
    expect(screen.queryByText("No progress yet")).toBeNull();

    // Click again to expand
    fireEvent.click(screen.getByText("Progress"));
    expect(screen.getByText("No progress yet")).toBeTruthy();
  });
});
