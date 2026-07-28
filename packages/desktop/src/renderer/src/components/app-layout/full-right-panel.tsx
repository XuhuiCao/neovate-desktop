import { ExtensionsPanel } from "../../features/extensions/components/extensions-panel";
import { useLayoutStore } from "./store";

export function FullRightPanel() {
  const fullRightPanelId = useLayoutStore((s) => s.fullRightPanelId);
  const closeFullRightPanel = useLayoutStore((s) => s.closeFullRightPanel);

  if (!fullRightPanelId) return null;

  // The unified ExtensionsPanel (skills + plugins tabs) replaces the previous
  // per-feature skills/plugins full-right-panel views.
  if (fullRightPanelId === "extensions") {
    return <ExtensionsPanel onClose={closeFullRightPanel} />;
  }

  return null;
}
