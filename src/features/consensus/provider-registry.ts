import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type {
  RealProviderFactory,
  RealProviderRegistry,
} from "@/features/consensus/types";
import type { SupportedProviderId } from "@/features/settings/providers";

const openRouterBaseUrl = "https://openrouter.ai/api/v1";
const ollamaBaseUrl = "http://127.0.0.1:11434/v1";

function requireApiKey(provider: SupportedProviderId, apiKey: string) {
  if (!apiKey.trim()) {
    throw new Error(`Provider ${provider} requires an API key.`);
  }

  return apiKey;
}

export const defaultRealProviderRegistry: RealProviderRegistry = {
  openai: (modelId, apiKey) =>
    createOpenAI({ apiKey: requireApiKey("openai", apiKey) })(modelId as never),
  anthropic: (modelId, apiKey) =>
    createAnthropic({ apiKey: requireApiKey("anthropic", apiKey) })(modelId as never),
  google: (modelId, apiKey) =>
    createGoogleGenerativeAI({ apiKey: requireApiKey("google", apiKey) })(modelId as never),
  openrouter: (modelId, apiKey) =>
    createOpenAI({
      apiKey: requireApiKey("openrouter", apiKey),
      baseURL: openRouterBaseUrl,
    })(modelId as never),
  ollama: (modelId) =>
    createOpenAI({
      apiKey: "ollama",
      baseURL: ollamaBaseUrl,
    })(modelId as never),
};

export function getProviderFactory(
  provider: SupportedProviderId,
  realRegistry?: Partial<RealProviderRegistry>,
): RealProviderFactory {
  return realRegistry?.[provider] ?? defaultRealProviderRegistry[provider];
}
