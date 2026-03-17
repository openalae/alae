import { invoke } from "@tauri-apps/api/core";

import { SupportedProviderIdSchema, ApiKeyInputSchema, ApiKeyMutationResultSchema, ApiKeyStatusesSchema, ApiKeyValueSchema } from "@/features/settings/contracts";
import { supportedProviderIds, type SupportedProviderId } from "@/features/settings/providers";
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

function buildStatusMap(
  configuredMap: Record<SupportedProviderId, boolean>,
  lastCheckedAt: string,
  error: string | null = null,
): Record<SupportedProviderId, ApiKeyStatus> {
  return Object.fromEntries(
    supportedProviderIds.map((provider) => [
      provider,
      {
        configured: configuredMap[provider],
        lastCheckedAt,
        error,
      },
    ]),
  ) as Record<SupportedProviderId, ApiKeyStatus>;
}

function buildFailureStatusMap(lastCheckedAt: string, error: string) {
  return Object.fromEntries(
    supportedProviderIds.map((provider) => [
      provider,
      {
        configured: getStoredStatus(provider).configured,
        lastCheckedAt,
        error,
      },
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
      buildStatusMap(
        {
          openai: false,
          anthropic: false,
          google: false,
        },
        lastCheckedAt,
      ),
    );
    return;
  }

  try {
    const result = ApiKeyStatusesSchema.parse(await invoke("get_api_key_statuses"));

    appStore.getState().setApiKeyStatuses(
      buildStatusMap(
        {
          openai: result.openai,
          anthropic: result.anthropic,
          google: result.google,
        },
        lastCheckedAt,
      ),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    appStore.getState().setApiKeyStatuses(buildFailureStatusMap(lastCheckedAt, message));
    throw new Error(message);
  }
}

export async function saveApiKey(provider: SupportedProviderId, key: string): Promise<void> {
  const validatedProvider = SupportedProviderIdSchema.parse(provider);
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

export async function removeApiKey(provider: SupportedProviderId): Promise<void> {
  const validatedProvider = SupportedProviderIdSchema.parse(provider);
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

export async function readApiKey(provider: SupportedProviderId): Promise<string | null> {
  const validatedProvider = SupportedProviderIdSchema.parse(provider);
  ensureRuntime();

  const result = ApiKeyValueSchema.parse(
    await invoke("get_api_key", {
      provider: validatedProvider,
    }),
  );

  return result;
}

export { secureStoreUnavailableMessage };
