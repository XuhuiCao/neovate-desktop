import { z } from "zod";

export const whenSchema = z.union([
  z.object({ fileExists: z.string() }),
  z.object({ dep: z.string() }),
]);

export const manifestSchema = z.object({
  when: whenSchema.optional(),
});

export type BuiltInPluginManifest = z.infer<typeof manifestSchema>;
export type BuiltInPluginWhen = z.infer<typeof whenSchema>;
