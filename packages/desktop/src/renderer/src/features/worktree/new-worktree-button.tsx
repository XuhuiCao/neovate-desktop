import { Button } from "@neo/ui/components/button";
import { Input } from "@neo/ui/components/input";
import { Spinner } from "@neo/ui/components/spinner";
import debug from "debug";
import { GitFork } from "lucide-react";
import { useState } from "react";

import { client } from "../../orpc";
import { useNewSession } from "../agent/hooks/use-new-session";
import { useProjectStore } from "../project/store";

const log = debug("neovate:worktree");

/**
 * 「新建 Worktree」按钮 + 对话框。挂在侧栏标题栏。
 *
 * 创建成功后调用 `createNewSession(worktreePath)`，以 worktree 路径为 cwd
 * 启动新会话（main 侧 SessionManager 已 cwd-agnostic）。
 */
export function NewWorktreeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="New Worktree"
      >
        <GitFork size={15} strokeWidth={1.5} />
      </Button>
      {open && <NewWorktreeDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NewWorktreeDialog({ onClose }: { onClose: () => void }) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const { createNewSession } = useNewSession();

  const [branch, setBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const projectPath = activeProject?.path;
    if (!projectPath) {
      setError("No active project");
      return;
    }
    if (!branch.trim()) {
      setError("Branch name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await client.worktree.create({
        projectPath,
        branch: branch.trim(),
        baseBranch: baseBranch.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to create worktree");
        return;
      }
      log("worktree created: %s", result.data?.path);
      onClose();
      // Start a new session inside the worktree
      void createNewSession(result.data!.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <GitFork className="size-5 text-primary" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">New Git Worktree</h2>
            <p className="text-xs text-muted-foreground">
              在隔离的 worktree 中开始分支开发，会话将以 worktree 路径为工作目录。
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Branch name
            </span>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feature/xx"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Base branch (optional)
            </span>
            <Input
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              placeholder="main"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !branch.trim()}>
            {busy ? <Spinner className="size-4" /> : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
