import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
        },
      }),
    );
  });

  it("renders all configured providers without triggering page-level refresh work", () => {
    render(<ProviderAccessCard />);

    expect(screen.getByRole("heading", { name: "Provider Access" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
  });

  it("renders panel-level refresh state from the shell", () => {
    render(<ProviderAccessCard isRefreshing panelError="native refresh failed" />);

    expect(screen.getByText("native refresh failed")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Refreshing provider statuses")).toHaveLength(3);
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
