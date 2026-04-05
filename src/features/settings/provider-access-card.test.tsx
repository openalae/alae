import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  buildModelCatalogRecord,
  getProviderAccessSectionId,
  providerAccessCardId,
} from "@/features/settings/providers";
import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";

const { saveApiKeyMock, removeApiKeyMock } = vi.hoisted(() => ({
  saveApiKeyMock: vi.fn(),
  removeApiKeyMock: vi.fn(),
}));

vi.mock("@/features/settings/api-key-bridge", () => ({
  saveApiKey: saveApiKeyMock,
  removeApiKey: removeApiKeyMock,
}));

import { ProviderAccessCard } from "@/features/settings/provider-access-card";

describe("ProviderAccessCard", () => {
  beforeEach(() => {
    saveApiKeyMock.mockReset();
    removeApiKeyMock.mockReset();
    appStore.setState(
      createInitialAppStoreState({
        apiKeyStatuses: {
          openai: {
            configured: true,
            lastCheckedAt: "2026-03-17T00:00:00.000Z",
            error: null,
          },
          anthropic: {
            configured: false,
            lastCheckedAt: "2026-03-17T00:00:00.000Z",
            error: null,
          },
          google: {
            configured: false,
            lastCheckedAt: "2026-03-17T00:00:00.000Z",
            error: null,
          },
          openrouter: {
            configured: false,
            lastCheckedAt: "2026-03-17T00:00:00.000Z",
            error: null,
          },
          ollama: {
            configured: true,
            lastCheckedAt: "2026-03-17T00:00:00.000Z",
            error: null,
          },
        },
        modelCatalog: buildModelCatalogRecord({
          providerConfiguredMap: {
            openai: true,
            anthropic: false,
            google: false,
            openrouter: false,
            ollama: true,
          },
          discoveredModels: {
            ollama: [
              {
                id: "ollama:qwen3:8b",
                modelId: "qwen3:8b",
                label: "qwen3:8b",
                sizeBytes: 4 * 1024 * 1024 * 1024,
                modifiedAt: "2026-03-17T00:00:00.000Z",
              },
            ],
          },
        }),
      }),
    );
  });

  it("renders all configured providers without triggering page-level refresh work", () => {
    render(<ProviderAccessCard />);

    expect(screen.getByRole("heading", { name: "Model providers" })).toBeInTheDocument();
    expect(document.getElementById(providerAccessCardId)).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
    expect(screen.getByText("Ollama")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("GPT-5 Mini")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter Free")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
  });

  it("renders panel-level refresh state from the shell", () => {
    render(<ProviderAccessCard isRefreshing panelError="native refresh failed" />);

    expect(screen.getByText("native refresh failed")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Refreshing provider statuses")).toHaveLength(5);
  });

  it("blocks empty save submissions", async () => {
    render(<ProviderAccessCard />);

    fireEvent.click(screen.getAllByRole("button", { name: "Save key" })[0]);

    expect(saveApiKeyMock).not.toHaveBeenCalled();
    expect(await screen.findByText("API key is required.")).toBeInTheDocument();
  });

  it("clears the input after a successful save", async () => {
    saveApiKeyMock.mockImplementation(async (provider: "openai") => {
      appStore.getState().setApiKeyStatus(provider, {
        configured: true,
        lastCheckedAt: "2026-03-17T00:00:00.000Z",
        error: null,
      });
    });

    render(<ProviderAccessCard />);

    const input = screen.getAllByLabelText("API key")[0];
    fireEvent.change(input, { target: { value: "sk-test" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save key" })[0]);

    await waitFor(() => {
      expect(saveApiKeyMock).toHaveBeenCalledWith("openai", "sk-test");
    });
    expect(input).toHaveValue("");
    expect(screen.getByText("API key saved.")).toBeInTheDocument();
  });

  it("updates the row after deletion", async () => {
    removeApiKeyMock.mockImplementation(async (provider: "openai") => {
      appStore.getState().setApiKeyStatus(provider, {
        configured: false,
        lastCheckedAt: "2026-03-17T00:00:00.000Z",
        error: null,
      });
    });

    render(<ProviderAccessCard />);

    fireEvent.click(screen.getAllByRole("button", { name: /Remove key/i })[0]);

    await waitFor(() => {
      expect(removeApiKeyMock).toHaveBeenCalledWith("openai");
    });
    expect(screen.getByText("API key removed.")).toBeInTheDocument();
  });

  it("renders local-only providers without API key controls", () => {
    render(<ProviderAccessCard />);

    expect(document.getElementById(getProviderAccessSectionId("openai"))).toBeInTheDocument();
    expect(document.getElementById(getProviderAccessSectionId("ollama"))).toBeInTheDocument();
    expect(
      screen.getAllByText(/Keep Ollama running at http:\/\/127\.0\.0\.1:11434\/v1/i),
    ).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Save key" })).toHaveLength(4);
    expect(screen.getByText("Detected models")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
  });

  it("calls the refresh callback when requested", () => {
    const onRefresh = vi.fn();

    render(<ProviderAccessCard onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh access" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
