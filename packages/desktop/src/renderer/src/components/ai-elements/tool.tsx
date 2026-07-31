"use client";

import type { DynamicToolUIPart, ToolUIPart, UITool, UIToolInvocation } from "ai";
import type { LucideProps } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@neo/ui/components/collapsible";
import { ChevronDownIcon, CircleXIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, isValidElement, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils";
import { CodeBlock } from "./code-block";

// --- Context ---

export type ToolPart = ToolUIPart | DynamicToolUIPart;

interface ToolContextValue {
  state: ToolPart["state"];
  errorText?: string;
  collapsible: boolean;
}

const ToolContext = createContext<ToolContextValue | null>(null);

export const useToolContext = () => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error("Tool components must be used within Tool");
  }
  return context;
};

// --- Tool (root) ---

export type ToolProps = ComponentProps<typeof Collapsible> & {
  invocation: UIToolInvocation<UITool>;
  collapsible?: boolean;
};

export const Tool = ({
  invocation,
  className,
  children,
  collapsible = true,
  ...props
}: ToolProps) => {
  const contextValue = useMemo(
    () => ({ state: invocation.state, errorText: invocation.errorText, collapsible }),
    [invocation.state, invocation.errorText, collapsible],
  );
  const rootClassName = cn("not-prose w-full overflow-hidden", className);
  return (
    <ToolContext.Provider value={contextValue}>
      {collapsible ? (
        <Collapsible className={rootClassName} {...props}>
          {children}
        </Collapsible>
      ) : (
        <div className={rootClassName}>{children}</div>
      )}
    </ToolContext.Provider>
  );
};

// --- ToolHeader ---

export type ToolHeaderProps = {
  children: ReactNode;
  className?: string;
};

export const ToolHeader = ({ children, className }: ToolHeaderProps) => {
  const { state, errorText, collapsible } = useToolContext();

  const sharedClassName = cn(
    "group/tool-header inline-flex gap-2 w-full max-w-full items-center text-sm text-muted-foreground",
    state === "output-error" ? "text-destructive" : "text-foreground",
    className,
  );

  const errorBadge =
    state === "output-error" && errorText ? (
      <span className="shrink-0 max-w-xs truncate rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive transition-opacity duration-150 group-data-[panel-open]/tool-header:opacity-0">
        {errorText}
      </span>
    ) : null;

  if (!collapsible) {
    return (
      <div className={sharedClassName}>
        {children}
        {errorBadge}
      </div>
    );
  }

  return (
    <CollapsibleTrigger className={cn(sharedClassName, "cursor-pointer")}>
      {children}
      {errorBadge}
    </CollapsibleTrigger>
  );
};

// --- ToolHeaderTitle ---

export type ToolHeaderTitleProps = ComponentProps<"span">;

export const ToolHeaderTitle = ({ className, children, ...props }: ToolHeaderTitleProps) => {
  return (
    <span className={cn("min-w-0 truncate", className)} data-slot="tool-header-title" {...props}>
      {children}
    </span>
  );
};

// --- ToolHeaderIcon ---

export type ToolHeaderIconProps = {
  icon: React.FC<LucideProps>;
};

export const ToolHeaderIcon = ({ icon: Icon }: ToolHeaderIconProps) => {
  const { state, collapsible } = useToolContext();
  const isError = state === "output-error";
  const iconColor = isError ? "text-destructive" : "text-muted-foreground";
  const DisplayIcon = isError ? CircleXIcon : Icon;

  if (!collapsible) {
    return <DisplayIcon className={cn("size-3 shrink-0", iconColor)} />;
  }

  return (
    <div className="relative flex size-3 shrink-0 items-center justify-center">
      <DisplayIcon
        className={cn(
          "absolute size-3 transition-opacity duration-150 group-hover/tool-header:opacity-0",
          iconColor,
        )}
      />
      <ChevronDownIcon className="absolute size-3 -rotate-90 text-muted-foreground opacity-0 transition-all duration-150 group-hover/tool-header:opacity-100 group-data-[panel-open]/tool-header:rotate-0" />
    </div>
  );
};

// --- ToolContent ---

export type ToolContentProps = ComponentProps<"div">;

export const ToolContent = ({ className, children }: ToolContentProps) => {
  const { t } = useTranslation();
  const { state, errorText } = useToolContext();
  return (
    <CollapsiblePanel
      keepMounted
      render={(_panelProps, panelState) => (
        <AnimatePresence initial={false}>
          {panelState.open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { type: "spring", stiffness: 500, damping: 30, mass: 0.8 },
                opacity: { duration: 0.12 },
              }}
              className="mt-1 overflow-hidden"
            >
              {state === "output-error" ? (
                <div className="overflow-hidden rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {errorText || t("error.somethingWentWrong")}
                </div>
              ) : (
                <div
                  className={cn(
                    "space-y-2 overflow-hidden rounded-lg p-3 bg-muted/50 text-popover-foreground [--code-block-content-visibility:visible]",
                    className,
                  )}
                >
                  {children}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    />
  );
};

// --- ToolInput / ToolOutput (kept for backwards compatibility) ---

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const { t } = useTranslation();
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <span className="text-xs font-medium text-muted-foreground">{t("ai.tool.input")}</span>
      <div className="rounded-md bg-muted/30 overflow-hidden">
        <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText?: ToolPart["errorText"];
};

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  const { t } = useTranslation();
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as React.ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <span className="text-xs font-medium text-muted-foreground">
        {errorText ? t("ai.tool.error") : t("ai.tool.output")}
      </span>
      <div
        className={cn(
          "rounded-md overflow-hidden",
          errorText ? "bg-destructive/10 text-destructive" : "bg-muted/30",
        )}
      >
        {errorText && <div className="p-3 text-sm">{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
