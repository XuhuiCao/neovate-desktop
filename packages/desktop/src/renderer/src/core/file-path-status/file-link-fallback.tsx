import type { ReactNode } from "react";

function plainTextLabel(children: ReactNode): string | null {
  if (typeof children === "string" || typeof children === "number") return String(children);
  return null;
}

/** Non-clickable local-link fallback that keeps the authored destination visible. */
export function FileLinkFallback({
  children,
  className,
  displayTarget,
  title,
}: {
  children: ReactNode;
  className?: string;
  displayTarget?: string;
  title?: string;
}) {
  const showTarget = !!displayTarget && plainTextLabel(children) !== displayTarget;

  return (
    <span className={className} title={title}>
      {children}
      {showTarget && (
        <>
          {children == null ? null : " "}
          <code
            className="break-all rounded-sm bg-muted/60 px-1 py-0.5 font-mono text-[0.875em] text-muted-foreground"
            data-md="file-link-target"
          >
            {displayTarget}
          </code>
        </>
      )}
    </span>
  );
}
