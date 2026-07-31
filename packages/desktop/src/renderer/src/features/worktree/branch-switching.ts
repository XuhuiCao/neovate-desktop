import type { BranchSummary } from "../../../../shared/features/git/types";

export type BranchOption = {
  label: string;
  value: string;
  name: string;
  remote: string | null;
  current: boolean;
  commit: string;
};

export type BranchSwitchDecision =
  | { type: "noop" }
  | { type: "switch"; branch: string }
  | { type: "reject"; reason: "diverged"; local: string; remote: string };

function parseRemoteTrackingName(name: string): { remote: string; name: string } | null {
  const match = /^remotes\/([^/]+)\/(.+)$/.exec(name);
  if (!match) return null;

  const [, remote, branchName] = match;
  if (branchName === "HEAD") return null;

  return { remote, name: branchName };
}

export function listBranchOptions(summary: BranchSummary): BranchOption[] {
  return Object.values(summary.branches)
    .filter((branch) => !branch.linkedWorkTree)
    .flatMap((branch): BranchOption[] => {
      const remote = parseRemoteTrackingName(branch.name);
      if (remote) {
        return [
          {
            label: `${remote.remote}/${remote.name}`,
            value: `r:${remote.remote}/${remote.name}`,
            name: remote.name,
            remote: remote.remote,
            current: false,
            commit: branch.commit,
          },
        ];
      }

      if (branch.name.startsWith("remotes/")) return [];

      return [
        {
          label: branch.name,
          value: `l:${branch.name}`,
          name: branch.name,
          remote: null,
          current: branch.current,
          commit: branch.commit,
        },
      ];
    });
}

export function getBranchSwitchDecision(
  summary: BranchSummary,
  branch: BranchOption,
): BranchSwitchDecision {
  if (branch.remote === null) {
    return branch.current ? { type: "noop" } : { type: "switch", branch: branch.name };
  }

  const localEntry = summary.branches[branch.name];
  const remoteEntry = summary.branches[`remotes/${branch.remote}/${branch.name}`];

  if (localEntry && remoteEntry && localEntry.commit !== remoteEntry.commit) {
    return {
      type: "reject",
      reason: "diverged",
      local: branch.name,
      remote: branch.remote,
    };
  }

  return { type: "switch", branch: branch.name };
}
