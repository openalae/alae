export const supportedProviderIds = ["openai", "anthropic", "google"] as const;

export type SupportedProviderId = (typeof supportedProviderIds)[number];

export type ProviderDefinition = {
  id: SupportedProviderId;
  label: string;
  description: string;
  placeholder: string;
};

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "General-purpose reasoning and structured answers.",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Alternative perspective for long-form reasoning.",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    label: "Google",
    description: "Fast comparative pass for broader coverage.",
    placeholder: "AIza...",
  },
];
