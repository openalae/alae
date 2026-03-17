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
    description: "Strong-model routing and structured synthesis.",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Cross-check reasoning and high-context drafting.",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    label: "Google",
    description: "Fast comparative runs for wider model spread.",
    placeholder: "AIza...",
  },
];
