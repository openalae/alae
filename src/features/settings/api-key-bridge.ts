import { invoke } from "@tauri-apps/api/core";

import {
  CredentialProviderIdSchema,
  ApiKeyInputSchema,
  ApiKeyMutationResultSchema,
  ApiKeyStatusesSchema,
  ApiKeyValueSchema,
  LocalProviderModelsSchema,
  LocalProviderStatusesSchema,
} from "@/features/settings/contracts";
import {
  buildModelCatalogRecord,
  providerDefinitions,
  providerRequiresApiKey,
  type CredentialProviderId,
  type ProviderDiscoveredModel,
  type SupportedProviderId,
} from "@/features/settings/providers";
import { appStore } from "@/store/app-store";
import type { ApiKeyStatus, ProviderStatusMap } from "@/store";

const secureStoreUnavailableMessage =
  "Secure credential commands are only available inside the Tauri desktop runtime.";

function hasTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getTimestamp() {
  return new Date().toISOString();
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected secure store error.";
}

function getStoredStatus(provider: SupportedProviderId): ApiKeyStatus {
  return (
    appStore.getState().apiKeyStatuses[provider] ?? {
      configured: false,
      lastCheckedAt: null,
      error: null,
    }
  );
}

function buildProviderConfiguredMap(
  statuses: ProviderStatusMap,
): Partial<Record<SupportedProviderId, boolean>> {
  return Object.fromEntries(
    providerDefinitions.map((provider) => [provider.id, statuses[provider.id]?.configured ?? false]),
  ) as Partial<Record<SupportedProviderId, boolean>>;
}

function getStoredDiscoveredModels(): Partial<Record<SupportedProviderId, ProviderDiscoveredModel[]>> {
  const { modelCatalog } = appStore.getState();

  return {
    ollama: modelCatalog.ollama.map(({ id, modelId, label, sizeBytes, modifiedAt }) => ({
      id,
      modelId,
      label,
      sizeBytes,
      modifiedAt,
    })),
  };
}

function syncModelCatalog(
  statuses: ProviderStatusMap,
  discoveredModels: Partial<Record<SupportedProviderId, ProviderDiscoveredModel[]>> = getStoredDiscoveredModels(),
) {
  appStore.getState().setModelCatalog(
    buildModelCatalogRecord({
      providerConfiguredMap: buildProviderConfiguredMap(statuses),
      discoveredModels,
    }),
  );
}

function buildSuccessStatusMap(
  hostedConfiguredMap: Partial<Record<CredentialProviderId, boolean>>,
  localConfiguredMap: Partial<Record<SupportedProviderId, boolean>>,
  lastCheckedAt: string,
  localErrors: Partial<Record<SupportedProviderId, string | null>> = {},
): Record<SupportedProviderId, ApiKeyStatus> {
  return Object.fromEntries(
    providerDefinitions.map((provider) => [
      provider.id,
      providerRequiresApiKey(provider.id)
        ? {
            configured: hostedConfiguredMap[provider.id] ?? false,
            lastCheckedAt,
            error: null,
          }
        : {
            configured: localConfiguredMap[provider.id] ?? false,
            lastCheckedAt,
            error: localErrors[provider.id] ?? null,
          },
    ]),
  ) as Record<SupportedProviderId, ApiKeyStatus>;
}

function buildFailureStatusMap(lastCheckedAt: string, error: string) {
  return Object.fromEntries(
    providerDefinitions.map((provider) => [
      provider.id,
      providerRequiresApiKey(provider.id)
        ? {
            configured: getStoredStatus(provider.id).configured,
            lastCheckedAt,
            error,
          }
        : getStoredStatus(provider.id),
    ]),
  ) as Record<SupportedProviderId, ApiKeyStatus>;
}

function ensureRuntime() {
  if (!hasTauriRuntime()) {
    throw new Error(secureStoreUnavailableMessage);
  }
}

export async function refreshApiKeyStatuses(): Promise<void> {
  const lastCheckedAt = getTimestamp();

  if (!hasTauriRuntime()) {
    const statuses = buildSuccessStatusMap(
      {
        openai: false,
        anthropic: false,
        google: false,
        openrouter: false,
      },
      {
        ollama: false,
      },
      lastCheckedAt,
    );
    appStore.getState().setApiKeyStatuses(statuses);
    syncModelCatalog(statuses, {
      ollama: [],
    });
    return;
  }

  try {
    const [hostedResult, localResult, localModelsResult] = await Promise.allSettled([
      invoke("get_api_key_statuses"),
      invoke("get_local_provider_statuses"),
      invoke("get_local_provider_models"),
    ]);

    if (hostedResult.status === "rejected") {
      throw hostedResult.reason;
    }

    const hostedStatuses = ApiKeyStatusesSchema.parse(hostedResult.value);
    const localErrors: Partial<Record<SupportedProviderId, string | null>> = {};
    let localStatuses: Partial<Record<SupportedProviderId, boolean>> = {
      ollama: false,
    };
    let discoveredModels: Partial<Record<SupportedProviderId, ProviderDiscoveredModel[]>> = {
      ollama: [],
    };

    if (localResult.status === "fulfilled") {
      const parsedLocalStatuses = LocalProviderStatusesSchema.parse(localResult.value);

      localStatuses = {
        ollama: parsedLocalStatuses.ollama ?? false,
      };
    }

    if (localModelsResult.status === "fulfilled") {
      const parsedLocalModels = LocalProviderModelsSchema.parse(localModelsResult.value);

      discoveredModels = {
        ollama: parsedLocalModels.ollama ?? [],
      };

      if ((parsedLocalModels.ollama?.length ?? 0) > 0) {
        localStatuses.ollama = true;
      }
    }

    if (localResult.status === "rejected" && localModelsResult.status === "rejected") {
      localErrors.ollama = toErrorMessage(localResult.reason);
    } else if (localModelsResult.status === "rejected") {
      localErrors.ollama = toErrorMessage(localModelsResult.reason);
    }

    const statuses = buildSuccessStatusMap(
      {
        openai: hostedStatuses.openai ?? false,
        anthropic: hostedStatuses.anthropic ?? false,
        google: hostedStatuses.google ?? false,
        openrouter: hostedStatuses.openrouter ?? false,
      },
      localStatuses,
      lastCheckedAt,
      localErrors,
    );
    appStore.getState().setApiKeyStatuses(statuses);
    syncModelCatalog(statuses, discoveredModels);
  } catch (error) {
    const message = toErrorMessage(error);
    appStore.getState().setApiKeyStatuses(buildFailureStatusMap(lastCheckedAt, message));
    throw new Error(message);
  }
}

export async function saveApiKey(provider: CredentialProviderId, key: string): Promise<void> {
  const validatedProvider = CredentialProviderIdSchema.parse(provider);
  const validatedKey = ApiKeyInputSchema.parse(key);
  const lastCheckedAt = getTimestamp();

  try {
    ensureRuntime();

    const result = ApiKeyMutationResultSchema.parse(
      await invoke("set_api_key", {
        provider: validatedProvider,
        key: validatedKey,
      }),
    );

    appStore.getState().setApiKeyStatus(result.provider, {
      configured: result.configured,
      lastCheckedAt,
      error: null,
    });
    syncModelCatalog(appStore.getState().apiKeyStatuses);
  } catch (error) {
    const message = toErrorMessage(error);
    const currentStatus = getStoredStatus(validatedProvider);

    appStore.getState().setApiKeyStatus(validatedProvider, {
      configured: currentStatus.configured,
      lastCheckedAt,
      error: message,
    });

    throw new Error(message);
  }
}

export async function removeApiKey(provider: CredentialProviderId): Promise<void> {
  const validatedProvider = CredentialProviderIdSchema.parse(provider);
  const lastCheckedAt = getTimestamp();

  try {
    ensureRuntime();

    const result = ApiKeyMutationResultSchema.parse(
      await invoke("delete_api_key", {
        provider: validatedProvider,
      }),
    );

    appStore.getState().setApiKeyStatus(result.provider, {
      configured: result.configured,
      lastCheckedAt,
      error: null,
    });
    syncModelCatalog(appStore.getState().apiKeyStatuses);
  } catch (error) {
    const message = toErrorMessage(error);
    const currentStatus = getStoredStatus(validatedProvider);

    appStore.getState().setApiKeyStatus(validatedProvider, {
      configured: currentStatus.configured,
      lastCheckedAt,
      error: message,
    });

    throw new Error(message);
  }
}

export async function readApiKey(provider: CredentialProviderId): Promise<string | null> {
  const validatedProvider = CredentialProviderIdSchema.parse(provider);
  ensureRuntime();

  const result = ApiKeyValueSchema.parse(
    await invoke("get_api_key", {
      provider: validatedProvider,
    }),
  );

  return result;
}

export { secureStoreUnavailableMessage };
