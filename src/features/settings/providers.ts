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

export type ModelCatalogSource = "local" | "free" | "paid";
export type ModelCatalogAvailability = "ready" | "setup_required" | "unavailable";

export type ProviderDiscoveredModel = {
  id: string;
  modelId: string;
  label: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
};

export type ModelCatalogItem = ProviderDiscoveredModel & {
  provider: SupportedProviderId;
  source: ModelCatalogSource;
  availability: ModelCatalogAvailability;
  supportsCandidate: boolean;
  supportsJudge: boolean;
  tags: readonly string[];
};

export type ModelCatalogRecord = Record<SupportedProviderId, ModelCatalogItem[]>;

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

const curatedProviderCatalog: Record<
  SupportedProviderId,
  Array<{
    modelId: string;
    label: string;
    source: ModelCatalogSource;
    supportsCandidate: boolean;
    supportsJudge: boolean;
    tags: readonly string[];
  }>
> = {
  openai: [
    {
      modelId: "gpt-5-mini",
      label: "GPT-5 Mini",
      source: "paid",
      supportsCandidate: true,
      supportsJudge: true,
      tags: ["tier:fast"],
    },
    {
      modelId: "gpt-5.2",
      label: "GPT-5.2",
      source: "paid",
      supportsCandidate: true,
      supportsJudge: true,
      tags: ["tier:smart"],
    },
  ],
  anthropic: [
    {
      modelId: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      source: "paid",
      supportsCandidate: true,
      supportsJudge: true,
      tags: ["tier:smart"],
    },
  ],
  google: [
    {
      modelId: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      source: "paid",
      supportsCandidate: true,
      supportsJudge: true,
      tags: ["tier:fast"],
    },
  ],
  openrouter: [
    {
      modelId: "openrouter/free",
      label: "OpenRouter Free",
      source: "free",
      supportsCandidate: true,
      supportsJudge: true,
      tags: ["free", "tier:fast"],
    },
  ],
  ollama: [],
};

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

export function buildCatalogItemId(provider: SupportedProviderId, modelId: string) {
  return `${provider}:${modelId}`;
}

export function createEmptyModelCatalogRecord(): ModelCatalogRecord {
  return supportedProviderIds.reduce(
    (catalog, providerId) => ({
      ...catalog,
      [providerId]: [],
    }),
    {} as ModelCatalogRecord,
  );
}

export function buildModelCatalogRecord(input: {
  providerConfiguredMap?: Partial<Record<SupportedProviderId, boolean>>;
  discoveredModels?: Partial<Record<SupportedProviderId, ProviderDiscoveredModel[]>>;
} = {}): ModelCatalogRecord {
  const catalog = createEmptyModelCatalogRecord();
  const providerConfiguredMap = input.providerConfiguredMap ?? {};
  const discoveredModels = input.discoveredModels ?? {};

  for (const providerId of supportedProviderIds) {
    if (providerId === "ollama") {
      const localModels = discoveredModels.ollama ?? [];
      catalog.ollama = localModels.map((model) => ({
        ...model,
        provider: "ollama",
        id: model.id || buildCatalogItemId("ollama", model.modelId),
        source: "local",
        availability: providerConfiguredMap.ollama ? "ready" : "unavailable",
        supportsCandidate: true,
        supportsJudge: true,
        tags: ["local", "tier:fast"],
      }));
      continue;
    }

    const availability: ModelCatalogAvailability = providerConfiguredMap[providerId]
      ? "ready"
      : "setup_required";

    catalog[providerId] = curatedProviderCatalog[providerId].map((model) => ({
      id: buildCatalogItemId(providerId, model.modelId),
      provider: providerId,
      modelId: model.modelId,
      label: model.label,
      sizeBytes: null,
      modifiedAt: null,
      source: model.source,
      availability,
      supportsCandidate: model.supportsCandidate,
      supportsJudge: model.supportsJudge,
      tags: model.tags,
    }));
  }

  return catalog;
}
