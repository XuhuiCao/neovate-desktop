import { useMemo } from "react";

import { useExistingTurnArtifacts } from "../../agent/use-existing-turn-artifacts";
import { deriveArtifacts } from "../utils/derive-artifacts";
import { deriveLiveFileChanges } from "../utils/derive-live-file-changes";
import { deriveProgress } from "../utils/derive-progress";
import { useChatMessages } from "./use-chat-messages";
import { useLocalChangesSummary } from "./use-local-changes-summary";

export function useSummaryData(sessionId: string | null, cwd: string | null) {
  const messages = useChatMessages(sessionId);
  const progress = useMemo(() => deriveProgress(messages), [messages]);
  const rawArtifacts = useMemo(() => deriveArtifacts(messages), [messages]);
  const artifacts = useExistingTurnArtifacts(rawArtifacts);
  const liveFileChanges = useMemo(() => deriveLiveFileChanges(messages), [messages]);
  const localChanges = useLocalChangesSummary(cwd);

  return { messages, progress, artifacts, liveFileChanges, localChanges };
}
