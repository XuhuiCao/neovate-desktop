import { z } from "zod";

/** main→renderer reveal-command IPC channel (domain:action naming). */
export const REVEAL_PANEL_CHANNEL = "panel:reveal";

/**
 * Input schema for `reveal_content_panel` — the single contract shared by the
 * MCP tool and the UI. Required fields (e.g. `url`) are guaranteed here, so the
 * UI can consume them deterministically (e.g. a non-fallback `keyOf`).
 *
 * The MCP layer only validates against this schema and passes the parsed value
 * THROUGH to the renderer unchanged; all consumption (kind → view mapping, view
 * state, tab title) happens in the UI layer. So this validated input is also the
 * IPC payload — adding a panel = add a `kind` variant here + handle it in the UI.
 *
 * `kind` is agent-friendly and does NOT leak the internal viewType
 * (`generic-iframe`) or the HTML carrier (`iframe`).
 */
export const RevealPanelInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("panel"),
      url: z.string().url().describe("The URL of the page to embed"),
      title: z.string().describe("Tab title shown for the panel"),
    })
    .describe("Embed a web page or app as a panel inside Neo, or focus it if already open"),
]);
export type RevealPanelInput = z.infer<typeof RevealPanelInput>;
