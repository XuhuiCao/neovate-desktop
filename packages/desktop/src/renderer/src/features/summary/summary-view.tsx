import type { ReactNode } from "react";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@neo/ui/components/collapsible";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import debug from "debug";
import {
  ChevronDownIcon,
  FileTextIcon,
  GitBranchIcon,
  LinkIcon,
  ListTodoIcon,
  FileEditIcon,
  PackageOpenIcon,
  FileDiffIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { useRendererApp } from "../../core/app";
import { cn } from "../../lib/utils";
import { useAgentStore } from "../agent/store";
import { getChangesStore } from "../changes/hooks";
import { useProjectStore } from "../project/store";
import { useSummaryData } from "./hooks/use-summary-data";

const log = debug("neovate:changes");
import { useSummaryTranslation } from "./i18n";

// Hover intent delay for tooltip open (matches the rest of the app's intent).
const TOOLTIP_HOVER_INTENT_DELAY = 400;

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

// 字体层级系统（全部使用 rem 相对单位，跟随 appFontSize 设置缩放）
// text-xs uppercase tracking-wide - Section 折叠标题（结构层，用大写+字距区分）
// text-sm - 内容文本：todo label、文件名（信息层，与消息正文同级）
// text-xs - 辅助信息：标签、统计、空状态（辅助层）
// font-mono text-xs - 代码类值：分支名
// 颜色层级：foreground(内容) > muted-foreground(标签/结构/辅助) — 统一使用标准 token，不加透明度

function Section({
  title,
  extra,
  defaultOpen = true,
  children,
}: {
  title: string;
  extra?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
        {title}
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-all duration-200 ease-out",
            "group-hover:text-foreground",
            !open && "-rotate-90",
          )}
        />
        {extra && <span className="ml-auto">{extra}</span>}
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="mt-2">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// 空状态设计：柔和的图标容器 + 清晰的层级
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <div className="mb-2 flex size-7 items-center justify-center rounded-md bg-muted/60">
        <Icon className="size-3.5 text-muted-foreground/40" strokeWidth={1.5} />
      </div>
      <div className="text-xs text-muted-foreground/60">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground/40">{description}</div>
    </div>
  );
}

// ============================================
// 克制的 TodoList 设计
// ============================================

type TodoStatus = "pending" | "in_progress" | "completed";

interface ProgressTodo {
  content: string;
  label: string;
  status: TodoStatus;
}

interface ProgressSummaryProps {
  todos: ProgressTodo[];
}

// 简洁状态指示器
function StatusDot({ status }: { status: TodoStatus }) {
  if (status === "completed") {
    return (
      <div className="flex size-4 items-center justify-center shrink-0">
        <CheckCircle2Icon className="size-3.5 text-emerald-500" strokeWidth={2} />
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="flex size-4 items-center justify-center shrink-0">
        <Loader2Icon className="size-3.5 animate-spin text-primary" strokeWidth={2} />
      </div>
    );
  }
  return <div className="size-4 shrink-0 rounded-full border border-muted-foreground/40" />;
}

// 单条任务项：极简设计
function TodoItem({ todo, isActive }: { todo: ProgressTodo; isActive: boolean }) {
  const isCompleted = todo.status === "completed";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 py-1.5 rounded-sm transition-colors",
        isActive && "bg-muted/60",
        !isActive && "hover:bg-muted/40",
      )}
    >
      <StatusDot status={todo.status} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          isCompleted && "text-muted-foreground line-through",
          !isCompleted && "text-foreground",
        )}
        title={todo.label}
      >
        {todo.label}
      </span>
    </div>
  );
}

// 滑动容器：自动滚动到进行中项 + 上下渐隐
function TodoScrollContainer({
  children,
  activeIndex,
}: {
  children: ReactNode;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fadeMask, setFadeMask] = useState("none");

  const THRESHOLD = 8;

  function buildMask(canScrollUp: boolean, canScrollDown: boolean) {
    // 无需渐隐
    if (!canScrollUp && !canScrollDown) return "none";

    const top = canScrollUp ? "transparent, black 20px" : "black";
    const bottom = canScrollDown ? "calc(100% - 20px), transparent" : "black";

    return `linear-gradient(to bottom, ${top}, ${bottom})`;
  }

  function updateMask() {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > THRESHOLD;
    const canScrollDown = scrollHeight - scrollTop - clientHeight > THRESHOLD;

    setFadeMask(buildMask(canScrollUp, canScrollDown));
  }

  // 监听滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateMask();
    el.addEventListener("scroll", updateMask, { passive: true });

    // 用 ResizeObserver 监听内容高度变化
    const observer = new ResizeObserver(updateMask);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateMask);
      observer.disconnect();
    };
  }, []);

  // 内容变化时更新
  useEffect(() => {
    updateMask();
  }, [children]);

  // 自动滚动到进行中项
  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const container = containerRef.current;
      const activeItem = container.children[activeIndex] as HTMLElement;

      if (activeItem) {
        const itemTop = activeItem.offsetTop;
        const containerHeight = container.clientHeight;
        const scrollTarget = itemTop - containerHeight / 3;

        container.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: "smooth",
        });
      }
    }
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto scroll-smooth"
      style={{
        maxHeight: "var(--summary-section-max-h, 180px)",
        WebkitMaskImage: fadeMask,
        maskImage: fadeMask,
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(0,0,0,0.08) transparent",
      }}
    >
      {children}
    </div>
  );
}

// 进度模块
function ProgressModule({ todos }: ProgressSummaryProps) {
  const activeIndex = todos.findIndex((t) => t.status === "in_progress");

  return (
    <TodoScrollContainer activeIndex={activeIndex >= 0 ? activeIndex : 0}>
      <div className="flex flex-col">
        {todos.map((todo, index) => (
          <TodoItem
            key={`${todo.status}:${todo.content}`}
            todo={todo}
            isActive={index === activeIndex}
          />
        ))}
      </div>
    </TodoScrollContainer>
  );
}

export default function SummaryView({
  compact,
  headerExtra,
}: { compact?: boolean; headerExtra?: ReactNode } = {}) {
  const { t } = useSummaryTranslation();
  const app = useRendererApp();
  const sessionId = useAgentStore((s) => s.activeSessionId);
  const cwd = useProjectStore((s) => s.activeProject?.path ?? null);
  const { progress, artifacts, liveFileChanges, localChanges } = useSummaryData(sessionId, cwd);

  const status = localChanges.statusSummary.data;
  const branchName = localChanges.branchName;
  const changedFiles = status?.files ?? 0;

  return (
    <div
      className={cn("flex flex-col gap-3 p-3 text-sm", !compact && "h-full overflow-auto")}
      style={compact ? { ["--summary-section-max-h" as string]: "none" } : undefined}
    >
      {headerExtra && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("summary.title")}</span>
          {headerExtra}
        </div>
      )}
      {/* Branch Details */}
      <Section title={t("summary.branchDetails")}>
        {branchName ? (
          <div className="flex flex-col">
            {/* 当前分支 */}
            <div className="flex items-center gap-1.5 px-1 py-1.5">
              <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t("summary.branchLabel")}</span>
              <span className="ml-auto shrink-0">
                <TooltipProvider delay={TOOLTIP_HOVER_INTENT_DELAY}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="block truncate max-w-[160px] font-mono text-xs text-foreground text-right">
                          {branchName}
                        </span>
                      }
                    />
                    <TooltipPopup>
                      <span className="font-mono">{branchName}</span>
                    </TooltipPopup>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </div>

            {/* 变更 */}
            {changedFiles > 0 ? (
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-1 py-1.5 text-left hover:bg-muted/50 rounded-sm transition-colors"
                onClick={() => app.workbench.contentPanel.openView("changes")}
              >
                <FileDiffIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t("summary.changesLabel")}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {t("summary.fileCount", { count: changedFiles })}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-1 py-1.5">
                <FileDiffIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t("summary.changesLabel")}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("summary.noChanges")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={GitBranchIcon}
            title={t("summary.branchDetails.empty.title")}
            description={t("summary.branchDetails.empty.description")}
          />
        )}
      </Section>

      <div
        className="mx-auto w-full border-b border-border/40"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
          maskImage:
            "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
        }}
      />

      {/* Progress */}
      <Section title={t("summary.progress")}>
        {progress ? (
          <ProgressModule todos={progress.todos} />
        ) : (
          <EmptyState
            icon={ListTodoIcon}
            title={t("summary.progress.empty.title")}
            description={t("summary.progress.empty.description")}
          />
        )}
      </Section>

      {/* Live File Changes */}
      <Section
        title={t("summary.liveFileChanges")}
        extra={
          liveFileChanges.length > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">
              {liveFileChanges.length}
            </span>
          ) : undefined
        }
      >
        {liveFileChanges.length > 0 ? (
          <div
            className="overflow-y-auto scroll-smooth"
            style={{
              maxHeight: "var(--summary-section-max-h, 180px)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(0,0,0,0.08) transparent",
            }}
          >
            {liveFileChanges.map((file) => (
              <button
                key={file.path}
                type="button"
                className="flex w-full min-w-0 items-center gap-2 px-1 py-1.5 text-left rounded-sm hover:bg-muted/50 transition-colors"
                onClick={() => {
                  const cwd = useProjectStore.getState().activeProject?.path ?? null;
                  if (cwd) {
                    const base = cwd + "/";
                    const relPath = file.path.startsWith(base)
                      ? file.path.slice(base.length)
                      : file.path;
                    const store = getChangesStore();
                    log("openTurnDiff (summary)", { cwd, relPath });
                    store.getState().setCategory(cwd, "last-turn");
                    store.getState().expandFile(cwd, relPath);
                    store.getState().setForceVisible(cwd, relPath, true);
                    store.getState().selectFile(cwd, relPath);
                    app.workbench.contentPanel.openView("changes", {
                      state: { category: "last-turn" },
                    });
                  }
                }}
              >
                <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {fileNameFromPath(file.path)}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                  <span className="text-green-600/80 dark:text-green-500/80">
                    +{file.insertions}
                  </span>
                  <span className="text-red-600/80 dark:text-red-500/80">-{file.deletions}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileEditIcon}
            title={t("summary.liveFileChanges.empty.title")}
            description={t("summary.liveFileChanges.empty.description")}
          />
        )}
      </Section>

      {/* Artifacts */}
      <Section title={t("summary.artifacts")}>
        {artifacts.length > 0 ? (
          <div className="flex flex-col">
            {artifacts.map((artifact) => {
              const Icon = artifact.kind === "link" ? LinkIcon : FileTextIcon;
              return (
                <TooltipProvider key={artifact.id} delay={400}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-sm text-foreground rounded-sm hover:text-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => app.opener.open(artifact.target)}
                        >
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate">{artifact.label}</span>
                        </button>
                      }
                    />
                    <TooltipPopup>
                      <span className="break-all">{artifact.target}</span>
                    </TooltipPopup>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={PackageOpenIcon}
            title={t("summary.artifacts.empty.title")}
            description={t("summary.artifacts.empty.description")}
          />
        )}
      </Section>
    </div>
  );
}
