import {
  BarChart3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  GitBranchIcon,
  Loader2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { RecentActivity, Contributor } from "../../../../../shared/features/git/types";

import { client } from "../../../orpc";
import { ModuleIntroBanner } from "./module-intro-banner";

const INITIAL_VISIBLE_COUNT = 5;

function InfoSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        {action}
      </div>
      <div className="rounded-lg border border-border/40 divide-y divide-border/30">{children}</div>
    </div>
  );
}

interface InsightsTabProps {
  projectPath: string;
}

export function InsightsTab({ projectPath }: InsightsTabProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [isContributorsExpanded, setIsContributorsExpanded] = useState(false);

  useEffect(() => {
    if (!projectPath) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchData = async () => {
      // Check if it's a git repo first
      const result = await client.git.isGitRepo({ projectPath });
      setIsGitRepo(result.status === "repo");

      if (result.status !== "repo") {
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled([
        client.git.getRecentActivity({ cwd: projectPath, limit: 20 }),
        client.git.getContributors({ cwd: projectPath, limit: 50 }),
      ]);

      if (results[0].status === "fulfilled") {
        setRecentActivity(results[0].value);
      }
      if (results[1].status === "fulfilled") {
        setContributors(results[1].value);
      }

      setLoading(false);
    };

    fetchData();
  }, [projectPath]);

  const formatCommitDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) return t("projectInfo.justNow");
      if (diffHours < 24) return t("projectInfo.hoursAgo", { count: diffHours });
      if (diffDays < 7) return t("projectInfo.daysAgo", { count: diffDays });
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (!isGitRepo) {
    return (
      <div className="rounded-lg border border-border/40 py-12 px-6 text-center">
        <div className="text-sm text-muted-foreground">{t("projectInfo.notGitRepo")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Module Introduction */}
      <ModuleIntroBanner
        title={t("projectInfo.projectInsights")}
        description={t("projectInfo.insightsDescription")}
        icon={BarChart3Icon}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Data Sections */}
      {!loading && (
        <>
          {/* Recent Commits */}
          {recentActivity && recentActivity.commits.length > 0 && (
            <InfoSection
              title={t("projectInfo.recentCommits")}
              action={
                <span className="text-sm text-muted-foreground">
                  {t("projectInfo.recentCommitsCount", { count: recentActivity.commits.length })}
                </span>
              }
            >
              <div className="max-h-60 overflow-y-auto">
                {recentActivity.commits.slice(0, 10).map((commit) => (
                  <div
                    key={commit.hash}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0 mt-0.5">
                      {commit.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{commit.message}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                        <span>{commit.author}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                          {commit.shortHash}
                        </code>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{formatCommitDate(commit.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Active Branches */}
          {recentActivity && recentActivity.branches.length > 0 && (
            <InfoSection
              title={t("projectInfo.activeBranches")}
              action={
                <span className="text-sm text-muted-foreground">
                  {t("projectInfo.branchesCount", { count: recentActivity.branches.length })}
                </span>
              }
            >
              <div className="max-h-48 overflow-y-auto">
                {recentActivity.branches.slice(0, 5).map((branch) => (
                  <div
                    key={branch.name}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranchIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{branch.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                      <span>{branch.lastCommitAuthor}</span>
                      <span>{formatCommitDate(branch.lastCommitDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Contributors Ranking */}
          {contributors.length > 0 && (
            <InfoSection
              title={t("projectInfo.topContributors")}
              action={
                <span className="text-sm text-muted-foreground">
                  {t("projectInfo.contributorsCount", { count: contributors.length })}
                </span>
              }
            >
              <>
                {(isContributorsExpanded
                  ? contributors
                  : contributors.slice(0, INITIAL_VISIBLE_COUNT)
                ).map((c, i) => (
                  <div
                    key={c.email || c.name}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground truncate">{c.name}</span>
                          {i < 3 && (
                            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              Top {i + 1}
                            </span>
                          )}
                        </div>
                        {c.email && (
                          <div className="text-sm text-muted-foreground truncate">{c.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground tabular-nums">
                          {c.commitCount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("projectInfo.commits")}
                        </div>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <div className="text-xs text-muted-foreground">
                          {t("projectInfo.lastActive")}
                        </div>
                        <div className="text-sm text-foreground">
                          {formatCommitDate(c.lastCommitDate ?? "")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Show More / Show Less */}
                {contributors.length > INITIAL_VISIBLE_COUNT && (
                  <button
                    onClick={() => setIsContributorsExpanded(!isContributorsExpanded)}
                    className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    {isContributorsExpanded ? (
                      <>
                        <ChevronUpIcon className="size-3.5" />
                        {t("common.showLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="size-3.5" />
                        {t("common.showMore", {
                          count: contributors.length - INITIAL_VISIBLE_COUNT,
                        })}
                      </>
                    )}
                  </button>
                )}
              </>
            </InfoSection>
          )}
        </>
      )}
    </div>
  );
}
