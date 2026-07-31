import type { StickToBottomContext } from "use-stick-to-bottom";

import { ArrowDown01Icon, ArrowUp01Icon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import debug from "debug";
import { XIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ReactGrabCommentPayload } from "../../../../../shared/claude-code/types";
import type { ImageAttachment } from "../../../../../shared/features/agent/types";
import type { RateLimitNotice } from "../chat-state";
import type { QueuedMessage } from "../store";

import { PLAYGROUND_PROJECT_ID } from "../../../../../shared/features/project/constants";
import { getChatPanelBgUrl } from "../../../assets/images";
import { layoutStore } from "../../../components/app-layout/store";
import { FilePathStatusProvider } from "../../../core/file-path-status/provider";
import { DevModeSelector } from "../../dev-workflow";
import { useActiveProject } from "../../project";
import { ProjectSelector } from "../../project/components/project-selector";
import { DraftToolbar } from "../../worktree/components/draft-toolbar";
import { draftAgentStore, useDraftAgentStore } from "../draft-store";
import { handleSessionInitError } from "../lib/session-init-error";
import { navigateToDraft } from "../navigation";
import { useAgentStore } from "../store";
import { attachmentsToFileParts } from "../utils/attachments-to-file-parts";
import { DeeplinkProjectDialogHost } from "./deeplink-project-dialog";
import { QueuedMessagesPreview } from "./queued-messages-preview";

const chatLog = debug("neovate:agent-chat");

import { Button } from "@neo/ui/components/button";

import { ConversationAnchorScrollbar } from "../../../components/ai-elements/anchor-scrollbar";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../../../components/ai-elements/conversation";
import { ErrorBoundary } from "../../../components/ui/error-boundary";
import { cn } from "../../../lib/utils";
// cloud-gated: CloudSyncButton import disabled in OSS
// cloud-gated: RemoteSessionWebview import disabled in OSS
import {
  SummaryPanelProvider,
  SummaryTriggerButton,
  SummaryPinnedPanel,
} from "../../summary/summary-floating-trigger";
import { claudeCodeChatManager } from "../chat-manager";
import { useClaudeCodeChat } from "../hooks/use-claude-code-chat";
import { useNewSession } from "../hooks/use-new-session";
import { useScrollPosition } from "../hooks/use-scroll-position";
import { useSessionLifecycleSubscription } from "../hooks/use-session-lifecycle-subscription";
import { ContextLeft } from "./context-left";
import { ConversationBranchSwitcher } from "./conversation-branch-switcher";
import { MessageInput, type MessageInputHandle } from "./message-input";
import { MessageParts } from "./message-parts";
import { PermissionDialog } from "./permission-dialog";
import { TaskProgress } from "./task-progress";
import { ClaudeCodeToolUIPart } from "./tool-parts";
import { WelcomePanel } from "./welcome-panel";

function ChatError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const firstLine = message.split("\n")[0];
  const hasDetails = message.length > firstLine.length;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  return (
    <div className="mx-4 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 break-words">{firstLine}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon-xs" onClick={handleCopy} title={t("error.copyError")}>
            {copied ? (
              <HugeiconsIcon icon={Tick01Icon} size={14} strokeWidth={1.5} />
            ) : (
              <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.5} />
            )}
          </Button>
          {hasDetails && (
            <Button variant="ghost" size="icon-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? (
                <HugeiconsIcon icon={ArrowUp01Icon} size={14} strokeWidth={1.5} />
              ) : (
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.5} />
              )}
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon-xs" onClick={onDismiss}>
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-xs opacity-80">
          {message.slice(firstLine.length + 1)}
        </pre>
      )}
    </div>
  );
}

function RateLimitNoticeBanner({ notice }: { notice: RateLimitNotice | null }) {
  const { t } = useTranslation();
  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="chat-rate-limit-notice"
      className="mx-4 mb-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
    >
      <div className="font-medium">{t("chat.rateLimit.title")}</div>
      <div className="mt-0.5 text-xs opacity-85">{t("chat.rateLimit.description")}</div>
    </div>
  );
}

export function AgentChat() {
  const { t } = useTranslation();
  const { project, cwd: projectCwd } = useActiveProject();
  const projectPath = project?.path ?? "";

  const remoteMode = useAgentStore((s) => s.remoteMode);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const sessionInitError = useAgentStore((s) => s.sessionInitError);
  const setSessionInitError = useAgentStore((s) => s.setSessionInitError);

  const activeDraftProjectPath = useDraftAgentStore((s) => s.activeDraftProjectPath);

  const { createNewSession } = useNewSession();

  // Derive cwd from active state
  const sessionCwd = useAgentStore((s) =>
    s.activeSessionId ? s.sessions.get(s.activeSessionId)?.cwd : undefined,
  );
  const cwd = sessionCwd ?? activeDraftProjectPath ?? projectCwd ?? "";

  useSessionLifecycleSubscription(cwd);

  // Keep webview mounted once it has been shown, to avoid reload on mode switch
  const webviewMountedRef = useRef(false);
  if (remoteMode) webviewMountedRef.current = true;

  // Enter draft if no active session on project switch (skip if full right panel is open)
  useEffect(() => {
    const draftCwd = projectCwd ?? projectPath;
    if (draftCwd && !useAgentStore.getState().activeSessionId) {
      // Skip navigation if a full right panel (e.g., project info) is open
      if (layoutStore.getState().fullRightPanelId) {
        chatLog("effect[project-switch]: skipping navigateToDraft, fullRightPanel is open");
        return;
      }
      chatLog("effect[project-switch]: entering draft for %s", draftCwd);
      navigateToDraft(draftCwd);
    }
  }, [projectPath, projectCwd]);

  // Concurrency guard for handleSend
  const sendingRef = useRef(false);

  const handleSend = async (
    message: string,
    attachments?: ImageAttachment[],
    reactGrabComments?: ReactGrabCommentPayload | null,
  ) => {
    const draftPath = draftAgentStore.getState().activeDraftProjectPath;
    const targetCwd = draftPath ?? cwd;
    if (!targetCwd) return;
    if (sendingRef.current) return;

    let sessionId = useAgentStore.getState().activeSessionId;

    // Draft state: create session on first message send
    if (!sessionId) {
      chatLog("handleSend: draft — creating session cwd=%s", targetCwd);
      // Read draft overrides before creating session (exitDraft clears them)
      const currentDraft = draftPath ? draftAgentStore.getState().drafts[draftPath] : undefined;
      const draftPermission = currentDraft?.permissionMode;
      console.log(
        `[DEBUG] handleSend draft draftPath=${draftPath} selectedModelId=${currentDraft?.selectedModelId} selectedProviderId=${currentDraft?.selectedProviderId}`,
      );

      sendingRef.current = true;
      try {
        if (!project) {
          setSessionInitError("No active project");
          return;
        }
        sessionId =
          (await createNewSession(targetCwd, project.id, {
            model: currentDraft?.selectedModelId ?? undefined,
            providerId: currentDraft?.selectedProviderId,
          })) ?? null;
        if (!sessionId) return;
      } catch (error) {
        setSessionInitError(handleSessionInitError(error, t).message);
        return;
      } finally {
        sendingRef.current = false;
      }

      // Apply permission override (model/provider already passed to createSession)
      if (draftPermission && sessionId) {
        useAgentStore.getState().setPermissionMode(sessionId, draftPermission);
        claudeCodeChatManager.getChat(sessionId)?.dispatch({
          kind: "configure",
          configure: { type: "set_permission_mode", mode: draftPermission },
        });
      }

      draftAgentStore.getState().exitDraft();
    }

    chatLog(
      "handleSend: sessionId=%s msgLen=%d attachments=%d",
      sessionId.slice(0, 8),
      message.length,
      attachments?.length ?? 0,
    );
    useAgentStore
      .getState()
      .addUserMessage(sessionId, message, { reactGrabComments: reactGrabComments ?? undefined });
    const files = attachmentsToFileParts(attachments);
    claudeCodeChatManager.getChat(sessionId)?.sendMessage({
      text: message,
      files: files.length > 0 ? files : undefined,
      metadata: {
        sessionId,
        parentToolUseId: null,
        reactGrabComments: reactGrabComments ?? undefined,
      },
    });
  };

  const handleRetry = useCallback(() => {
    const retryCwd = draftAgentStore.getState().activeDraftProjectPath ?? cwd;
    if (!retryCwd || !project) return;
    setSessionInitError(null);
    createNewSession(retryCwd, project.id).catch((error) => {
      setSessionInitError(handleSessionInitError(error, t).message);
    });
  }, [cwd, project, createNewSession, setSessionInitError, t]);

  return (
    <div className="h-full">
      {/* Remote webview: mount once activated, then keep alive via CSS toggle */}
      {webviewMountedRef.current && (
        <div className={remoteMode ? "h-full" : "hidden"}>
          {/* cloud-gated: RemoteSessionWebview disabled in OSS */}
        </div>
      )}
      <div className={remoteMode ? "hidden" : "h-full"}>
        {/* Boundary scoped to the active session/draft so a runtime error in
            AgentChatSession or AgentChatDraft (e.g. React error #185) shows a
            recoverable fallback instead of unmounting the whole app to a white
            screen. Keyed on the session/draft identity so switching sessions
            naturally resets the boundary. */}
        <ErrorBoundary key={activeSessionId ?? project?.id ?? "no-project"}>
          {activeSessionId && sessionCwd ? (
            <AgentChatSession key={activeSessionId} sessionId={activeSessionId} cwd={sessionCwd} />
          ) : (
            <AgentChatDraft
              key={project?.id ?? "no-project"}
              project={project}
              activeDraftProjectPath={activeDraftProjectPath}
              sessionInitError={sessionInitError}
              sendingRef={sendingRef}
              onSend={handleSend}
              onRetry={handleRetry}
            />
          )}
        </ErrorBoundary>
      </div>
      <DeeplinkProjectDialogHost />
    </div>
  );
}

type AgentChatDraftProps = {
  project: ReturnType<typeof useActiveProject>["project"];
  activeDraftProjectPath: string | null;
  sessionInitError: string | null;
  sendingRef: React.RefObject<boolean>;
  onSend: (
    message: string,
    attachments?: ImageAttachment[],
    reactGrabComments?: ReactGrabCommentPayload | null,
  ) => void;
  onRetry: () => void;
};

function AgentChatDraft({
  project,
  activeDraftProjectPath,
  sessionInitError,
  sendingRef,
  onSend,
  onRetry,
}: AgentChatDraftProps) {
  const devMode = useDraftAgentStore(
    (s) =>
      (activeDraftProjectPath ? s.drafts[activeDraftProjectPath]?.devMode : undefined) ?? "free",
  );

  const isPlayground = project?.id === PLAYGROUND_PROJECT_ID;
  // Show DevModeSelector for non-Playground draft projects. The selector
  // itself self-hides when no injectable dev-workflow plugin is enabled at
  // this cwd, so a render here is "candidate slot", not "guaranteed UI".
  const shouldShowDevModeSelector = !isPlayground && !!activeDraftProjectPath;

  return (
    <DraftBackground>
      <div className="mb-auto mt-[20vh] flex flex-col items-center gap-4">
        <WelcomePanel devMode={devMode} projectName={project?.name} isPlayground={isPlayground} />
        {shouldShowDevModeSelector && <DevModeSelector projectPath={activeDraftProjectPath} />}
        {activeDraftProjectPath ? (
          <div className="mx-auto w-full max-w-3xl">
            <MessageInput
              onSend={onSend}
              onCancel={() => {}}
              streaming={false}
              disabled={false}
              sessionInitializing={sendingRef.current}
              sessionInitError={sessionInitError}
              onRetry={onRetry}
              cwd={activeDraftProjectPath ?? ""}
            />
            <DraftToolbar />
          </div>
        ) : (
          <ProjectSelector variant="select" />
        )}
      </div>
    </DraftBackground>
  );
}

function DraftBackground({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      className="flex h-full flex-col bg-cover bg-no-repeat bg-[position:0_0]"
      style={{
        backgroundImage: `url("${getChatPanelBgUrl(resolvedTheme as "dark" | "light" | undefined)}")`,
      }}
    >
      {children}
    </div>
  );
}

function AgentChatSession({ sessionId, cwd }: { sessionId: string; cwd: string }) {
  const tasks = useAgentStore((s) => s.sessions.get(sessionId)?.tasks);
  const {
    messages,
    status,
    error,
    pendingRequests,
    rateLimitNotice,
    sendMessage,
    stop,
    clearError,
  } = useClaudeCodeChat(sessionId);
  const hasPendingRequest = pendingRequests.length > 0;
  const isProcessing = status === "streaming" || status === "submitted";

  // Ref to access scroll context for smooth scrolling on new message
  const conversationContextRef = useRef<StickToBottomContext | null>(null);

  const composerRef = useRef<MessageInputHandle>(null);

  const { initialScrollBehavior } = useScrollPosition(sessionId, conversationContextRef);

  const handleSend = (
    text: string,
    attachments?: ImageAttachment[],
    reactGrabComments?: ReactGrabCommentPayload | null,
  ) => {
    chatLog(
      "handleSend: sessionId=%s msgLen=%d attachments=%d",
      sessionId.slice(0, 8),
      text.length,
      attachments?.length ?? 0,
    );
    const files = attachmentsToFileParts(attachments);
    sendMessage({
      text,
      files: files.length > 0 ? files : undefined,
      metadata: {
        sessionId,
        parentToolUseId: null,
        reactGrabComments: reactGrabComments ?? undefined,
      },
    });
    // Smooth scroll to bottom when user sends a new message
    conversationContextRef.current?.scrollToBottom("smooth");
  };

  const handleCancel = () => {
    chatLog("handleCancel: sessionId=%s", sessionId.slice(0, 8));
    stop();
  };

  const handleEditQueued = useCallback(
    (item: QueuedMessage) => {
      if (!composerRef.current) return;
      composerRef.current.seed({
        content: item.content,
        attachments: item.attachments,
        reactGrabComments: item.reactGrabComments,
      });
      useAgentStore.getState().removeQueued(sessionId, item.id);
    },
    [sessionId],
  );

  return (
    <SummaryPanelProvider>
      <div className="@container/chat relative flex h-full flex-row" data-slot="chat-session">
        {/* Chat main area */}
        <div className="relative flex h-full min-w-0 flex-1 flex-col">
          <SummaryTriggerButton />
          <FilePathStatusProvider>
            <Conversation
              contextRef={conversationContextRef}
              initial={initialScrollBehavior}
              data-testid="chat-panel"
            >
              <ConversationContent data-testid="chat-messages-container">
                {messages.map((message, i) => (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    data-message-role={message.role}
                    className="min-w-0"
                  >
                    <MessageParts
                      message={message}
                      isComplete={
                        (status !== "streaming" && status !== "submitted") ||
                        i !== messages.length - 1
                      }
                      renderToolPart={(_partMessage, part) => <ClaudeCodeToolUIPart part={part} />}
                      sessionId={sessionId}
                      isStreaming={status === "streaming" || status === "submitted"}
                      isLatestTurnWithChanges={i === messages.length - 1}
                    />
                  </div>
                ))}
              </ConversationContent>
              <ConversationScrollButton />
              <ConversationAnchorScrollbar messages={messages} />
            </Conversation>
          </FilePathStatusProvider>
          <div className="shrink-0 max-w-3xl mx-auto w-full">
            <TaskProgress tasks={tasks} />
            <RateLimitNoticeBanner notice={rateLimitNotice} />
            {error && <ChatError message={error.message} onDismiss={clearError} />}
            {!hasPendingRequest && (
              <QueuedMessagesPreview sessionId={sessionId} onEdit={handleEditQueued} />
            )}
            <div className={cn("relative min-w-0", hasPendingRequest && "grid")}>
              <div
                className={cn(hasPendingRequest && "col-start-1 row-start-1 self-end z-10 min-w-0")}
              >
                <PermissionDialog sessionId={sessionId} />
              </div>
              <div
                className={cn(
                  "relative min-w-0",
                  hasPendingRequest && "col-start-1 row-start-1 self-end pointer-events-none z-0",
                )}
              >
                <MessageInput
                  ref={composerRef}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  streaming={isProcessing}
                  disabled={hasPendingRequest}
                  cwd={cwd}
                  dockAttached={hasPendingRequest}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 pt-1.5 pb-2.5">
              <ConversationBranchSwitcher
                cwd={cwd}
                disabled={status === "streaming" || status === "submitted"}
              />
              null /* cloud-gated */
              <div className="flex-1" />
              <ContextLeft sessionId={sessionId} />
            </div>
          </div>
        </div>
        {/* Pinned summary panel */}
        <SummaryPinnedPanel />
      </div>
    </SummaryPanelProvider>
  );
}
