import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "@neo/ui/components/popover";
import { toastManager } from "@neo/ui/components/toast";
import debug from "debug";
import { AlertTriangleIcon, CopyIcon, EyeIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { encodeProjectPath } from "../../../../../shared/claude-code/paths";
import { cn } from "../../../lib/utils";

const log = debug("neovate:share-popover");

type State =
  | { phase: "loading" }
  | { phase: "success"; shareUrl: string }
  | { phase: "error"; code?: string };

interface Props {
  sessionId: string;
  cwd: string;
  title?: string;
}

export function SharePopover({ sessionId, cwd, title }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: "loading" });
  const seqRef = useRef(0);

  const run = useCallback(async () => {
    const seq = ++seqRef.current;
    setState({ phase: "loading" });
    const jsonlPath = `${window.api.homedir}/.claude/projects/${encodeProjectPath(cwd)}/${sessionId}.jsonl`;
    log("run: seq=%d jsonlPath=%s", seq, jsonlPath);
    try {
      const result = { success: false, data: null } as any; // swift excluded in OSS
      if (seq !== seqRef.current) return;
      if (result.success && result.data) {
        setState({ phase: "success", shareUrl: result.data.shareUrl });
      } else {
        setState({ phase: "error", code: result.error });
      }
    } catch (err) {
      if (seq !== seqRef.current) return;
      setState({ phase: "error", code: err instanceof Error ? err.message : undefined });
    }
  }, [cwd, sessionId, title]);

  useEffect(() => {
    if (open) run();
  }, [open, run]);

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toastManager.add({
      type: "success",
      title: t("session.shareLinkCopied"),
      timeout: 3000,
    });
  };

  const errorSubtext = (code?: string): string => {
    switch (code) {
      case "timeout":
        return t("session.shareError.timeout");
      case "no_messages":
        return t("session.shareError.noMessages");
      case "jsonl_not_found":
        return t("session.shareError.jsonlNotFound");
      default:
        return code ?? "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-track-id="session.share.opened"
        className={cn(
          "[-webkit-app-region:no-drag] inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent h-6 w-6",
        )}
        render={<button type="button" />}
      >
        <Share2Icon size={14} strokeWidth={1.5} />
        <span className="sr-only">{t("session.share")}</span>
      </PopoverTrigger>
      <PopoverPopup side="bottom" align="start" sideOffset={4} className="w-80">
        <PopoverTitle className="text-sm font-semibold mb-3">
          {t("session.shareDialogTitle")}
        </PopoverTitle>
        {state.phase === "loading" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2Icon size={28} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("session.shareGenerating")}</span>
          </div>
        )}
        {state.phase === "error" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <AlertTriangleIcon size={28} className="text-warning" />
            <span className="text-sm">{t("session.shareFailed")}</span>
            {state.code && (
              <span className="text-xs text-muted-foreground text-center">
                {errorSubtext(state.code)}
              </span>
            )}
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={run}
              data-track-id="session.share.retried"
            >
              {t("session.shareRetry")}
            </button>
          </div>
        )}
        {state.phase === "success" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("session.shareDescription")}</p>
            <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1.5">
              <input
                readOnly
                value={state.shareUrl}
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
              />
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => handleCopy(state.shareUrl)}
                data-track-id="session.share.copied"
                title={t("session.share")}
              >
                <CopyIcon size={14} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => window.open(state.shareUrl, "_blank")}
                data-track-id="session.share.previewed"
              >
                <EyeIcon size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}
