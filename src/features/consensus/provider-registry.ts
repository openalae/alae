import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type {
  RealProviderFactory,
  RealProviderRegistry,
} from "@/features/consensus/types";
import type { SupportedProviderId } from "@/features/settings/providers";

export const defaultRealProviderRegistry: RealProviderRegistry = {
  openai: (modelId, apiKey) => createOpenAI({ apiKey })(modelId as never),
  anthropic: (modelId, apiKey) => createAnthropic({ apiKey })(modelId as never),
  google: (modelId, apiKey) => createGoogleGenerativeAI({ apiKey })(modelId as never),
};

export function getProviderFactory(
  provider: SupportedProviderId,
  realRegistry?: Partial<RealProviderRegistry>,
): RealProviderFactory {
  return realRegistry?.[provider] ?? defaultRealProviderRegistry[provider];
}
