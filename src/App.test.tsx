import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";
import type { LoadedConversation, SynthesisReport, TruthPanelSnapshot } from "@/schema";

const {
  refreshApiKeyStatusesMock,
  saveApiKeyMock,
  removeApiKeyMock,
  createReasoningTreeRepositoryMock,
  repositoryMock,
} = vi.hoisted(() => {
  const repositoryMock = {
    createConversation: vi.fn(),
    appendNode: vi.fn(),
    forkNode: vi.fn(),
    listConversations: vi.fn(),
    loadConversation: vi.fn(),
    loadLatestConversation: vi.fn(),
    close: vi.fn(),
  };

  return {
    refreshApiKeyStatusesMock: vi.fn(),
    saveApiKeyMock: vi.fn(),
    removeApiKeyMock: vi.fn(),
    createReasoningTreeRepositoryMock: vi.fn(() => repositoryMock),
    repositoryMock,
  };
});

vi.mock("@/features/settings/api-key-bridge", () => ({
  refreshApiKeyStatuses: refreshApiKeyStatusesMock,
  saveApiKey: saveApiKeyMock,
  removeApiKey: removeApiKeyMock,
}));

vi.mock("@/features/reasoning-tree", async () => {
  const actual = await vi.importActual<typeof import("@/features/reasoning-tree")>(
    "@/features/reasoning-tree",
  );

  return {
    ...actual,
    createReasoningTreeRepository: createReasoningTreeRepositoryMock,
  };
});

import App from "./App";

const report: SynthesisReport = {
  id: "report-app-1",
  prompt: "Inspect the latest telemetry.",
  summary: "The report rendered successfully.",
  status: "partial",
  candidateMode: "single",
  pendingJudge: false,
  reportStage: "resolved",
  judgeStatus: "completed",
  executionPlan: null,
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

function createRestoredConversation(): LoadedConversation {
  return {
    conversation: {
      id: "conversation-app-1",
      title: "Inspect the latest telemetry.",
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
    },
    branches: [
      {
        id: "branch-app-1",
        conversationId: "conversation-app-1",
        name: "main",
        sourceNodeId: null,
        rootNodeId: "node-app-1",
        headNodeId: "node-app-1",
        createdAt: report.createdAt,
        updatedAt: report.createdAt,
      },
    ],
    nodes: [
      {
        id: "node-app-1",
        conversationId: "conversation-app-1",
        branchId: "branch-app-1",
        parentNodeId: null,
        title: "Inspect the latest telemetry.",
        prompt: report.prompt,
        status: "completed",
        synthesisReport: report,
        truthPanelSnapshot: snapshot,
        createdAt: report.createdAt,
        updatedAt: report.createdAt,
      },
    ],
    modelRuns: report.modelRuns,
  };
}

import { useSettingsStore } from "@/store/settings";

describe("App", () => {
  beforeEach(() => {
    appStore.setState(createInitialAppStoreState());
    useSettingsStore.setState({
      developerMode: true,
      isLeftPanelOpen: true,
      isRightPanelOpen: true,
    });
    refreshApiKeyStatusesMock.mockReset();
    saveApiKeyMock.mockReset();
    removeApiKeyMock.mockReset();
    createReasoningTreeRepositoryMock.mockClear();
    repositoryMock.createConversation.mockReset();
    repositoryMock.appendNode.mockReset();
    repositoryMock.forkNode.mockReset();
    repositoryMock.listConversations.mockReset();
    repositoryMock.loadConversation.mockReset();
    repositoryMock.loadLatestConversation.mockReset();
    repositoryMock.close.mockReset();

    refreshApiKeyStatusesMock.mockResolvedValue(undefined);
    repositoryMock.close.mockResolvedValue(undefined);
    repositoryMock.listConversations.mockResolvedValue([]);
    repositoryMock.loadLatestConversation.mockResolvedValue(null);
  });

  it("renders the product shell with workspace and inspector on mount", async () => {
    render(<App />);

    expect(
      await screen.findByText(/Ask a question and get a combined answer/i),
    ).toBeInTheDocument();
    // Explorer shows "Chat History" label
    expect(screen.getByText("Chat History")).toBeInTheDocument();
    // Right rail now keeps lightweight inspector copy
    expect(
      screen.getByText("The detailed model status and logs now live in the bottom diagnostics panel."),
    ).toBeInTheDocument();
    // Bottom bar is always present for opening diagnostics
    expect(screen.getByText(/API Pending/i)).toBeInTheDocument();
    // Repository is created on mount
    await waitFor(() => {
      expect(createReasoningTreeRepositoryMock).toHaveBeenCalledTimes(1);
    });
  });

  it("opens settings modal with provider access when gear icon is clicked", async () => {
    render(<App />);

    await screen.findByText(/Ask a question and get a combined answer/i);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    // Settings modal should be visible with "Model providers" tab
    expect(await screen.findByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Model providers")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("toggles the bottom diagnostics panel from the status bar", async () => {
    repositoryMock.loadLatestConversation.mockResolvedValue(createRestoredConversation());
    repositoryMock.listConversations.mockResolvedValue([
      {
        id: "conversation-app-1",
        title: "Inspect the latest telemetry.",
        updatedAt: report.createdAt,
        branchCount: 1,
        nodeCount: 1,
        latestNodeStatus: "completed",
      },
    ]);

    render(<App />);

    // Wait for report content to appear (merged answer from resolution)
    expect(
      await screen.findByText(/Keep diagnostics in the right rail/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /API Pending/i }));

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(true);
    });
    expect(screen.getByRole("heading", { level: 2, name: "Model status" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hide details/i }));

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(false);
    });
    expect(screen.queryByRole("heading", { level: 2, name: "Model status" })).not.toBeInTheDocument();
  });
});
