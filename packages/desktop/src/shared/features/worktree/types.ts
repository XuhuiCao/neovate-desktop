import { z } from "zod";

export const WorktreeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  path: z.string(),
  /** Branch created together with this worktree. Optional for legacy records (display uses real-time git). Used for delete-match when present. */
  gitBranch: z.string().optional(),
  createdAt: z.string(),
});

export const WorktreeFileSchema = z.object({
  worktrees: z.array(WorktreeSchema),
});

export type Worktree = z.infer<typeof WorktreeSchema>;
export type WorktreeFile = z.infer<typeof WorktreeFileSchema>;

export type PreflightResult = { ok: true } | { ok: false; reason: string };
