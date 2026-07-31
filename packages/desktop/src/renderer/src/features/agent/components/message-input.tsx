import { toastManager } from "@neo/ui/components/toast";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension, useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import debug from "debug";
import { AnimatePresence, motion } from "motion/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { ReactGrabCommentPayload } from "../../../../../shared/claude-code/types";
import type { ImageAttachment, PermissionMode } from "../../../../../shared/features/agent/types";
import type { DevMode } from "../draft-store";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_MB,
} from "../../../../../shared/features/chat/attachments/contract";
import { useLayoutStore } from "../../../components/app-layout/store";
import { useEventCallback } from "../../../hooks/use-event-callback";
import { useLatestRef } from "../../../hooks/use-latest-ref";
import { cn } from "../../../lib/utils";
import { client } from "../../../orpc";
import { useCommandPaletteStore } from "../../command-palette/store";
import { useConfigStore } from "../../config/store";
import { useSettingsStore } from "../../settings";
import { useCreateWorktreeSession } from "../../worktree/hooks/use-create-session";
import { claudeCodeChatManager } from "../chat-manager";
import { draftAgentStore, useDraftAgentStore } from "../draft-store";
import { useProjectCapabilities } from "../hooks/use-project-capabilities";
import { useSessionMeta } from "../hooks/use-session-meta";
import { navigateToDraft } from "../navigation";
import { useAgentStore } from "../store";
import { useDraftContentSync } from "../use-draft-content-sync";
import { extractText } from "../utils/extract-text";
import { buildInsertChatContent, type InsertChatDetail } from "../utils/insert-chat";
import {
  appendReactGrabCommentsToText,
  removeReactGrabComment,
  updateReactGrabCommentText,
  upsertReactGrabComment,
} from "../utils/react-grab-comments";
import { createAttachmentMentionExtension } from "./attachment-mention-extension";
import { GradientBorderWrapper } from "./gradient-border-wrapper";
import { createImagePasteExtension } from "./image-paste-extension";
import { InputToolbar } from "./input-toolbar";
import { createMentionExtension } from "./mention-extension";
import { QueryStatus } from "./query-status";
import { ReactGrabCommentAttachment } from "./react-grab-comment-attachment";
import { createSlashCommandsExtension } from "./slash-commands-extension";

const log = debug("neovate:message-input");

type Props = {
  onSend: (
    message: string,
    attachments?: ImageAttachment[],
    reactGrabComments?: ReactGrabCommentPayload | null,
  ) => void | Promise<void>;
  onCancel: () => void;
  /** `true` whenever the active session is processing (status ===
   *  "streaming" || status === "submitted"). When true, the composer
   *  enqueues submits locally instead of sending. */
  streaming: boolean;
  disabled?: boolean;
  sessionInitializing?: boolean;
  sessionInitError?: string | null;
  onRetry?: () => void;
  cwd: string;
  dockAttached?: boolean;
  /** Show project selector in toolbar (popup window mode) */
  showProjectSelector?: boolean;
  /** Compact mode for popup window with tighter spacing */
  compactMode?: boolean;
  draftProjectPath?: string;
};

/** Imperative handle exposed via `forwardRef`. The agent-chat view
 *  uses `seed()` to pre-fill the composer when the user clicks a
 *  queued message bubble. See
 *  docs/designs/2026-05-18-agent-queued-messages.md §6.4. */
export type MessageInputHandle = {
  seed: (input: {
    content: JSONContent;
    attachments: ImageAttachment[];
    reactGrabComments?: ReactGrabCommentPayload | null;
  }) => void;
};

const NEW_CHAT_EASTER_EGGS = new Set(["exit", "quit", ":q", ":q!", ":wq", ":wq!"]);

export const MessageInput = forwardRef<MessageInputHandle, Props>(function MessageInput(
  {
    onSend,
    onCancel,
    streaming,
    disabled,
    sessionInitializing,
    sessionInitError,
    onRetry,
    cwd,
    dockAttached = false,
    showProjectSelector = false,
    compactMode = false,
  },
  ref,
) {
  const { t, i18n } = useTranslation();
  const cwdRef = useLatestRef(cwd);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createSession: createWorktreeSession } = useCreateWorktreeSession();

  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const draftProjectPath = useDraftAgentStore((s) => s.activeDraftProjectPath);
  // Subscribe only to devMode, not the whole draft: content is written to the
  // store on every keystroke (useDraftContentSync), and a whole-draft selector
  // would re-render the composer each time. The draft path the composer
  // persists to, or null for an active-session composer.
  const draftSavePath = activeSessionId ? null : draftProjectPath;
  const devMode: DevMode = useDraftAgentStore((s) => {
    const path = s.activeDraftProjectPath;
    return (path ? s.drafts[path]?.devMode : undefined) ?? "free";
  });

  // Subscribe to prompt suggestion from the per-session chat store.
  // Uses useState+useEffect instead of useStore to avoid conditional hook calls
  // (chatStore may be undefined when no session is active).
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null);
  // Track when editor only has slashCommand (for custom overlay placeholder)
  const [hasOnlySlashCommand, setHasOnlySlashCommand] = useState(false);
  const sessionReactGrabComments = useAgentStore((s) =>
    activeSessionId ? (s.sessions.get(activeSessionId)?.pendingReactGrabComments ?? null) : null,
  );
  const draftReactGrabComments = useDraftAgentStore((s) =>
    draftSavePath ? (s.drafts[draftSavePath]?.pendingReactGrabComments ?? null) : null,
  );
  const reactGrabComments = activeSessionId ? sessionReactGrabComments : draftReactGrabComments;
  const setReactGrabComments = useEventCallback(
    (
      next:
        | ReactGrabCommentPayload
        | null
        | ((current: ReactGrabCommentPayload | null) => ReactGrabCommentPayload | null),
    ) => {
      const sessionId = useAgentStore.getState().activeSessionId;
      if (sessionId) {
        const current =
          useAgentStore.getState().sessions.get(sessionId)?.pendingReactGrabComments ?? null;
        const resolved = typeof next === "function" ? next(current) : next;
        useAgentStore.getState().setPendingReactGrabComments(sessionId, resolved);
        return;
      }

      const draftPath = draftAgentStore.getState().activeDraftProjectPath;
      if (!draftPath) return;
      const current =
        draftAgentStore.getState().drafts[draftPath]?.pendingReactGrabComments ?? null;
      const resolved = typeof next === "function" ? next(current) : next;
      draftAgentStore.getState().updateDraft(draftPath, {
        pendingReactGrabComments: resolved,
      });
    },
  );
  useEffect(() => {
    const store = activeSessionId
      ? claudeCodeChatManager.getChat(activeSessionId)?.store
      : undefined;
    if (!store) {
      setPromptSuggestion(null);
      return;
    }
    setPromptSuggestion(store.getState().promptSuggestion);
    return store.subscribe((state) => {
      setPromptSuggestion(state.promptSuggestion);
    });
  }, [activeSessionId]);
  const promptSuggestionRef = useLatestRef(promptSuggestion);

  const clearSuggestion = useEventCallback(() => {
    if (!activeSessionId) return;
    claudeCodeChatManager.getChat(activeSessionId)?.store.setState({ promptSuggestion: null });
  });

  useEffect(() => {
    if (!cwd) {
      setReactGrabComments(null);
      return;
    }
    const unsubscribe = (window as any).neodebugApi?.onReactGrabAnnotationCreated?.((payload) => {
      if (payload.projectRoot !== cwd) {
        return;
      }
      setReactGrabComments((current) => upsertReactGrabComment(current, payload.annotation));
    });
    return () => {
      unsubscribe?.();
    };
  }, [cwd]);

  const clearPendingReactGrabAnnotationsAfterUse = useEventCallback(() => {
    if (!reactGrabComments) return;
    setReactGrabComments(null);
  });

  const meta = useSessionMeta(activeSessionId);
  const permissionMode = meta?.permissionMode ?? "default";
  const setPermissionMode = useAgentStore((s) => s.setPermissionMode);

  const togglePlanMode = useEventCallback(() => {
    if (!activeSessionId) return;
    const current =
      useAgentStore.getState().sessions.get(activeSessionId)?.permissionMode ?? "default";
    const configDefault = useConfigStore.getState().permissionMode as PermissionMode;
    const next: PermissionMode = current === "plan" ? configDefault : "plan";
    log("togglePlanMode: %s -> %s (configDefault=%s)", current, next, configDefault);
    setPermissionMode(activeSessionId, next);
    claudeCodeChatManager.getChat(activeSessionId)?.dispatch({
      kind: "configure",
      configure: { type: "set_permission_mode", mode: next },
    });
  });

  const sendMessageWith = useConfigStore((s) => s.sendMessageWith);
  const sendMessageWithRef = useLatestRef(sendMessageWith);
  const devModeRef = useLatestRef(devMode);

  const { data: capabilities } = useProjectCapabilities(cwd);
  const commandsRef = useLatestRef(capabilities?.commands ?? []);

  const mentionExtension = useMemo(() => createMentionExtension(() => cwdRef.current), []);

  const slashCommandsExtension = useMemo(
    () =>
      createSlashCommandsExtension(
        () => commandsRef.current,
        () => cwdRef.current,
      ),
    [],
  );

  const attachmentMentionExtension = useMemo(() => createAttachmentMentionExtension(), []);

  // Attach-time save: persist each image to disk via the attachments service,
  // then insert an inline attachmentMention chip (serializes to `@<absolutePath>`
  // in extract-text). The composer therefore sends text only — no base64 rides
  // through onSend; the chip previews it via the neo-file:// protocol.
  const handleAttachFiles = useEventCallback(async (files: File[]) => {
    const cwd = cwdRef.current;
    if (!cwd || !editor) return;
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toastManager.add({
          type: "error",
          title: t("attachments.tooLarge.error"),
          description: t("attachments.tooLarge.errorDescription", {
            name: file.name || "image",
            limit: MAX_ATTACHMENT_MB,
          }),
          timeout: 4000,
        });
        continue;
      }
      try {
        const mediaType = file.type || "image/png";
        const result = await client.chat.attachments.save({
          cwd,
          type: "image",
          name: file.name || undefined,
          mediaType,
          file,
        });
        editor
          .chain()
          .focus()
          .insertContent([
            {
              type: "attachmentMention",
              attrs: { absolutePath: result.absolutePath, name: result.name, mediaType },
            },
            { type: "text", text: " " },
          ])
          .run();
      } catch (error) {
        log("save image attachment failed: %O", error);
        toastManager.add({
          type: "error",
          title: t("attachments.save.error"),
          description: t("attachments.save.errorDescription"),
          timeout: 4000,
        });
      }
    }
  });

  const imagePasteExtension = useMemo(
    () => createImagePasteExtension(handleAttachFiles),
    [handleAttachFiles],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        bold: false,
        italic: false,
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder: () => {
          const suggestion = promptSuggestionRef.current;
          if (suggestion) return suggestion + "    " + t("chat.placeholder.suggestionHint");
          const mode = devModeRef.current;
          if (mode === "standard") return t("chat.placeholder.standard");
          if (mode === "free") return t("chat.placeholder.free");
          return t("chat.placeholder");
        },
      }),
      mentionExtension,
      slashCommandsExtension,
      attachmentMentionExtension,
      imagePasteExtension,
      Extension.create({
        name: "chatKeymap",
        addProseMirrorPlugins() {
          const editor = this.editor;
          return [
            new Plugin({
              key: new PluginKey("chatKeymap"),
              props: {
                handleKeyDown(_view, event) {
                  const mode = sendMessageWithRef.current;

                  // Tab: accept prompt suggestion (fill editor)
                  if (event.key === "Tab" && !event.shiftKey) {
                    if (document.querySelector("[data-suggestion-popup]")) return false;
                    const suggestion = promptSuggestionRef.current;
                    if (suggestion && editor.isEmpty) {
                      event.preventDefault();
                      editor.commands.setContent(suggestion);
                      clearSuggestion();
                      return true;
                    }
                    return false;
                  }

                  // Bare Enter (no modifier)
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.altKey &&
                    !event.metaKey &&
                    !event.ctrlKey
                  ) {
                    if (document.querySelector("[data-suggestion-popup]")) return false;

                    if (mode === "cmdEnter") {
                      return false;
                    }

                    event.preventDefault();
                    const text = extractText(editor.getJSON()).trim();

                    // Empty input + suggestion → send suggestion directly
                    const suggestion = promptSuggestionRef.current;
                    if (!text && suggestion) {
                      clearSuggestion();
                      onSend(suggestion);
                      toastManager.add({
                        type: "info",
                        title: t("chat.suggestionSent"),
                        timeout: 2000,
                      });
                      return true;
                    }

                    if (NEW_CHAT_EASTER_EGGS.has(text.toLowerCase())) {
                      editor.commands.clearContent();
                      navigateToDraft(cwdRef.current);
                      return true;
                    }
                    send();
                    return true;
                  }
                  // Cmd/Ctrl+Enter
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    if (document.querySelector("[data-suggestion-popup]")) return false;

                    if (mode === "cmdEnter") {
                      event.preventDefault();
                      const text = extractText(editor.getJSON()).trim();

                      // Empty input + suggestion → send suggestion directly
                      const suggestion = promptSuggestionRef.current;
                      if (!text && suggestion) {
                        clearSuggestion();
                        onSend(suggestion);
                        toastManager.add({
                          type: "info",
                          title: t("chat.suggestionSent"),
                          timeout: 2000,
                        });
                        return true;
                      }

                      if (NEW_CHAT_EASTER_EGGS.has(text.toLowerCase())) {
                        editor.commands.clearContent();
                        navigateToDraft(cwdRef.current);
                        return true;
                      }
                      send();
                      return true;
                    }

                    editor.commands.setHardBreak();
                    return true;
                  }
                  if (event.key === "Enter" && event.altKey) {
                    editor.commands.setHardBreak();
                    return true;
                  }
                  if (event.key === "Tab" && event.shiftKey) {
                    event.preventDefault();
                    togglePlanMode();
                    return true;
                  }
                  if (event.key === "Escape") {
                    // Dismiss suggestion first, then blur on next Escape
                    if (promptSuggestionRef.current) {
                      clearSuggestion();
                      return true;
                    }
                    editor.commands.blur();
                    return true;
                  }
                  return false;
                },
              },
            }),
          ];
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[76px] max-h-[240px] overflow-y-auto px-3 py-2 text-sm outline-none bg-card",
      },
      transformPastedHTML(html: string): string {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const parts: string[] = [];

        const blockElements = new Set([
          "p",
          "div",
          "section",
          "article",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "li",
          "tr",
          "blockquote",
          "pre",
        ]);

        const INDENT_SIZE = 2;
        const olCounters: number[] = [];

        function isValidUrl(str: string): boolean {
          try {
            const url = new URL(str);
            const safeProtocols = ["http:", "https:", "ftp:"];
            if (!safeProtocols.includes(url.protocol)) return false;
            // Explicitly block dangerous protocols (case-insensitive)
            if (str.toLowerCase().includes("javascript:")) return false;
            if (str.toLowerCase().includes("data:")) return false;
            if (str.toLowerCase().includes("vbscript:")) return false;
            return true;
          } catch {
            return false;
          }
        }

        function escapeHtml(text: string): string {
          return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        }

        function walk(node: Node, listDepth: number): void {
          if (node.nodeType === Node.TEXT_NODE) {
            parts.push(escapeHtml(node.textContent ?? ""));
            return;
          }

          if (node.nodeType !== Node.ELEMENT_NODE) return;

          const el = node as Element;
          const tag = el.tagName.toLowerCase();

          if (tag === "a") {
            const href = el.getAttribute("href");
            if (href && isValidUrl(href)) {
              parts.push(escapeHtml(href));
            } else {
              parts.push(escapeHtml(el.textContent ?? ""));
            }
            return;
          }

          if (tag === "br") {
            parts.push("\n");
            return;
          }

          if (tag === "ul") {
            olCounters.push(-1);
            for (const child of Array.from(el.childNodes)) {
              walk(child, listDepth + 1);
            }
            olCounters.pop();
            return;
          }

          if (tag === "ol") {
            olCounters.push(1);
            for (const child of Array.from(el.childNodes)) {
              walk(child, listDepth + 1);
            }
            olCounters.pop();
            return;
          }

          if (tag === "li") {
            const indent = "\u00A0".repeat(listDepth * INDENT_SIZE);
            const counter = olCounters[olCounters.length - 1];
            if (counter === undefined || counter === -1) {
              parts.push(`${indent}- `);
            } else {
              parts.push(`${indent}${counter}. `);
              olCounters[olCounters.length - 1] = counter + 1;
            }
            for (const child of Array.from(el.childNodes)) {
              walk(child, listDepth);
            }
            parts.push("\n");
            return;
          }

          for (const child of Array.from(el.childNodes)) {
            walk(child, listDepth);
          }

          if (blockElements.has(tag)) {
            parts.push("\n");
          }
        }

        walk(doc.body, 0);

        return parts
          .join("")
          .split("\n")
          .map((line) => {
            if (!line) return "<p></p>";
            if (line.includes("\u00A0")) {
              return `<p style="white-space: pre-wrap;">${line}</p>`;
            }
            // Decode previously escaped entities first, then re-encode
            // This prevents double-encoding issues and ensures consistent output
            const decoded = line
              .replaceAll("&amp;", "&")
              .replaceAll("&lt;", "<")
              .replaceAll("&gt;", ">");
            const escaped = decoded
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;");
            return `<p>${escaped}</p>`;
          })
          .join("");
      },
    },
    editable: !disabled,
    autofocus: "end",
    content:
      (draftProjectPath
        ? draftAgentStore.getState().drafts[draftProjectPath]?.content
        : undefined) ?? undefined,
    onUpdate: ({ editor: e }) => {
      // Check if content is only slashCommand + optional space (for overlay placeholder)
      const json = e.getJSON();
      const content = json.content ?? [];
      if (content.length === 1 && content[0].type === "paragraph") {
        const paraContent = content[0].content ?? [];
        // Only slashCommand node, or slashCommand + space
        const isOnlySlashCommand =
          (paraContent.length === 1 && paraContent[0].type === "slashCommand") ||
          (paraContent.length === 2 &&
            paraContent[0].type === "slashCommand" &&
            paraContent[1].type === "text" &&
            (paraContent[1] as { text?: string }).text?.trim() === "");
        setHasOnlySlashCommand(isOnlySlashCommand);
      } else {
        setHasOnlySlashCommand(false);
      }
    },
  });

  // Imperative handle for click-to-edit a queued message. Seed-policy:
  // if the editor is empty, replace; otherwise prepend the seeded
  // paragraphs before the current content with a blank paragraph
  // separator (mirrors Helm's "\n\n" rule — never destroys user's
  // in-progress text). Attachment chips ride inside `content`, so the
  // queued message's `attachments` (always empty now) is ignored. See
  // design §6.4.
  useImperativeHandle(
    ref,
    () => ({
      seed: ({ content, reactGrabComments }) => {
        if (!editor) return;
        setReactGrabComments(reactGrabComments ?? null);
        const currentText = extractText(editor.getJSON()).trim();
        if (currentText.length === 0) {
          editor.commands.setContent(content);
        } else {
          const seededParas = content.content ?? [];
          const currentParas = editor.getJSON().content ?? [];
          editor.commands.setContent({
            type: "doc",
            content: [...seededParas, { type: "paragraph" }, ...currentParas],
          });
        }
        editor.commands.focus("end");
      },
    }),
    [editor],
  );

  // Dismiss slash-command popup when switching to cloud mode.
  // Blurring the editor triggers Tiptap Suggestion's onExit, which properly
  // unmounts the React root and removes the portal DOM. Without this, the
  // Suggestion plugin keeps internal "active" state and won't fire onStart
  // again when switching back to local mode.
  const remoteMode = useAgentStore((s) => s.remoteMode);
  useEffect(() => {
    if (!remoteMode || !editor || editor.isDestroyed) return;
    editor.commands.blur();
  }, [editor, remoteMode]);

  const send = useEventCallback(async () => {
    if (!editor) return;
    // Belt-and-suspenders: `disabled` makes the editor non-editable so
    // the keymap can't trigger handleKeyDown, but programmatic call
    // paths (InputToolbar Send button, future code) could still invoke
    // this. Cheap guard.
    if (disabled) return;
    const json = editor.getJSON();
    const text = extractText(json);
    const currentReactGrabComments = reactGrabComments;
    const outgoingText = appendReactGrabCommentsToText(text, currentReactGrabComments);
    log("send: text=%s", text.slice(0, 50));
    // Trim guard: whitespace-only content is a no-op. Attachment chips
    // serialize into `text` (as `@<absolutePath>`), so a non-empty text
    // already covers the case where the only content is an image chip.
    if (text.trim().length === 0 && !currentReactGrabComments) return;

    // Streaming → enqueue locally for the active session and clear the
    // composer. Drained by `drainQueuedHead` on the next terminal-turn
    // transition. See docs/designs/2026-05-18-agent-queued-messages.md.
    if (streaming && activeSessionId) {
      log("send: enqueueing for sessionId=%s (streaming)", activeSessionId.slice(0, 8));
      useAgentStore.getState().enqueueMessage(activeSessionId, {
        content: json,
        attachments: [],
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        reactGrabComments: currentReactGrabComments ?? undefined,
      });
      editor.commands.clearContent();
      clearPendingReactGrabAnnotationsAfterUse();
      // Match the regular-send draft-clear path below so the persisted
      // draft doesn't resurrect on next mount.
      const draftPath = draftAgentStore.getState().activeDraftProjectPath;
      if (draftPath) {
        draftAgentStore.getState().updateDraft(draftPath, {
          content: null,
          attachments: [],
          pendingReactGrabComments: null,
        });
      }
      return;
    }

    // Read draft state directly from store (avoids stale closure in ProseMirror plugins)
    const draftState = draftAgentStore.getState();
    const currentDraft = draftState.activeDraftProjectPath
      ? draftState.drafts[draftState.activeDraftProjectPath]
      : undefined;
    const target = currentDraft?.target ?? null;
    const needsTargetAction = !!target && (target.type === "worktree" || !target.branch.current);

    if (draftState.activeDraftProjectPath && needsTargetAction && target) {
      const newSessionId = await createWorktreeSession({
        target,
        model: currentDraft?.selectedModelId ?? undefined,
        providerId: currentDraft?.selectedProviderId,
      });

      if (!newSessionId) return; // Error already toasted

      // Apply permission override (model/provider already passed to createSession)
      const draftPermission = currentDraft?.permissionMode;
      if (draftPermission) {
        useAgentStore.getState().setPermissionMode(newSessionId, draftPermission);
        claudeCodeChatManager.getChat(newSessionId)?.dispatch({
          kind: "configure",
          configure: { type: "set_permission_mode", mode: draftPermission },
        });
      }

      draftAgentStore.getState().exitDraft();

      log("send: worktree session created, sending to %s", newSessionId);
      useAgentStore.getState().addUserMessage(newSessionId, outgoingText, {
        reactGrabComments: currentReactGrabComments ?? undefined,
      });
      claudeCodeChatManager.getChat(newSessionId)?.sendMessage({
        text: outgoingText,
        metadata: {
          sessionId: newSessionId,
          parentToolUseId: null,
          reactGrabComments: currentReactGrabComments ?? undefined,
        },
      });
    } else {
      onSend(outgoingText, undefined, currentReactGrabComments);
    }

    editor.commands.clearContent();
    clearPendingReactGrabAnnotationsAfterUse();
    // Clear draft for this project after successful send
    if (draftState.activeDraftProjectPath) {
      draftAgentStore.getState().updateDraft(draftState.activeDraftProjectPath, {
        content: null,
        attachments: [],
        target: null,
        permissionMode: null,
        selectedModelId: null,
        selectedProviderId: undefined,
        pendingReactGrabComments: null,
      });
    }
  });

  // Keep editable in sync with props
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Two-way binding: editor content is written to the draft store on every
  // change, so an unsent draft survives navigating to a session and back. Bound
  // to the draft path only — an active-session composer passes null.
  useDraftContentSync(editor, draftSavePath);

  // Restore draft when cwd changes (switching between project drafts).
  // useDraftContentSync handles persisting content on every keystroke, so
  // we only need to restore the new project's draft here. Attachment chips
  // ride inside the stored content, so restoring content restores them.
  const prevCwdRef = useRef(cwd);
  useEffect(() => {
    if (prevCwdRef.current === cwd) return;
    prevCwdRef.current = cwd;
    if (!editor || editor.isDestroyed) return;
    const stored = draftAgentStore.getState().drafts[cwd];
    if (stored?.content) {
      editor.commands.setContent(stored.content);
    } else {
      editor.commands.clearContent();
    }
  }, [editor, cwd]);

  // Deeplink auto-send: when draft has autoSend flag set, trigger send after
  // the editor mounts with the prefilled content.
  useEffect(() => {
    if (!editor || !draftProjectPath) return;
    const draft = draftAgentStore.getState().drafts[draftProjectPath];
    if (!draft?.autoSend || !draft.content) return;

    draftAgentStore.getState().updateDraft(draftProjectPath, { autoSend: false });

    requestAnimationFrame(() => {
      const text = extractText(editor.getJSON()).trim();
      if (!text) return;
      editor.commands.clearContent();
      draftAgentStore.getState().updateDraft(draftProjectPath, {
        content: null,
        attachments: [],
      });
      onSend(text);
    });
  }, [editor, draftProjectPath, onSend]);

  // Force placeholder re-render when suggestion changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta("promptSuggestion", promptSuggestion));
    // Focus input so Tab/Enter work immediately on the suggestion.
    // Guard with document.hasFocus() because MessageInput is used in both
    // the main window and popup window (shared activeSessionId) — without
    // this, both windows would try to steal focus simultaneously.
    if (promptSuggestion && document.hasFocus()) {
      requestAnimationFrame(() => {
        editor.commands.focus("end");
      });
    }
  }, [editor, promptSuggestion]);

  // Force placeholder re-render when language changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta("languageChange", i18n.language));
  }, [editor, i18n.language]);

  // Close suggestion popups when overlay panels open
  const showSettings = useSettingsStore((s) => s.showSettings);
  const fullRightPanelId = useLayoutStore((s) => s.fullRightPanelId);
  const paletteOpen = useCommandPaletteStore((s) => s.isOpen);
  useEffect(() => {
    if (showSettings || fullRightPanelId || paletteOpen) {
      document.querySelectorAll("[data-suggestion-popup]").forEach((el) => el.remove());
    }
  }, [showSettings, fullRightPanelId, paletteOpen]);

  // Focus editor when project is switched
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      editor.commands.focus("end");
    };
    window.addEventListener("neovate:focus-input", handler);
    return () => window.removeEventListener("neovate:focus-input", handler);
  }, [editor]);

  // Listen for insert-chat events from file tree and other entry points
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InsertChatDetail>).detail ?? {};
      const content = buildInsertChatContent(detail);
      log(
        "insert-chat received textLen=%d mentions=%d replace=%s",
        detail.text?.length ?? 0,
        detail.mentions?.length ?? 0,
        detail.replace ?? false,
      );
      if (content.length === 0) return;
      if (detail.replace) {
        editor.chain().focus().clearContent().insertContent(content).run();
      } else {
        editor.chain().focus().insertContent(content).run();
      }
    };
    window.addEventListener("neovate:insert-chat", handler);
    return () => window.removeEventListener("neovate:insert-chat", handler);
  }, [editor]);

  // Listen for dev-mode-change events. The editor is cleared and, for
  // standard mode, the workflow's slash-command node is pre-inserted.
  // `hasOnlySlashCommand` is recomputed by the onUpdate path further up;
  // no manual setter needed here. A previous `setMeta("devModeChange", ...)`
  // call was removed — no extension reads that meta key.
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: DevMode; slashCommand?: string }>).detail;
      log("dev-mode-change received mode=%s slashCommand=%s", detail.mode, detail.slashCommand);
      editor.commands.clearContent();
      if (detail.mode === "standard" && detail.slashCommand) {
        editor
          .chain()
          .focus()
          .insertContent([
            { type: "slashCommand", attrs: { label: detail.slashCommand } },
            { type: "text", text: " " },
          ])
          .run();
      }
    };
    window.addEventListener("neovate:dev-mode-change", handler);
    return () => window.removeEventListener("neovate:dev-mode-change", handler);
  }, [editor]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      log("handleFileSelect: files=%d", files?.length ?? 0);
      if (!files || files.length === 0) return;
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      log("handleFileSelect: imageFiles=%d", imageFiles.length);
      if (imageFiles.length === 0) return;
      handleAttachFiles(imageFiles);
      e.target.value = "";
    },
    [handleAttachFiles],
  );
  return (
    <div
      className={cn(
        "pb-1",
        dockAttached && "px-4",
        !dockAttached && !compactMode && "pt-4 px-4",
        !dockAttached && compactMode && "pt-3 px-3",
      )}
    >
      {activeSessionId && <QueryStatus sessionId={activeSessionId} />}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label={t("chat.attachImages")}
        onChange={handleFileSelect}
      />
      <GradientBorderWrapper
        innerClassName={cn(
          "focus-within:border-primary/50",
          dockAttached ? "rounded-b-lg rounded-t-[18px]" : "rounded-lg",
        )}
      >
        <AnimatePresence>
          {permissionMode === "plan" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 border-b border-info/20 bg-info/5 px-3 py-1 text-xs text-info-foreground",
                  dockAttached ? "rounded-t-[18px]" : "rounded-t-lg",
                )}
              >
                <span className="font-medium">{t("chat.planMode")}</span>
                <span className="text-info-foreground/50">{t("chat.planModeExit")}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {reactGrabComments && (
          <div className="flex px-3 pt-2">
            <ReactGrabCommentAttachment
              payload={reactGrabComments}
              onRemove={() => setReactGrabComments(null)}
              onDeleteComment={(commentId) =>
                setReactGrabComments((current) => removeReactGrabComment(current, commentId))
              }
              onUpdateComment={(commentId, commentText) =>
                setReactGrabComments((current) =>
                  updateReactGrabCommentText(current, commentId, commentText),
                )
              }
            />
          </div>
        )}
        <div
          data-testid="chat-input-editor"
          data-has-suggestion={promptSuggestion ? "" : undefined}
          data-slash-placeholder={hasOnlySlashCommand && devMode === "standard" ? "" : undefined}
          style={
            hasOnlySlashCommand && devMode === "standard"
              ? ({
                  "--slash-placeholder": `"${t("chat.placeholder.afterSlashCommand")}"`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <EditorContent editor={editor} />
        </div>
        <InputToolbar
          streaming={streaming}
          disabled={disabled}
          sessionInitializing={sessionInitializing}
          sessionInitError={sessionInitError}
          onRetry={onRetry}
          onSend={send}
          onCancel={onCancel}
          onAttach={() => fileInputRef.current?.click()}
          activeSessionId={activeSessionId}
          draftProjectPath={draftProjectPath ?? undefined}
          showProjectSelector={showProjectSelector}
          compactMode={compactMode}
        />
      </GradientBorderWrapper>
    </div>
  );
});
