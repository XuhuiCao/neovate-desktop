import type { ComponentProps } from "react";
import type { Components, ExtraProps } from "streamdown";

import { toastManager } from "@neo/ui/components/toast";
import debug from "debug";
import { useCallback, useMemo } from "react";

import { markdownBaseComponents } from "../../../components/ai-elements/markdown-base-components";
import { useRendererApp } from "../../../core/app";
import { FileLinkFallback } from "../../../core/file-path-status/file-link-fallback";
import { markFilePathUnavailable } from "../../../core/file-path-status/file-path-query-state";
import { statFileNow } from "../../../core/file-path-status/file-stat-client";
import { openVerifiedFilePath } from "../../../core/file-path-status/open-verified-file";
import { useFilePathStatus } from "../../../core/file-path-status/use-file-path-status";
import {
  createMessageMarkdownRehypePlugins,
  MESSAGE_INLINE_FILE_TAG,
  MESSAGE_LOCAL_FILE_LINK_TAG,
  type RehypePlugins,
} from "../../../lib/markdown";
import { cn } from "../../../lib/utils";
import { openGenericIframeUrl } from "../../../plugins/generic-iframe/neo-iframe-url";
import { ImageOverlay } from "../components/image-overlay";
import { useMarkdownRenderContext } from "../components/markdown-render-context";

const log = debug("neovate:markdown-components");

type MessageInlineFileProps = ComponentProps<"code"> & ExtraProps & { path?: string };
type LinkProps = ComponentProps<"a"> & ExtraProps;
type MessageLocalFileLinkProps = LinkProps & { displayTarget?: string; path?: string };

function FilePathButton({
  path,
  label,
  className,
  onOpen,
}: {
  path: string;
  label: string;
  className?: string;
  onOpen: (resolved: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`打开 ${path}`}
      className={cn(
        "inline cursor-pointer appearance-none whitespace-normal break-all bg-transparent p-0 text-left text-primary underline-offset-2 transition-colors hover:underline",
        className,
      )}
      data-md="filepath"
      data-filepath={path}
      onClick={() => onOpen(path)}
    >
      {label}
    </button>
  );
}

function LegacyMarkdownInlineFile({
  children,
  className,
  node,
  path,
  onOpen,
  ...props
}: MessageInlineFileProps & { onOpen: (resolved: string) => void }) {
  const absolutePath = typeof path === "string" && path.startsWith("/") ? path : null;
  const { ref, isFile } = useFilePathStatus(absolutePath);
  const FallbackCode = markdownBaseComponents.code;
  const text = typeof children === "string" ? children : null;

  const fallback =
    FallbackCode && typeof FallbackCode !== "string" ? (
      <FallbackCode className={className} node={node} {...props}>
        {children}
      </FallbackCode>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );

  if (absolutePath === null || text === null) return fallback;

  return (
    <span ref={ref} className="inline">
      {isFile ? (
        <FilePathButton path={absolutePath} label={text} className={className} onOpen={onOpen} />
      ) : (
        fallback
      )}
    </span>
  );
}

function LegacyMarkdownLink({
  className,
  children,
  href,
  node: _,
  onOpenExternal,
  ...props
}: LinkProps & { onOpenExternal: (href: string) => void }) {
  return (
    <a
      className={cn("text-primary transition-colors underline-offset-2 hover:underline", className)}
      href={href}
      {...props}
      onClick={(event) => {
        if (!href) return;
        event.preventDefault();
        onOpenExternal(href);
      }}
    >
      {children}
    </a>
  );
}

function LegacyMarkdownLocalFileLink({
  className,
  children,
  displayTarget,
  path,
  title,
  onOpenFile,
}: MessageLocalFileLinkProps & { onOpenFile: (path: string) => Promise<void> }) {
  const absolutePath = typeof path === "string" && path.startsWith("/") ? path : null;
  const { ref, isFile } = useFilePathStatus(absolutePath);

  return (
    <span ref={ref} className="inline">
      {absolutePath && isFile ? (
        <a
          className={cn(
            "text-primary transition-colors underline-offset-2 hover:underline",
            className,
          )}
          href="#"
          title={title ?? displayTarget}
          onClick={(event) => {
            event.preventDefault();
            void onOpenFile(absolutePath);
          }}
        >
          {children}
        </a>
      ) : (
        <FileLinkFallback className={className} displayTarget={displayTarget} title={title}>
          {children}
        </FileLinkFallback>
      )}
    </span>
  );
}

type MarkdownImageWithOverlayProps = ComponentProps<"img"> & ExtraProps;

function MarkdownImageWithOverlay({
  className,
  alt,
  src,
  node: _,
  ...props
}: MarkdownImageWithOverlayProps) {
  if (!src) {
    return <img alt={alt} src={src} className={className} {...props} />;
  }

  return (
    <ImageOverlay src={src} alt={alt ?? undefined}>
      <img
        alt={alt}
        src={src}
        className={cn(
          "my-3 max-w-full rounded-md first:mt-0 last:mb-0 cursor-zoom-in transition-opacity hover:opacity-90",
          className,
        )}
        loading="lazy"
        {...props}
      />
    </ImageOverlay>
  );
}

/** Build the cwd-aware, message-only synchronous Markdown pipeline. */
export function useMessageMarkdownPipeline(options?: { cwd?: string }): {
  processorKey: string;
  rehypePlugins: RehypePlugins;
} {
  const context = useMarkdownRenderContext();
  const cwd = options?.cwd ?? context?.cwd;
  const homedir = window.api.homedir;

  return useMemo(
    () => ({
      processorKey: JSON.stringify([cwd, homedir]),
      rehypePlugins: createMessageMarkdownRehypePlugins({ cwd, homedir }),
    }),
    [cwd, homedir],
  );
}

/** Build the component map used only by agent-message Markdown. */
export function useMarkdownComponents(): Components {
  const app = useRendererApp();
  const openFilePath = useCallback(
    async (path: string) => {
      const verified = await openVerifiedFilePath(path, {
        statNow: statFileNow,
        openPath: (value) => app.opener.open(value),
        onOpenFailed: (value) => {
          toastManager.add({
            type: "warning",
            title: "无法打开文件",
            description: `没有应用可以打开 ${value}。`,
          });
        },
      });
      if (!verified) markFilePathUnavailable(path);
    },
    [app.opener],
  );

  const openExternalLink = useCallback(
    (href: string) => {
      if (openGenericIframeUrl(app, href)) return;

      void app.opener
        .open(href)
        .then((handled) => {
          if (!handled) window.open(href);
        })
        .catch((error) => {
          log("failed to open markdown link: %O", error);
          window.open(href);
        });
    },
    [app],
  );

  return useMemo(
    () => ({
      ...markdownBaseComponents,
      img: MarkdownImageWithOverlay,
      a: (props: LinkProps) => <LegacyMarkdownLink {...props} onOpenExternal={openExternalLink} />,
      [MESSAGE_INLINE_FILE_TAG]: (props: MessageInlineFileProps) => (
        <LegacyMarkdownInlineFile {...props} onOpen={openFilePath} />
      ),
      [MESSAGE_LOCAL_FILE_LINK_TAG]: (props: MessageLocalFileLinkProps) => (
        <LegacyMarkdownLocalFileLink {...props} onOpenFile={openFilePath} />
      ),
    }),
    [openExternalLink, openFilePath],
  );
}
