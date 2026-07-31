import { oc, type } from "@orpc/contract";
import { z } from "zod";

import type { ModelScope } from "../agent/types";

import { MODEL_TAG_NAMES, type Provider } from "./types";

// `tags` MUST be in the schema: create/update strip unknown keys via this strict
// z.object, and yuyan is added through client.provider.create() — without this its
// tags would be silently dropped. (cfuse persists its record directly, bypassing Zod.)
const providerModelEntrySchema = z.object({
  displayName: z.string().optional(),
  tags: z
    .array(
      z.object({
        name: z.enum(MODEL_TAG_NAMES),
        cname: z.string().optional(),
        value: z.string().optional(),
      }),
    )
    .optional(),
});

const providerModelMapSchema = z.object({
  model: z.string().optional(),
  haiku: z.string().optional(),
  opus: z.string().optional(),
  sonnet: z.string().optional(),
});

export const providerContract = {
  list: oc.output(type<Provider[]>()),

  get: oc.input(z.object({ id: z.string() })).output(type<Provider | null>()),

  create: oc
    .input(
      z.object({
        name: z.string().min(1),
        baseURL: z.string().url(),
        apiKey: z.string().min(1),
        models: z
          .record(z.string(), providerModelEntrySchema)
          .refine((m) => Object.keys(m).length > 0, "At least one model required"),
        modelMap: providerModelMapSchema,
        envOverrides: z.record(z.string(), z.string()).optional(),
        builtInId: z.string().optional(),
        dismissedSyncModels: z.array(z.string()).optional(),
        auth: z.enum(["inherit", "api-key", "oauth"]).optional(),
      }),
    )
    .output(type<Provider>()),

  update: oc
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        baseURL: z.string().url().optional(),
        apiKey: z.string().min(1).optional(),
        models: z
          .record(z.string(), providerModelEntrySchema)
          .refine((m) => Object.keys(m).length > 0, "At least one model required")
          .optional(),
        modelMap: providerModelMapSchema.optional(),
        envOverrides: z.record(z.string(), z.string()).optional(),
        dismissedSyncModels: z.array(z.string()).optional(),
        auth: z.enum(["inherit", "api-key", "oauth"]).optional(),
      }),
    )
    .output(type<Provider>()),

  remove: oc.input(z.object({ id: z.string() })).output(type<void>()),

  quickCheck: oc
    .input(
      z.object({
        baseURL: z.string().url(),
        apiKey: z.string().min(1),
        modelId: z.string(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),

  checkModel: oc
    .input(
      z.object({
        baseURL: z.string().url(),
        apiKey: z.string().min(1),
        modelId: z.string(),
      }),
    )
    .output(
      z.object({
        ttftMs: z.number(),
        tpot: z.number(),
        tps: z.number(),
        totalTimeMs: z.number(),
        tokensGenerated: z.number(),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),

  setSelection: oc
    .input(
      z.object({
        sessionId: z.string(),
        providerId: z.string().nullable(),
        model: z.string().nullable(),
        scope: z.enum(["session", "project", "global"]),
      }),
    )
    .output(
      type<{
        providerId?: string;
        model?: string;
        providerScope?: ModelScope;
        modelScope?: ModelScope;
      }>(),
    ),
};
