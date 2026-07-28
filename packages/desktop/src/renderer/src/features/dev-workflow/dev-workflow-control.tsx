import debug from "debug";
import { CodeIcon } from "lucide-react";
import { CheckIcon, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import type { DevMode, DevWorkflowConfig } from "../../../../shared/features/dev-workflow/contract";

import { Button } from "../../components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu";
import { client } from "../../orpc";

const log = debug("neovate:dev-workflow");

const MODES: { value: DevMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "plan", label: "Plan" },
  { value: "dev", label: "Dev" },
];

/**
 * 开发工作流控件：devMode 切换 + 草稿前置。挂在侧栏标题栏。
 * 后端 `main/features/dev-workflow`，session 构造时按 mode 覆盖 permissionMode，
 * draftPrefix 在每轮用户消息前注入。
 */
export function DevWorkflowControl() {
  const [config, setConfig] = useState<DevWorkflowConfig>({ mode: "default", draftPrefix: "" });
  const [draftOpen, setDraftOpen] = useState(false);

  useEffect(() => {
    void client.devWorkflow.get().then((c) => setConfig(c));
  }, []);

  const changeMode = (mode: DevMode) => {
    log("changeMode: %s", mode);
    void client.devWorkflow.set({ mode }).then((c) => setConfig(c));
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={`Dev workflow: ${config.mode}`}
            >
              <CodeIcon size={15} strokeWidth={1.5} />
            </Button>
          }
        />
        <MenuPopup side="bottom" align="end" className="text-xs">
          <MenuGroup>
            <MenuGroupLabel>Dev workflow</MenuGroupLabel>
            {MODES.map((m) => (
              <MenuItem key={m.value} onClick={() => changeMode(m.value)}>
                <span className="flex-1">{m.label}</span>
                {config.mode === m.value && <CheckIcon size={12} />}
              </MenuItem>
            ))}
          </MenuGroup>
          <MenuSeparator />
          <MenuItem onClick={() => setDraftOpen(true)}>
            <FileText size={14} />
            <span className="flex-1">Draft prefix…</span>
            {config.draftPrefix.trim() && (
              <span className="text-[10px] text-muted-foreground">set</span>
            )}
          </MenuItem>
        </MenuPopup>
      </Menu>
      {draftOpen && (
        <DraftPrefixDialog
          value={config.draftPrefix}
          onClose={() => setDraftOpen(false)}
          onSave={async (draftPrefix) => {
            const c = await client.devWorkflow.set({ draftPrefix });
            setConfig(c);
          }}
        />
      )}
    </>
  );
}

function DraftPrefixDialog({
  value,
  onClose,
  onSave,
}: {
  value: string;
  onClose: () => void;
  onSave: (draftPrefix: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(text);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Draft prefix</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          该内容会前置注入到每轮用户消息，用于固定上下文/角色设定。
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-40 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="例：你是一位资深前端工程师，回答需简洁…"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
