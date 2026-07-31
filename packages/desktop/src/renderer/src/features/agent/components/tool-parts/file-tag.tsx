import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { useCallback } from "react";

import { useRendererApp } from "../../../../core/app";

export function FileTag({ filePath }: { filePath: string }) {
  const app = useRendererApp();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      app.opener.open(filePath);
    },
    [app, filePath],
  );

  const fileName = filePath.split("/").pop();
  if (!fileName) return null;

  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="shrink-0 max-w-48 truncate cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={handleClick}
            >
              {fileName}
            </span>
          }
        />
        <TooltipPopup>{filePath}</TooltipPopup>
      </Tooltip>
    </TooltipProvider>
  );
}
