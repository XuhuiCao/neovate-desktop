import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";

export const TaskCreate = tool({
  inputSchema: z.object({
    subject: z.string(),
    description: z.string(),
    activeForm: z.string().optional(),
  }),
  outputSchema: z.object({
    task: z.object({
      id: z.string(),
      subject: z.string(),
    }),
  }),
});

export type TaskCreateUIToolInvocation = UIToolInvocation<typeof TaskCreate>;
