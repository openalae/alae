import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";

const { refreshApiKeyStatusesMock, saveApiKeyMock, removeApiKeyMock } = vi.hoisted(() => ({
  refreshApiKeyStatusesMock: vi.fn(),
  saveApiKeyMock: vi.fn(),
  removeApiKeyMock: vi.fn(),
}));

vi.mock("@/features/settings/api-key-bridge", () => ({
  refreshApiKeyStatuses: refreshApiKeyStatusesMock,
  saveApiKey: saveApiKeyMock,
  removeApiKey: removeApiKeyMock,
}));

import { ProviderAccessCard } from "@/features/settings/provider-access-card";

describe("ProviderAccessCard", () => {
  beforeEach(() => {
    refreshApiKeyStatusesMock.mockReset();
    saveApiKeyMock.mockReset();
    removeApiKeyMock.mockReset();
    appStore.setState(createInitialAppStoreState());

    refreshApiKeyStatusesMock.mockImplementation(async () => {
      appStore.getState().setApiKeyStatuses({
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
      });
    });
  });

  it("renders all configured providers and refreshes on mount", async () => {
    render(<ProviderAccessCard />);

    expect(screen.getByRole("heading", { name: "Provider Access" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshApiKeyStatusesMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Configured")).toBeInTheDocument();
  });

  it("blocks empty save submissions", async () => {
    render(<ProviderAccessCard />);

    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

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
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() => {
      expect(saveApiKeyMock).toHaveBeenCalledWith("openai", "sk-test");
    });
    expect(input).toHaveValue("");
    expect(screen.getByText("Saved to secure store.")).toBeInTheDocument();
  });

  it("updates the row after deletion", async () => {
    appStore.getState().setApiKeyStatus("openai", {
      configured: true,
      lastCheckedAt: "2026-03-17T00:00:00.000Z",
      error: null,
    });
    removeApiKeyMock.mockImplementation(async (provider: "openai") => {
      appStore.getState().setApiKeyStatus(provider, {
        configured: false,
        lastCheckedAt: "2026-03-17T00:00:00.000Z",
        error: null,
      });
    });

    render(<ProviderAccessCard />);

    fireEvent.click(screen.getAllByRole("button", { name: /Delete/i })[0]);

    await waitFor(() => {
      expect(removeApiKeyMock).toHaveBeenCalledWith("openai");
    });
    expect(screen.getByText("Removed from secure store.")).toBeInTheDocument();
  });
});
