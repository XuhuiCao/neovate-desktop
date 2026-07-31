import type { TFunction } from "i18next";

import { toastManager } from "@neo/ui/components/toast";

export const CFUSE_PROXY_ID = "cfuse";
export const CFUSE_SETUP_DOC_URL = "https://docs.anthropic.com";
import { isTransientSpawnErrorMessage } from "../../../../../shared/spawn-errors";

// A session-create failure may carry structured provider-setup data (attached
// by the main process as ORPCError.data.providerSetup) when the selected
// provider isn't set up — e.g. cfuse not installed / not logged in. We read it
// structurally (duck-typed), mirroring describe-cli-error.ts: the error reaches
// the renderer via @orpc/client deserialisation, so `data` is the field we read
// rather than `instanceof ORPCError`.

type ProviderSetup = { providerId: string; kind: "auth" | "missing"; docURL?: string };

function extractProviderSetup(err: unknown): ProviderSetup | null {
  if (typeof err !== "object" || err === null) return null;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const ps = (data as { providerSetup?: unknown }).providerSetup;
  if (typeof ps !== "object" || ps === null) return null;
  const { providerId, kind, docURL } = ps as Record<string, unknown>;
  if (typeof providerId !== "string") return null;
  if (kind !== "auth" && kind !== "missing") return null;
  return { providerId, kind, docURL: typeof docURL === "string" ? docURL : undefined };
}

/**
 * Returns the message for `setSessionInitError` and whether a guide toast was
 * already shown. Callers that toast for non-setup errors should only toast when
 * `handled` is false, to avoid double-toasting setup errors / dropping others.
 */
export function handleSessionInitError(
  err: unknown,
  t: TFunction,
): { message: string; handled: boolean } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const setup = extractProviderSetup(err);

  // Transient concurrent-spawn failures (the EBADF race) recover on retry. The
  // main process already retried once; if it still reached here, surface a
  // friendly "try again" FRAGMENT instead of the raw `spawn EBADF`. The
  // new-chat inline renderer wraps this in `chat.sessionInitFailedDetail`
  // ("Session failed to start: {{detail}}"), so the value must be a fragment,
  // not a full sentence, to avoid a doubled prefix. Must run BEFORE the
  // `!setup` raw-message return below (a transient error carries no providerSetup).
  if (isTransientSpawnErrorMessage(rawMessage)) {
    return { message: t("chat.sessionInitTransient"), handled: false };
  }

  if (!setup) return { message: rawMessage, handled: false };

  // cfuse is the only provider that throws a setup error today, and its main-side
  // message/hint are English-only (no i18next in main). Re-derive the user-facing
  // copy here from `kind` so both the toast and the inline error (which reuses the
  // returned `message`) are localized. The returned `description` is the single
  // source for both sinks. Other providers fall through to the generic path below.
  if (setup.providerId === CFUSE_PROXY_ID) {
    const description =
      setup.kind === "missing"
        ? t("chat.providerSetup.cfuse.missingMessage")
        : t("chat.providerSetup.cfuse.authMessage");
    const actionLabel =
      setup.kind === "missing"
        ? t("chat.providerSetup.cfuse.installAction")
        : t("chat.providerSetup.cfuse.configureAction");
    toastManager.add({
      type: "warning",
      title: t("chat.providerSetup.title"),
      description,
      actionProps: {
        children: actionLabel,
        onClick: () => window.open(setup.docURL ?? CFUSE_SETUP_DOC_URL, "_blank", "noopener"),
      },
    });
    return { message: description, handled: true };
  }

  toastManager.add({
    type: "warning",
    title: t("chat.providerSetup.title"),
    // Raw hint carries the exact command (e.g. `tnpm i -g …`).
    description: rawMessage,
    ...(setup.docURL
      ? {
          actionProps: {
            children: t("chat.providerSetup.openGuide"),
            onClick: () => window.open(setup.docURL),
          },
        }
      : {}),
  });
  return { message: rawMessage, handled: true };
}
