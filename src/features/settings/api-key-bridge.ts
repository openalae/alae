import { invoke } from "@tauri-apps/api/core";

import {
  CredentialProviderIdSchema,
  ApiKeyInputSchema,
  ApiKeyMutationResultSchema,
  ApiKeyStatusesSchema,
  ApiKeyValueSchema,
  LocalProviderStatusesSchema,
} from "@/features/settings/contracts";
import {
  providerDefinitions,
  providerRequiresApiKey,
  type CredentialProviderId,
  type SupportedProviderId,
} from "@/features/settings/providers";
import { appStore } from "@/store/app-store";
import type { ApiKeyStatus } from "@/store";

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
    appStore.getState().setApiKeyStatuses(
      buildSuccessStatusMap(
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
      ),
    );
    return;
  }

  try {
    const [hostedResult, localResult] = await Promise.allSettled([
      invoke("get_api_key_statuses"),
      invoke("get_local_provider_statuses"),
    ]);

    if (hostedResult.status === "rejected") {
      throw hostedResult.reason;
    }

    const hostedStatuses = ApiKeyStatusesSchema.parse(hostedResult.value);
    const localErrors: Partial<Record<SupportedProviderId, string | null>> = {};
    let localStatuses: Partial<Record<SupportedProviderId, boolean>> = {
      ollama: false,
    };

    if (localResult.status === "fulfilled") {
      const parsedLocalStatuses = LocalProviderStatusesSchema.parse(localResult.value);

      localStatuses = {
        ollama: parsedLocalStatuses.ollama ?? false,
      };
    } else {
      localErrors.ollama = toErrorMessage(localResult.reason);
    }

    appStore.getState().setApiKeyStatuses(
      buildSuccessStatusMap(
        {
          openai: hostedStatuses.openai ?? false,
          anthropic: hostedStatuses.anthropic ?? false,
          google: hostedStatuses.google ?? false,
          openrouter: hostedStatuses.openrouter ?? false,
        },
        localStatuses,
        lastCheckedAt,
        localErrors,
      ),
    );
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
