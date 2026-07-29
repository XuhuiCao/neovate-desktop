import { toastManager } from "@neo/ui/components/toast";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension, useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import debug from "debug";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PermissionMode } from "../../../../../shared/features/agent/types";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_MB,
} from "../../../../../shared/features/chat/attachments/contract";
import { useEventCallback } from "../../../hooks/use-event-callback";
import { useLatestRef } from "../../../hooks/use-latest-ref";
import { cn } from "../../../lib/utils";
import { client } from "../../../orpc";
import { useConfigStore } from "../../config/store";
import { useSettingsStore } from "../../settings";
import { claudeCodeChatManager } from "../chat-manager";
import { useNewSession } from "../hooks/use-new-session";
import { useSessionMeta } from "../hooks/use-session-meta";
import { useAgentStore } from "../store";
import { extractText } from "../utils/extract-text";
import { buildInsertChatContent, type InsertChatDetail } from "../utils/insert-chat";
import { createAttachmentMentionExtension } from "./attachment-mention-extension";
import { GradientBorderWrapper } from "./gradient-border-wrapper";
import { createImagePasteExtension } from "./image-paste-extension";
import { InputToolbar } from "./input-toolbar";
import { createMentionExtension } from "./mention-extension";
import { QueryStatus } from "./query-status";
import { createSlashCommandsExtension } from "./slash-commands-extension";

const log = debug("neovate:message-input");

type Props = {
  // Attachments now ride inside `message` as `@<absolutePath>` references
  // (attachmentMention tiptap node serialized by extract-text). The composer
  // persists each pasted image to disk via `client.chat.attachments.save`
  // before inserting the chip, so onSend no longer carries base64.
  onSend: (message: string) => void;
  onCancel: () => void;
  streaming: boolean;
  disabled?: boolean;
  sessionInitializing?: boolean;
  sessionInitError?: string | null;
  onRetry?: () => void;
  cwd: string;
  dockAttached?: boolean;
  /** Show project selector in toolbar (popup window mode) */
  showProjectSelector?: boolean;
};

const NEW_CHAT_EASTER_EGGS = new Set(["exit", "quit", ":q", ":q!", ":wq", ":wq!"]);

type SessionDraft = {
  content: JSONContent;
};

const sessionDrafts = new Map<string, SessionDraft>();

export function MessageInput({
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
}: Props) {
  const { t } = useTranslation();
  const cwdRef = useLatestRef(cwd);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorJsonRef = useRef<JSONContent | null>(null);
  const { createNewSession } = useNewSession();

  const activeSessionId = useAgentStore((s) => s.activeSessionId);

  // Subscribe to prompt suggestion from the per-session chat store.
  // Uses useState+useEffect instead of useStore to avoid conditional hook calls
  // (chatStore may be undefined when no session is active).
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null);
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

  // Attach-time save: persist each image to disk via the attachments service,
  // then insert an inline attachmentMention chip (serializes to `@<absolutePath>`
  // in extract-text). The composer therefore sends text only — no base64 rides
  // through onSend; the chip previews it via the neovate-file:// protocol.
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

  const sendMessageWith = useConfigStore((s) => s.sendMessageWith);
  const sendMessageWithRef = useLatestRef(sendMessageWith);

  const mentionExtension = useMemo(() => createMentionExtension(() => cwdRef.current), []);

  const slashCommandsExtension = useMemo(
    () =>
      createSlashCommandsExtension(() => {
        const { activeSessionId, sessions } = useAgentStore.getState();
        if (!activeSessionId) return [];
        return sessions.get(activeSessionId)?.availableCommands ?? [];
      }),
    [],
  );

  const attachmentMentionExtension = useMemo(() => createAttachmentMentionExtension(), []);

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
      }),
      Placeholder.configure({
        placeholder: () => {
          const suggestion = promptSuggestionRef.current;
          if (suggestion) return suggestion + "    Tab to fill · Enter to send";
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
                      createNewSession(cwdRef.current);
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
                        createNewSession(cwdRef.current);
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
      transformPastedHTML(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const text = doc.body.innerText || "";
        return text
          .split("\n")
          .map((line) => {
            if (!line) return "<p></p>";
            const escaped = line
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
    content: activeSessionId ? sessionDrafts.get(activeSessionId)?.content : undefined,
    onCreate: ({ editor: e }) => {
      editorJsonRef.current = e.getJSON();
    },
    onUpdate: ({ editor: e }) => {
      editorJsonRef.current = e.getJSON();
    },
  });

  const send = useEventCallback(() => {
    if (!editor || streaming) return;
    const text = extractText(editor.getJSON());
    log("send: text=%s", text.slice(0, 50));
    // Trim guard: whitespace-only content is a no-op. Attachment chips
    // serialize into `text` (as `@<absolutePath>`), so a non-empty text
    // already covers the case where the only content is an image chip.
    if (!text) return;
    onSend(text);
    editor.commands.clearContent();
    if (activeSessionId) sessionDrafts.delete(activeSessionId);
  });

  // Keep editable in sync with props
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Save draft on unmount so it persists across session switches
  useEffect(() => {
    return () => {
      if (!activeSessionId) return;
      const json = editorJsonRef.current;
      if (!json) return;
      if (extractText(json).trim()) {
        sessionDrafts.set(activeSessionId, { content: json });
      } else {
        sessionDrafts.delete(activeSessionId);
      }
    };
  }, [activeSessionId]);

  // Restore draft when session switches without remount (e.g., between new sessions in welcome panel)
  const prevSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    if (prevSessionIdRef.current === activeSessionId) return;
    prevSessionIdRef.current = activeSessionId;
    if (!editor || editor.isDestroyed) return;
    const draft = activeSessionId ? sessionDrafts.get(activeSessionId) : undefined;
    if (draft) {
      editor.commands.setContent(draft.content);
    } else {
      editor.commands.clearContent();
    }
  }, [editor, activeSessionId]);

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

  // Close suggestion popups when settings opens
  const showSettings = useSettingsStore((s) => s.showSettings);
  useEffect(() => {
    if (showSettings) {
      document.querySelectorAll("[data-suggestion-popup]").forEach((el) => el.remove());
    }
  }, [showSettings]);

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
        "insert-chat received textLen=%d mentions=%d",
        detail.text?.length ?? 0,
        detail.mentions?.length ?? 0,
      );
      if (content.length === 0) return;
      editor.chain().focus().insertContent(content).run();
    };
    window.addEventListener("neovate:insert-chat", handler);
    return () => window.removeEventListener("neovate:insert-chat", handler);
  }, [editor]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      log("handleFileSelect: files=%d", files?.length ?? 0);
      if (!files || files.length === 0) return;
      // @ref attachments are image-only (aligns with internal composer and
      // the `type: "image"` attachments service contract).
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      log("handleFileSelect: imageFiles=%d", imageFiles.length);
      if (imageFiles.length === 0) return;
      handleAttachFiles(imageFiles);
      e.target.value = "";
    },
    [handleAttachFiles],
  );
  return (
    <div className={cn("px-4 pt-4 pb-1 max-w-3xl mx-auto w-full", dockAttached ? "pb-1 pt-0" : "")}>
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
          "focus-within:!border-primary/50",
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
        <div data-has-suggestion={promptSuggestion ? "" : undefined}>
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
          showProjectSelector={showProjectSelector}
        />
      </GradientBorderWrapper>
    </div>
  );
}
