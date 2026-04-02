export const supportedProviderIds = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "ollama",
] as const;

export const credentialProviderIds = ["openai", "anthropic", "google", "openrouter"] as const;

export type SupportedProviderId = (typeof supportedProviderIds)[number];
export type CredentialProviderId = (typeof credentialProviderIds)[number];
export type ProviderAuthKind = "apiKey" | "none";

export type ProviderDefinition = {
  id: SupportedProviderId;
  label: string;
  description: string;
  authKind: ProviderAuthKind;
  placeholder?: string;
  connectionHint?: string;
};

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "General-purpose reasoning and structured answers.",
    authKind: "apiKey",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Alternative perspective for long-form reasoning.",
    authKind: "apiKey",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    label: "Google",
    description: "Fast comparative pass for broader coverage.",
    authKind: "apiKey",
    placeholder: "AIza...",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "OpenAI-compatible routing for free and low-cost hosted models.",
    authKind: "apiKey",
    placeholder: "sk-or-v1-...",
    connectionHint: "The free preset uses OpenRouter's free router for hosted runs.",
  },
  {
    id: "ollama",
    label: "Ollama",
    description: "Local models running on your machine with no hosted API key.",
    authKind: "none",
    connectionHint:
      "No API key required. Keep Ollama running at http://127.0.0.1:11434/v1 and pull the local models you want to use.",
  },
];

const providerDefinitionMap = Object.fromEntries(
  providerDefinitions.map((provider) => [provider.id, provider]),
) as Record<SupportedProviderId, ProviderDefinition>;

const credentialProviderIdSet = new Set<SupportedProviderId>(credentialProviderIds);

export const providerAccessCardId = "provider-access-card";

export function getProviderDefinition(providerId: SupportedProviderId): ProviderDefinition {
  return providerDefinitionMap[providerId];
}

export function getProviderAccessSectionId(providerId: SupportedProviderId) {
  return `provider-access-${providerId}`;
}

export function providerRequiresApiKey(
  providerId: SupportedProviderId,
): providerId is CredentialProviderId {
  return credentialProviderIdSet.has(providerId);
}
