import { useProjectStore } from "../store";

/**
 * Returns the active project and its cwd (project.path).
 * Used by features that need the current working directory without
 * subscribing to the full project store.
 */
export function useActiveProject() {
  const project = useProjectStore((s) => s.activeProject);
  const cwd = useProjectStore((s) => s.activeProject?.path ?? "");
  return { project, cwd };
}
