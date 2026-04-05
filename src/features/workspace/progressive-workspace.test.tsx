import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";
import type { LoadedConversation } from "@/schema";

const { runSynthesisMock, createReasoningTreeRepositoryMock, repositoryMock } = vi.hoisted(() => {
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
    runSynthesisMock: vi.fn(),
    createReasoningTreeRepositoryMock: vi.fn(() => repositoryMock),
    repositoryMock,
  };
});

vi.mock("@/features/consensus", async () => {
  const actual = await vi.importActual<typeof import("@/features/consensus")>(
    "@/features/consensus",
  );

  return {
    ...actual,
    runSynthesis: runSynthesisMock,
  };
});

vi.mock("@/features/reasoning-tree", async () => {
  const actual = await vi.importActual<typeof import("@/features/reasoning-tree")>(
    "@/features/reasoning-tree",
  );

  return {
    ...actual,
    createReasoningTreeRepository: createReasoningTreeRepositoryMock,
  };
});

import { ProgressiveWorkspace, GlobalInputShell, useWorkspaceController } from "@/features/workspace";
import { useSettingsStore } from "@/store/settings";

function TestWorkspace() {
  const controller = useWorkspaceController();
  return (
    <div>
      <ProgressiveWorkspace controller={controller} />
      <GlobalInputShell controller={controller} />
    </div>
  );
}

const report = {
  id: "report-module-9",
  prompt: "Build module 9.",
  summary: "Persist the workspace output and recover the latest local conversation.",
  status: "partial" as const,
  candidateMode: "dual" as const,
  pendingJudge: false,
  reportStage: "resolved" as const,
  judgeStatus: "completed" as const,
  executionPlan: null,
  consensus: {
    summary: "The MVP should restore persisted conversations before allowing new submissions.",
    items: [
      {
        id: "consensus-1",
        kind: "approach" as const,
        statement: "Hydrate the workspace from the latest persisted branch head on startup.",
        confidence: "high" as const,
        supportingRunIds: ["run-strong-1", "run-fast-1"],
      },
    ],
  },
  conflicts: [
    {
      id: "conflict-1",
      title: "When to persist the node",
      summary: "One model prefers immediate store writes while the other insists on DB round-trips.",
      category: "approach" as const,
      severity: "high" as const,
      question: "Should the UI trust in-memory results before persistence completes?",
      positions: [
        {
          modelRunId: "run-strong-1",
          label: "anthropic / claude-sonnet-4-20250514",
          stance: "No. Read the persisted head back before updating the workspace.",
          evidence: "Strong candidate summary",
        },
        {
          modelRunId: "run-fast-2",
          label: "google / gemini-2.5-flash",
          stance: "Yes. Update the store first and persist later.",
          evidence: "Fast candidate summary",
        },
      ],
    },
  ],
  resolution: {
    summary: "Persist first, then hydrate the workspace from the stored node.",
    rationale: "The MVP should treat the reasoning tree as the local source of truth.",
    chosenApproach:
      "Write the node into PGLite, reload the conversation, and render the recovered branch head.",
    resolvedConflictIds: ["conflict-1"],
    judgeModelRunId: "run-judge-1",
    openRisks: ["Explorer and fork UI still land after Phase 1."],
  },
  nextActions: ["Verify startup recovery and failed-node persistence in Module 9."],
  modelRuns: [
    {
      id: "run-strong-1",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      role: "strong" as const,
      status: "completed" as const,
      startedAt: "2026-03-18T00:00:00.000Z",
      completedAt: "2026-03-18T00:00:02.000Z",
      latencyMs: 2000,
      usage: {
        inputTokens: 480,
        outputTokens: 168,
        totalTokens: 648,
      },
      rawText: "{\"summary\":\"Strong run\"}",
      parsed: {
        outputType: "candidate" as const,
        summary: "Strong run",
        consensusItems: [],
        conflictObservations: [],
        recommendedActions: [],
      },
      validation: {
        status: "passed" as const,
        issues: [],
      },
      error: null,
    },
    {
      id: "run-judge-1",
      provider: "openai",
      model: "gpt-5.2",
      role: "judge" as const,
      status: "completed" as const,
      startedAt: "2026-03-18T00:00:02.000Z",
      completedAt: "2026-03-18T00:00:03.000Z",
      latencyMs: 1000,
      usage: {
        inputTokens: 620,
        outputTokens: 190,
        totalTokens: 810,
      },
      rawText: "{\"summary\":\"Judge run\"}",
      parsed: {
        outputType: "judge" as const,
        summary: "Judge run",
        chosenApproach:
          "Write the node into PGLite, reload the conversation, and render the recovered branch head.",
        rationale: "The MVP should treat the reasoning tree as the local source of truth.",
        resolvedConflictIds: ["conflict-1"],
        openRisks: [],
      },
      validation: {
        status: "passed" as const,
        issues: [],
      },
      error: null,
    },
  ],
  createdAt: "2026-03-18T00:00:03.000Z",
};

const truthPanelSnapshot = {
  reportId: report.id,
  generatedAt: report.createdAt,
  runSummary: {
    totalRuns: 2,
    pendingRuns: 0,
    runningRuns: 0,
    completedRuns: 2,
    failedRuns: 0,
    aggregateInputTokens: 1100,
    aggregateOutputTokens: 358,
    aggregateTotalTokens: 1458,
    aggregateLatencyMs: 3000,
    maxLatencyMs: 2000,
  },
  runs: report.modelRuns,
  validationIssues: [],
  events: [
    {
      id: "trace-restore-1",
      scope: "workspace",
      level: "info" as const,
      message: "Recovered the latest local conversation.",
      occurredAt: report.createdAt,
    },
  ],
};

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function createConversationSnapshot(options: {
  conversationId?: string;
  branchId?: string;
  nodeId?: string;
  nodeStatus?: "completed" | "failed";
  reportOverride?: typeof report | null;
  snapshotOverride?: typeof truthPanelSnapshot | null;
} = {}): LoadedConversation {
  const conversationId = options.conversationId ?? "conversation-module-9";
  const branchId = options.branchId ?? "branch-main-module-9";
  const nodeId = options.nodeId ?? "node-module-9";
  const nodeStatus = options.nodeStatus ?? "completed";
  const reportOverride =
    Object.prototype.hasOwnProperty.call(options, "reportOverride") ?
      (options.reportOverride ?? null)
    : report;
  const snapshotOverride =
    Object.prototype.hasOwnProperty.call(options, "snapshotOverride") ?
      (options.snapshotOverride ?? null)
    : truthPanelSnapshot;
  const nodeTimestamp = reportOverride?.createdAt ?? "2026-03-18T00:00:04.000Z";

  return {
    conversation: {
      id: conversationId,
      title: "Build module 9.",
      createdAt: report.createdAt,
      updatedAt: nodeTimestamp,
    },
    branches: [
      {
        id: branchId,
        conversationId,
        name: "main",
        sourceNodeId: null,
        rootNodeId: nodeId,
        headNodeId: nodeId,
        createdAt: report.createdAt,
        updatedAt: nodeTimestamp,
      },
    ],
    nodes: [
      {
        id: nodeId,
        conversationId,
        branchId,
        parentNodeId: null,
        title: "Build module 9.",
        prompt: reportOverride?.prompt ?? "Build module 9.",
        status: nodeStatus,
        synthesisReport: reportOverride,
        truthPanelSnapshot: snapshotOverride,
        createdAt: nodeTimestamp,
        updatedAt: nodeTimestamp,
      },
    ],
    modelRuns: reportOverride?.modelRuns ?? [],
  };
}

function createEmptyConversation(options: {
  conversationId?: string;
  branchId?: string;
  title?: string;
  createdAt?: string;
} = {}): LoadedConversation {
  const conversationId = options.conversationId ?? "conversation-module-9";
  const branchId = options.branchId ?? "branch-main-module-9";
  const createdAt = options.createdAt ?? report.createdAt;

  return {
    conversation: {
      id: conversationId,
      title: options.title ?? "Build module 9.",
      createdAt,
      updatedAt: createdAt,
    },
    branches: [
      {
        id: branchId,
        conversationId,
        name: "main",
        sourceNodeId: null,
        rootNodeId: null,
        headNodeId: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    nodes: [],
    modelRuns: [],
  };
}

describe("ProgressiveWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      developerMode: true,
      judgeMode: "auto",
      defaultPresetId: "freeDefault",
    });
    runSynthesisMock.mockReset();
    createReasoningTreeRepositoryMock.mockClear();
    repositoryMock.createConversation.mockReset();
    repositoryMock.appendNode.mockReset();
    repositoryMock.forkNode.mockReset();
    repositoryMock.listConversations.mockReset();
    repositoryMock.loadConversation.mockReset();
    repositoryMock.loadLatestConversation.mockReset();
    repositoryMock.close.mockReset();
    repositoryMock.close.mockResolvedValue(undefined);
    repositoryMock.listConversations.mockResolvedValue([]);
    repositoryMock.loadLatestConversation.mockResolvedValue(null);

    appStore.setState(
      createInitialAppStoreState({
        apiKeyStatuses: {
          openai: {
            configured: true,
            lastCheckedAt: "2026-03-18T00:00:00.000Z",
            error: null,
          },
          anthropic: {
            configured: true,
            lastCheckedAt: "2026-03-18T00:00:00.000Z",
            error: null,
          },
          google: {
            configured: false,
            lastCheckedAt: "2026-03-18T00:00:00.000Z",
            error: null,
          },
          openrouter: {
            configured: false,
            lastCheckedAt: "2026-03-18T00:00:00.000Z",
            error: null,
          },
          ollama: {
            configured: false,
            lastCheckedAt: "2026-03-18T00:00:00.000Z",
            error: null,
          },
        },
      }),
    );
  });

  it("restores the latest persisted conversation on mount", async () => {
    const restoredConversation = createConversationSnapshot();
    repositoryMock.loadLatestConversation.mockResolvedValue(restoredConversation);

    render(<TestWorkspace />);

    // Report summary should be visible inside the accordion (default open)
    expect(
      await screen.findByText(
        /Persist the workspace output and recover the latest local conversation/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(appStore.getState().currentConversationId).toBe("conversation-module-9");
      expect(appStore.getState().currentBranchId).toBe("branch-main-module-9");
      expect(appStore.getState().currentNodeId).toBe("node-module-9");
      expect(appStore.getState().latestSynthesisReport).toEqual(report);
      expect(appStore.getState().truthPanelSnapshot).toEqual(truthPanelSnapshot);
    });
  });

  it("shows bootstrap loading, then persists the recovered node before updating the workspace", async () => {
    const bootstrapDeferred = createDeferredPromise<LoadedConversation | null>();
    const runDeferred = createDeferredPromise<{
      report: typeof report;
      truthPanelSnapshot: typeof truthPanelSnapshot;
    }>();
    const createdConversation = createEmptyConversation();
    const persistedConversation = createConversationSnapshot();

    repositoryMock.loadLatestConversation.mockReturnValue(bootstrapDeferred.promise);
    repositoryMock.createConversation.mockResolvedValue(createdConversation);
    repositoryMock.appendNode.mockResolvedValue(persistedConversation.nodes[0]);
    repositoryMock.loadConversation.mockResolvedValue(persistedConversation);
    runSynthesisMock.mockReturnValue(runDeferred.promise);

    render(<TestWorkspace />);

    expect(screen.getByText("Loading your latest saved analysis.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restoring/i })).toBeDisabled();
    expect(screen.getByLabelText("Question")).toBeDisabled();

    bootstrapDeferred.resolve(null);

    const promptField = await screen.findByLabelText("Question");
    await waitFor(() => {
      expect(promptField).not.toBeDisabled();
    });

    fireEvent.change(promptField, { target: { value: "Build module 9." } });
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(runSynthesisMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: /Running/i })).toBeDisabled();

    runDeferred.resolve({
      report,
      truthPanelSnapshot,
    });

    // Report summary is visible in the report header
    expect(
      await screen.findByText(
        /Persist the workspace output and recover the latest local conversation/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(repositoryMock.appendNode).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-module-9",
          branchId: "branch-main-module-9",
          status: "completed",
          synthesisReport: report,
          truthPanelSnapshot,
        }),
      );
      expect(appStore.getState().latestSynthesisReport).toEqual(report);
      expect(appStore.getState().truthPanelSnapshot).toEqual(truthPanelSnapshot);
      expect(appStore.getState().currentNodeId).toBe("node-module-9");
    });

    // Candidate output is visible in the split view panel
    expect(screen.getByText("Strong run")).toBeInTheDocument();
  });

  it("persists a failed node when execution throws and keeps the previous report visible", async () => {
    const restoredConversation = createConversationSnapshot();
    const failedConversation = createConversationSnapshot({
      nodeId: "node-module-9-failed",
      nodeStatus: "failed",
      reportOverride: null,
      snapshotOverride: null,
    });

    repositoryMock.loadLatestConversation.mockResolvedValue(restoredConversation);
    repositoryMock.loadConversation.mockResolvedValue(failedConversation);
    repositoryMock.appendNode.mockResolvedValue(failedConversation.nodes[0]);
    runSynthesisMock.mockRejectedValue(new Error("transport down"));

    render(<TestWorkspace />);

    // Wait for report to render
    expect(
      await screen.findByText(
        /Persist the workspace output and recover the latest local conversation/i,
      ),
    ).toBeInTheDocument();

    const promptField = screen.getByLabelText("Question");
    fireEvent.change(promptField, { target: { value: "Retry module 9." } });
    // Use Cmd+Enter to submit (the Commit button doesn't have "Analyze question" anymore)
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    expect(await screen.findByText("transport down")).toBeInTheDocument();

    await waitFor(() => {
      expect(repositoryMock.appendNode).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          synthesisReport: null,
          truthPanelSnapshot: null,
        }),
      );
      expect(appStore.getState().runtimeErrorMessage).toBe("transport down");
      expect(appStore.getState().latestSynthesisReport).toEqual(report);
      expect(appStore.getState().truthPanelSnapshot).toEqual(truthPanelSnapshot);
      expect(appStore.getState().currentNodeId).toBe("node-module-9-failed");
    });
  });

  it("surfaces bootstrap restore errors without blocking a new submission", async () => {
    const createdConversation = createEmptyConversation({
      conversationId: "conversation-module-9-error",
      branchId: "branch-main-module-9-error",
    });
    const persistedConversation = createConversationSnapshot({
      conversationId: "conversation-module-9-error",
      branchId: "branch-main-module-9-error",
      nodeId: "node-module-9-error",
    });

    repositoryMock.loadLatestConversation.mockRejectedValue(new Error("idb unavailable"));
    repositoryMock.createConversation.mockResolvedValue(createdConversation);
    repositoryMock.appendNode.mockResolvedValue(persistedConversation.nodes[0]);
    repositoryMock.loadConversation.mockResolvedValue(persistedConversation);
    runSynthesisMock.mockResolvedValue({
      report,
      truthPanelSnapshot,
    });

    render(<TestWorkspace />);

    expect(
      await screen.findByText("Unable to restore the latest local conversation. idb unavailable"),
    ).toBeInTheDocument();

    const promptField = screen.getByLabelText("Question");
    await waitFor(() => {
      expect(promptField).not.toBeDisabled();
    });

    fireEvent.change(promptField, { target: { value: "Build module 9 after restore failure." } });
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    expect(
      await screen.findByText(
        /Persist the workspace output and recover the latest local conversation/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(appStore.getState().runtimeErrorMessage).toBeNull();
      expect(appStore.getState().currentConversationId).toBe("conversation-module-9-error");
    });
  });

  it("submits using the selected preset for the next run", async () => {
    const createdConversation = createEmptyConversation();
    const persistedConversation = createConversationSnapshot();

    repositoryMock.createConversation.mockResolvedValue(createdConversation);
    repositoryMock.appendNode.mockResolvedValue(persistedConversation.nodes[0]);
    repositoryMock.loadConversation.mockResolvedValue(persistedConversation);
    runSynthesisMock.mockResolvedValue({
      report,
      truthPanelSnapshot,
    });

    render(<TestWorkspace />);

    const promptField = await screen.findByLabelText("Question");
    // Open preset picker and select Cross-vendor
    fireEvent.click(screen.getByText(/Free-first/i));
    await waitFor(() => {
      expect(screen.getByText("Cross-vendor")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cross-vendor"));

    fireEvent.change(promptField, { target: { value: "Compare the premium providers." } });
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(runSynthesisMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Compare the premium providers.",
          presetId: "crossVendorDefault",
        }),
        expect.objectContaining({
          mockRegistry: expect.any(Object),
        }),
      );
    });
  });

  it("submits a custom execution plan after directly changing candidate and judge models", async () => {
    const createdConversation = createEmptyConversation();
    const persistedConversation = createConversationSnapshot();

    repositoryMock.createConversation.mockResolvedValue(createdConversation);
    repositoryMock.appendNode.mockResolvedValue(persistedConversation.nodes[0]);
    repositoryMock.loadConversation.mockResolvedValue(persistedConversation);
    runSynthesisMock.mockResolvedValue({
      report,
      truthPanelSnapshot,
    });

    render(<TestWorkspace />);

    const promptField = await screen.findByLabelText("Question");
    fireEvent.click(screen.getByText(/Free-first/i));

    await waitFor(() => {
      expect(screen.getByText("Run Setup")).toBeInTheDocument();
    });

    const countButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "3",
    );
    expect(countButton).toBeTruthy();
    fireEvent.click(countButton!);

    const selectors = Array.from(document.querySelectorAll("select"));
    expect(selectors).toHaveLength(4);

    fireEvent.change(selectors[1], {
      target: { value: "openai:gpt-5-mini" },
    });
    fireEvent.change(selectors[3], {
      target: { value: "anthropic:claude-sonnet-4-20250514" },
    });

    fireEvent.change(promptField, { target: { value: "Compare a custom model mix." } });
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(runSynthesisMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Compare a custom model mix.",
          presetId: "freeDefault",
          executionPlan: expect.objectContaining({
            source: {
              kind: "custom",
              label: null,
            },
            candidateSlots: expect.arrayContaining([
              expect.objectContaining({
                id: "fast-1",
                provider: "openai",
                modelId: "gpt-5-mini",
              }),
            ]),
            judgeSlot: expect.objectContaining({
              provider: "anthropic",
              modelId: "claude-sonnet-4-20250514",
            }),
          }),
        }),
        expect.objectContaining({
          mockRegistry: expect.any(Object),
        }),
      );
    });

    expect(window.localStorage.getItem("alae.workspace.selectedPresetId")).toBeNull();
    expect(window.localStorage.getItem("alae.workspace.selectedExecutionPlan")).toContain(
      "\"kind\":\"custom\"",
    );
  });

  it("restores the previously selected preset from local storage", async () => {
    window.localStorage.setItem("alae.workspace.selectedPresetId", "crossVendorDefault");

    render(<TestWorkspace />);

    // Preset label should show near the input
    await waitFor(() => {
      expect(screen.getByText("Cross-vendor")).toBeInTheDocument();
    });
  });

  it("persists preset changes for the next session", async () => {
    window.localStorage.setItem(
      "alae.workspace.selectedExecutionPlan",
      JSON.stringify({
        version: 1,
        candidateSlots: [
          {
            id: "strong",
            provider: "openrouter",
            modelId: "openrouter/free",
            role: "strong",
            outputType: "candidate",
          },
        ],
        judgeSlot: null,
        conflictMode: "auto",
        source: {
          kind: "custom",
          label: null,
        },
      }),
    );

    render(<TestWorkspace />);

    // Start from a restored custom setup, then switch back to a template.
    const presetLabel = await screen.findByText(/Custom setup/i);
    fireEvent.click(presetLabel);

    await waitFor(() => {
      expect(screen.getByText("Cross-vendor")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cross-vendor"));

    await waitFor(() => {
      expect(window.localStorage.getItem("alae.workspace.selectedPresetId")).toBe(
        "crossVendorDefault",
      );
      expect(window.localStorage.getItem("alae.workspace.selectedExecutionPlan")).toBeNull();
    });
  });

  it("restores a previously saved custom execution plan before falling back to presets", async () => {
    window.localStorage.setItem("alae.workspace.selectedPresetId", "crossVendorDefault");
    window.localStorage.setItem(
      "alae.workspace.selectedExecutionPlan",
      JSON.stringify({
        version: 1,
        candidateSlots: [
          {
            id: "strong",
            provider: "openrouter",
            modelId: "openrouter/free",
            role: "strong",
            outputType: "candidate",
          },
          {
            id: "fast-1",
            provider: "openai",
            modelId: "gpt-5-mini",
            role: "fast",
            outputType: "candidate",
          },
        ],
        judgeSlot: {
          id: "judge",
          provider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          role: "judge",
          outputType: "judge",
        },
        conflictMode: "manual",
        source: {
          kind: "custom",
          label: null,
        },
      }),
    );

    render(<TestWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Custom setup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Custom setup"));

    await waitFor(() => {
      expect(screen.getByText("Run Setup")).toBeInTheDocument();
    });

    const selectors = Array.from(document.querySelectorAll("select"));
    expect(selectors).toHaveLength(3);
    expect((selectors[0] as HTMLSelectElement).value).toBe("openrouter:openrouter/free");
    expect((selectors[1] as HTMLSelectElement).value).toBe("openai:gpt-5-mini");
    expect((selectors[2] as HTMLSelectElement).value).toBe(
      "anthropic:claude-sonnet-4-20250514",
    );
  });
});
