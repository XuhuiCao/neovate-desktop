import { oc, type } from "@orpc/contract";
import { z } from "zod";

import type { ModelScope } from "../agent/types";
import type { Provider } from "./types";

const providerModelEntrySchema = z.object({ displayName: z.string().optional() });

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
        auth: z.enum(["inherit", "api-key"]).optional(),
        // inherit 模式允许 baseURL/apiKey/models 缺省（SDK 自解析登录态）；
        // 完整性校验由 main router 兜底。
        baseURL: z.string().optional(),
        apiKey: z.string().optional(),
        models: z.record(z.string(), providerModelEntrySchema).optional(),
        modelMap: providerModelMapSchema.optional(),
        envOverrides: z.record(z.string(), z.string()).optional(),
        builtInId: z.string().optional(),
        dismissedSyncModels: z.array(z.string()).optional(),
      }),
    )
    .output(type<Provider>()),

  update: oc
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        auth: z.enum(["inherit", "api-key"]).optional(),
        baseURL: z.string().optional(),
        apiKey: z.string().optional(),
        models: z.record(z.string(), providerModelEntrySchema).optional(),
        modelMap: providerModelMapSchema.optional(),
        envOverrides: z.record(z.string(), z.string()).optional(),
        dismissedSyncModels: z.array(z.string()).optional(),
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
