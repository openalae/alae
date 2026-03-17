import { beforeEach, describe, expect, it, vi } from "vitest";

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
    invokeMock.mockResolvedValue({
      openai: true,
      anthropic: false,
      google: true,
    });

    await refreshApiKeyStatuses();

    expect(appStore.getState().apiKeyStatuses.openai?.configured).toBe(true);
    expect(appStore.getState().apiKeyStatuses.anthropic?.configured).toBe(false);
    expect(appStore.getState().apiKeyStatuses.google?.configured).toBe(true);
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
  });

  it("reads raw keys on demand without caching them", async () => {
    invokeMock.mockResolvedValue("sk-anthropic");

    const key = await readApiKey("anthropic");

    expect(key).toBe("sk-anthropic");
    expect(JSON.stringify(appStore.getState())).not.toContain("sk-anthropic");
  });
});
