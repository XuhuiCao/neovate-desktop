import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { useState } from "react";
import { Controlled as ControlledZoom } from "react-medium-image-zoom";

import { buildNeoFileSchemeUrl } from "../../../../../shared/features/file/protocol";
import { TOOLTIP_HOVER_INTENT_DELAY } from "../../../lib/tooltip";

// Shared inline tag for a saved image attachment, used by the composer node view
// and the sent user message. Shows a thumbnail + filename: hovering reveals a
// larger preview (Tooltip), clicking anywhere on the tag opens a fullscreen zoom
// (react-medium-image-zoom). The zoom is driven in controlled mode so the whole
// tag — not just the thumbnail — is the click target; the thumbnail is the
// animation origin the library zooms from. Images load over the neo-file://
// protocol, which the browser fetches and caches natively, so the visible
// thumbnail also warms the cache for the hover preview and the zoom.
export function AttachmentChip({ absolutePath, name }: { absolutePath: string; name: string }) {
  const url = buildNeoFileSchemeUrl(absolutePath);
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <TooltipProvider delay={TOOLTIP_HOVER_INTENT_DELAY}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="attachment-mention inline-flex cursor-zoom-in items-center gap-1 rounded bg-muted px-1 align-baseline"
              onClick={() => setIsZoomed(true)}
            >
              <ControlledZoom
                isZoomed={isZoomed}
                onZoomChange={(value) => setIsZoomed(value)}
                wrapElement="span"
              >
                <img src={url} alt={name} className="h-4 w-4 rounded object-cover" />
              </ControlledZoom>
              <span>{name}</span>
            </span>
          }
        />
        <TooltipPopup>
          <img src={url} alt={name} className="max-h-96 max-w-lg rounded object-contain" />
        </TooltipPopup>
      </Tooltip>
    </TooltipProvider>
  );
}
