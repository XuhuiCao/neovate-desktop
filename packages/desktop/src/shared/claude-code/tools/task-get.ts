import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

export const TaskGet = tool({
  inputSchema: z.object({
    taskId: z.string(),
  }),
  outputSchema: z.object({
    task: z
      .object({
        id: z.string(),
        subject: z.string(),
        description: z.string(),
        status: z.enum(["pending", "in_progress", "completed"]),
        blocks: z.array(z.string()),
        blockedBy: z.array(z.string()),
      })
      .nullable(),
  }),
});

export type TaskGetUIToolInvocation = UIToolInvocation<typeof TaskGet>;
