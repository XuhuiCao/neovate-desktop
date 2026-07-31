import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

export const TaskList = tool({
  inputSchema: z.object({}),
  outputSchema: z.object({
    tasks: z.array(
      z.object({
        id: z.string(),
        subject: z.string(),
        status: z.enum(["pending", "in_progress", "completed"]),
        owner: z.string().optional(),
        blockedBy: z.array(z.string()),
      }),
    ),
  }),
});

export type TaskListUIToolInvocation = UIToolInvocation<typeof TaskList>;
