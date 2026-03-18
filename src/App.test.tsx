import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";
import type { SynthesisReport, TruthPanelSnapshot } from "@/schema";

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

const report: SynthesisReport = {
  id: "report-app-1",
  prompt: "Inspect the latest telemetry.",
  summary: "The report rendered successfully.",
  status: "partial",
  consensus: {
    summary: "One run completed with a fallback path.",
    items: [],
  },
  conflicts: [],
  resolution: {
    summary: "Fallback resolution kept the report usable.",
    rationale: "One candidate still produced structured output.",
    chosenApproach: "Keep diagnostics in the right rail.",
    resolvedConflictIds: [],
    judgeModelRunId: "run-judge-1",
    openRisks: [],
  },
  nextActions: [],
  modelRuns: [
    {
      id: "run-judge-1",
      provider: "openai",
      model: "gpt-5.2",
      role: "judge",
      status: "completed",
      startedAt: "2026-03-18T00:00:00.000Z",
      completedAt: "2026-03-18T00:00:01.000Z",
      latencyMs: 1000,
      usage: {
        inputTokens: 120,
        outputTokens: 60,
        totalTokens: 180,
      },
      rawText: "{\"summary\":\"ok\"}",
      parsed: {
        outputType: "judge",
        summary: "Keep diagnostics in the right rail.",
        chosenApproach: "Keep diagnostics in the right rail.",
        rationale: "One candidate still produced structured output.",
        resolvedConflictIds: [],
        openRisks: [],
      },
      validation: {
        status: "passed",
        issues: [],
      },
      error: null,
    },
  ],
  createdAt: "2026-03-18T00:00:01.000Z",
};

const snapshot: TruthPanelSnapshot = {
  reportId: report.id,
  generatedAt: report.createdAt,
  runSummary: {
    totalRuns: 1,
    pendingRuns: 0,
    runningRuns: 0,
    completedRuns: 1,
    failedRuns: 0,
    aggregateInputTokens: 120,
    aggregateOutputTokens: 60,
    aggregateTotalTokens: 180,
    aggregateLatencyMs: 1000,
    maxLatencyMs: 1000,
  },
  runs: report.modelRuns,
  validationIssues: [],
  events: [],
};

describe("App", () => {
  beforeEach(() => {
    appStore.setState(createInitialAppStoreState());
    refreshApiKeyStatusesMock.mockReset();
    saveApiKeyMock.mockReset();
    removeApiKeyMock.mockReset();
    refreshApiKeyStatusesMock.mockResolvedValue(undefined);
  });

  it("renders the module 8 shell and refreshes provider status on mount", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /Alae now renders live diagnostics in the right-side truth panel/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Progressive Workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Provider Access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Truth Panel" })).toBeInTheDocument();

    await waitFor(() => {
      expect(refreshApiKeyStatusesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shares truth-panel toggle state between the workspace header and the right rail", async () => {
    appStore.setState(
      createInitialAppStoreState({
        latestSynthesisReport: report,
        truthPanelSnapshot: snapshot,
      }),
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open Truth Panel" }));

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(true);
    });
    expect(screen.getByRole("heading", { name: "Run summary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide Truth Panel" }));

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(false);
    });
    expect(screen.queryByRole("heading", { name: "Run summary" })).not.toBeInTheDocument();
  });
});
