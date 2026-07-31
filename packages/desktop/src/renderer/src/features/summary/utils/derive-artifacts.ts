import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";
import type { TurnArtifact } from "../../agent/turn-artifacts";

import { deriveTurnArtifactsFromMessages } from "../../agent/turn-artifacts";

export type SummaryArtifact = TurnArtifact;

export function deriveArtifacts(messages: ClaudeCodeUIMessage[]): SummaryArtifact[] {
  return deriveTurnArtifactsFromMessages(messages);
}
