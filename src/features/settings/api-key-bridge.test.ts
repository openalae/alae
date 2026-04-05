import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildModelCatalogRecord } from "@/features/settings/providers";
import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  readApiKey,
  refreshApiKeyStatuses,
  removeApiKey,
  saveApiKey,
} from "@/features/settings/api-key-bridge";

function enableTauriRuntime() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
}

describe("api-key-bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    appStore.setState(createInitialAppStoreState());
    enableTauriRuntime();
  });

  it("refreshes provider statuses into the global store", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "get_api_key_statuses") {
        return {
          openai: true,
          anthropic: false,
          google: true,
          openrouter: false,
        };
      }

      if (command === "get_local_provider_statuses") {
        return {
          ollama: true,
        };
      }

      if (command === "get_local_provider_models") {
        return {
          ollama: [
            {
              id: "ollama:qwen3:8b",
              modelId: "qwen3:8b",
              label: "qwen3:8b",
              sizeBytes: 4 * 1024 * 1024 * 1024,
              modifiedAt: "2026-03-17T00:00:00.000Z",
            },
          ],
        };
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    await refreshApiKeyStatuses();

    expect(appStore.getState().apiKeyStatuses.openai?.configured).toBe(true);
    expect(appStore.getState().apiKeyStatuses.anthropic?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.google?.configured).toBe(true);
    expect(appStore.getState().apiKeyStatuses.openrouter?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.ollama?.configured).toBe(true);
    expect(appStore.getState().modelCatalog.openai[0]?.availability).toBe("ready");
    expect(appStore.getState().modelCatalog.google[0]?.availability).toBe("ready");
    expect(appStore.getState().modelCatalog.ollama[0]?.modelId).toBe("qwen3:8b");
  });

  it("preserves previous configuration flags when refresh fails", async () => {
    appStore.getState().setApiKeyStatus("openai", {
      configured: true,
      lastCheckedAt: null,
      error: null,
    });
    invokeMock.mockRejectedValue(new Error("native failure"));

    await expect(refreshApiKeyStatuses()).rejects.toThrow("native failure");

    expect(appStore.getState().apiKeyStatuses.openai?.configured).toBe(true);
    expect(appStore.getState().apiKeyStatuses.openai?.error).toBe("native failure");
    expect(appStore.getState().apiKeyStatuses.google?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.ollama?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.ollama?.lastCheckedAt).toBeNull();
  });

  it("stores configuration status without persisting raw keys", async () => {
    invokeMock.mockResolvedValue({
      provider: "openai",
      configured: true,
    });

    await saveApiKey("openai", "  sk-openai  ");

    expect(invokeMock).toHaveBeenCalledWith("set_api_key", {
      provider: "openai",
      key: "sk-openai",
    });
    expect(appStore.getState().apiKeyStatuses.openai?.configured).toBe(true);
    expect(appStore.getState().modelCatalog.openai[0]?.availability).toBe("ready");
    expect(JSON.stringify(appStore.getState())).not.toContain("sk-openai");
  });

  it("updates status to unconfigured after removal", async () => {
    appStore.getState().setApiKeyStatus("google", {
      configured: true,
      lastCheckedAt: null,
      error: null,
    });
    invokeMock.mockResolvedValue({
      provider: "google",
      configured: false,
    });

    await removeApiKey("google");

    expect(appStore.getState().apiKeyStatuses.google?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.google?.error).toBeNull();
    expect(appStore.getState().modelCatalog.google[0]?.availability).toBe("setup_required");
  });

  it("reads raw keys on demand without caching them", async () => {
    invokeMock.mockResolvedValue("sk-anthropic");

    const key = await readApiKey("anthropic");

    expect(key).toBe("sk-anthropic");
    expect(JSON.stringify(appStore.getState())).not.toContain("sk-anthropic");
  });

  it("stores OpenRouter status alongside the original hosted providers", async () => {
    invokeMock.mockResolvedValue({
      provider: "openrouter",
      configured: true,
    });

    await saveApiKey("openrouter", " sk-or-v1-test ");

    expect(invokeMock).toHaveBeenCalledWith("set_api_key", {
      provider: "openrouter",
      key: "sk-or-v1-test",
    });
    expect(appStore.getState().apiKeyStatuses.openrouter?.configured).toBe(true);
  });

  it("keeps hosted provider refreshes working when the local runtime check fails", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "get_api_key_statuses") {
        return {
          openai: true,
          anthropic: false,
          google: false,
          openrouter: true,
        };
      }

      if (command === "get_local_provider_statuses") {
        throw new Error("ollama probe failed");
      }

      if (command === "get_local_provider_models") {
        throw new Error("ollama tags failed");
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    await refreshApiKeyStatuses();

    expect(appStore.getState().apiKeyStatuses.openrouter?.configured).toBe(true);
    expect(appStore.getState().apiKeyStatuses.ollama?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.ollama?.error).toBe("ollama probe failed");
    expect(appStore.getState().modelCatalog).toEqual(
      buildModelCatalogRecord({
        providerConfiguredMap: {
          openai: true,
          anthropic: false,
          google: false,
          openrouter: true,
          ollama: false,
        },
        discoveredModels: {
          ollama: [],
        },
      }),
    );
  });
});
