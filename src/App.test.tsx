import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    appStore.setState(createInitialAppStoreState());
    refreshApiKeyStatusesMock.mockReset();
    saveApiKeyMock.mockReset();
    removeApiKeyMock.mockReset();
    refreshApiKeyStatusesMock.mockResolvedValue(undefined);
  });

  it("renders the module 7 workspace shell and refreshes provider status on mount", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /Alae now centers execution on a progressive synthesis workspace/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Progressive Workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Provider Access" })).toBeInTheDocument();
    expect(screen.getByText(/Truth Panel Preview/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshApiKeyStatusesMock).toHaveBeenCalledTimes(1);
    });
  });
});
