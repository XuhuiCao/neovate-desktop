import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

export const TaskUpdate = tool({
  inputSchema: z.object({
    taskId: z.string(),
    subject: z.string().optional(),
    description: z.string().optional(),
    activeForm: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "deleted"]).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    taskId: z.string(),
    updatedFields: z.array(z.string()),
    error: z.string().optional(),
    statusChange: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .optional(),
  }),
});

export type TaskUpdateUIToolInvocation = UIToolInvocation<typeof TaskUpdate>;
