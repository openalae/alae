import { z } from "zod";

import {
  credentialProviderIds,
  supportedProviderIds,
} from "@/features/settings/providers";

export const SupportedProviderIdSchema = z.enum(supportedProviderIds);
export const CredentialProviderIdSchema = z.enum(credentialProviderIds);

export const ApiKeyInputSchema = z.string().trim().min(1, "API key is required.");

export const ApiKeyMutationResultSchema = z
  .object({
    provider: CredentialProviderIdSchema,
    configured: z.boolean(),
  })
  .strict();

export const ApiKeyStatusesSchema = z
  .object({
    openai: z.boolean().optional(),
    anthropic: z.boolean().optional(),
    google: z.boolean().optional(),
    openrouter: z.boolean().optional(),
  })
  .strict();

export const LocalProviderStatusesSchema = z
  .object({
    ollama: z.boolean().optional(),
  })
  .strict();

export const ApiKeyValueSchema = z.string().min(1).nullable();
