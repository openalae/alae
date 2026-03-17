import { z } from "zod";

import { supportedProviderIds } from "@/features/settings/providers";

export const SupportedProviderIdSchema = z.enum(supportedProviderIds);

export const ApiKeyInputSchema = z.string().trim().min(1, "API key is required.");

export const ApiKeyMutationResultSchema = z
  .object({
    provider: SupportedProviderIdSchema,
    configured: z.boolean(),
  })
  .strict();

export const ApiKeyStatusesSchema = z
  .object({
    openai: z.boolean(),
    anthropic: z.boolean(),
    google: z.boolean(),
  })
  .strict();

export const ApiKeyValueSchema = z.string().min(1).nullable();
