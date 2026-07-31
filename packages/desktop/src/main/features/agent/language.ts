import type { AgentLanguage } from "../../../shared/features/config/types";

/**
 * Hard system-prompt directive for the configured agent reply language.
 *
 * The SDK's `settings.language` is only a soft preference; the model drifts back
 * to English on technical/English-phrased questions. This appends an explicit
 * instruction as a stronger signal. English (and any unexpected value) returns ""
 * — no directive — preserving the historical English no-op.
 *
 * Takes a plain `string` (not `AgentLanguage`) so a hand-edited config value cannot
 * make it throw. The text is sent to the model, not shown in the UI, so it is
 * intentionally not run through i18n.
 */
export function languageDirective(agentLanguage: string): string {
  switch (agentLanguage) {
    case "Chinese":
      return "\n\nAlways respond in Chinese (简体中文), including explanations and code comments, regardless of the language of the question.";
    case "English":
    default:
      return "";
  }
}

/**
 * A session is safe to tear down and rebuild only when its consume loop is still
 * alive and no turn is queued or in flight. This enforces the "don't interrupt a
 * streaming turn" guarantee inside SessionManager rather than trusting the
 * renderer composer. Shared by the language-rebuild gate and the provider-switch
 * (`set_provider`) guard.
 */
export function isSessionIdle(session: {
  consumeExited: boolean;
  activeTurnUserMessageId?: string;
  pendingTurnUserMessageIds: string[];
}): boolean {
  return (
    !session.consumeExited &&
    !session.activeTurnUserMessageId &&
    session.pendingTurnUserMessageIds.length === 0
  );
}

/**
 * A session needs a language-triggered rebuild only when the configured language
 * differs from the one baked at init AND the session is idle (safe to tear down).
 */
export function shouldRebuildForLanguage(
  session: {
    agentLanguage: AgentLanguage;
    consumeExited: boolean;
    activeTurnUserMessageId?: string;
    pendingTurnUserMessageIds: string[];
  },
  currentLanguage: AgentLanguage,
): boolean {
  return session.agentLanguage !== currentLanguage && isSessionIdle(session);
}
