import {
  createAppStore,
  selectActivePath,
  selectApiKeyStatus,
  selectLatestSynthesisReport,
  selectProviderModelCatalog,
  selectTruthPanelState,
  useAppStore,
  type ApiKeyStatus,
} from "@/store";
import { buildModelCatalogRecord } from "@/features/settings/providers";
import type { ModelRun, SynthesisReport, TruthPanelSnapshot } from "@/schema";

const startedAt = "2026-03-17T10:00:00Z";
const completedAt = "2026-03-17T10:01:00Z";
const generatedAt = "2026-03-17T10:02:00Z";

const judgeRun: ModelRun = {
  id: "run-judge-1",
  provider: "openai",
  model: "gpt-5.4",
  role: "judge",
  status: "completed",
  startedAt,
  completedAt,
  latencyMs: 1000,
  usage: {
    inputTokens: 120,
    outputTokens: 80,
    totalTokens: 200,
  },
  rawText: "Judge output",
  parsed: {
    outputType: "judge",
    summary: "Use a strict schema barrel.",
    chosenApproach: "Centralize all schema exports.",
    rationale: "Downstream modules should not redefine data contracts.",
    resolvedConflictIds: [],
    openRisks: [],
  },
  validation: {
    status: "passed",
    issues: [],
  },
  error: null,
};

const report: SynthesisReport = {
  id: "report-1",
  prompt: "Design the store skeleton for Phase 1.",
  summary: "The state layer should stay pure and IO-free.",
  status: "ready",
  candidateMode: "single",
  pendingJudge: false,
  reportStage: "resolved",
  judgeStatus: "completed",
  executionPlan: null,
  consensus: {
    summary: "A single Zustand store with slices keeps the MVP extensible.",
    items: [],
  },
  conflicts: [],
  resolution: {
    summary: "Keep the store IO-free and slice-based.",
    rationale: "This preserves a stable shape for upcoming modules.",
    chosenApproach: "Single app store with flat state and grouped actions.",
    resolvedConflictIds: [],
    judgeModelRunId: "run-judge-1",
    openRisks: [],
  },
  nextActions: ["Wire real keychain and PGLite integrations in later modules."],
  modelRuns: [judgeRun],
  createdAt: generatedAt,
};

const snapshot: TruthPanelSnapshot = {
  reportId: report.id,
  generatedAt,
  runSummary: {
    totalRuns: 1,
    pendingRuns: 0,
    runningRuns: 0,
    completedRuns: 1,
    failedRuns: 0,
    aggregateInputTokens: 120,
    aggregateOutputTokens: 80,
    aggregateTotalTokens: 200,
    aggregateLatencyMs: 1000,
    maxLatencyMs: 1000,
  },
  runs: [judgeRun],
  validationIssues: [],
  events: [
    {
      id: "trace-1",
      scope: "store",
      level: "info",
      message: "Snapshot recorded.",
      occurredAt: generatedAt,
    },
  ],
};

const openAiStatus: ApiKeyStatus = {
  configured: true,
  lastCheckedAt: generatedAt,
  error: null,
};

const anthropicStatus: ApiKeyStatus = {
  configured: false,
  lastCheckedAt: null,
  error: "missing key",
};

describe("app store", () => {
  it("creates the expected initial state", () => {
    const store = createAppStore();
    const state = store.getState();

    expect(state.currentConversationId).toBeNull();
    expect(state.currentBranchId).toBeNull();
    expect(state.currentNodeId).toBeNull();
    expect(state.latestSynthesisReport).toBeNull();
    expect(state.runStatus).toBe("idle");
    expect(state.runtimeErrorMessage).toBeNull();
    expect(state.lastRunCompletedAt).toBeNull();
    expect(state.isTruthPanelOpen).toBe(false);
    expect(state.truthPanelSnapshot).toBeNull();
    expect(state.apiKeyStatuses).toEqual({});
    expect(state.modelCatalog).toEqual(buildModelCatalogRecord());
  });

  it("merges preloaded state without losing defaults", () => {
    const store = createAppStore({
      currentConversationId: "conversation-1",
      apiKeyStatuses: {
        openai: openAiStatus,
      },
    });

    const state = store.getState();

    expect(state.currentConversationId).toBe("conversation-1");
    expect(state.currentBranchId).toBeNull();
    expect(state.apiKeyStatuses).toEqual({ openai: openAiStatus });
    expect(state.modelCatalog.openai).toEqual([
      {
        id: "openai:gpt-5-mini",
        provider: "openai",
        modelId: "gpt-5-mini",
        label: "GPT-5 Mini",
        sizeBytes: null,
        modifiedAt: null,
        source: "paid",
        availability: "setup_required",
        supportsCandidate: true,
        supportsJudge: true,
      },
      {
        id: "openai:gpt-5.2",
        provider: "openai",
        modelId: "gpt-5.2",
        label: "GPT-5.2",
        sizeBytes: null,
        modifiedAt: null,
        source: "paid",
        availability: "setup_required",
        supportsCandidate: true,
        supportsJudge: true,
      },
    ]);
    expect(state.runStatus).toBe("idle");
  });

  it("updates active path and workspace state", () => {
    const store = createAppStore();

    store.getState().setActivePath({
      currentConversationId: "conversation-1",
      currentBranchId: "branch-1",
      currentNodeId: "node-1",
    });
    expect(selectActivePath(store.getState())).toEqual({
      currentConversationId: "conversation-1",
      currentBranchId: "branch-1",
      currentNodeId: "node-1",
    });

    store.getState().setCurrentConversation("conversation-2");
    store.getState().setCurrentBranch("branch-2");
    store.getState().setCurrentNode("node-2");
    store.getState().setLatestSynthesisReport(report);

    expect(selectActivePath(store.getState())).toEqual({
      currentConversationId: "conversation-2",
      currentBranchId: "branch-2",
      currentNodeId: "node-2",
    });
    expect(selectLatestSynthesisReport(store.getState())).toEqual(report);

    store.getState().resetWorkspace();

    expect(selectActivePath(store.getState())).toEqual({
      currentConversationId: null,
      currentBranchId: null,
      currentNodeId: null,
    });
    expect(selectLatestSynthesisReport(store.getState())).toBeNull();
  });

  it("manages runtime lifecycle without clearing the last report on failure", () => {
    const store = createAppStore();

    store.getState().setLatestSynthesisReport(report);
    store.getState().failRun("existing error");
    expect(store.getState().runtimeErrorMessage).toBe("existing error");

    store.getState().beginRun();
    expect(store.getState().runStatus).toBe("running");
    expect(store.getState().runtimeErrorMessage).toBeNull();
    expect(store.getState().lastRunCompletedAt).toBeNull();

    store.getState().failRun("provider timeout");
    expect(store.getState().runStatus).toBe("failed");
    expect(store.getState().runtimeErrorMessage).toBe("provider timeout");
    expect(selectLatestSynthesisReport(store.getState())).toEqual(report);

    store.getState().completeRun(report);
    expect(store.getState().runStatus).toBe("completed");
    expect(store.getState().runtimeErrorMessage).toBeNull();
    expect(store.getState().lastRunCompletedAt).toBe(report.createdAt);
    expect(selectLatestSynthesisReport(store.getState())).toEqual(report);

    store.getState().resetRuntime();
    expect(store.getState().runStatus).toBe("idle");
    expect(store.getState().runtimeErrorMessage).toBeNull();
    expect(store.getState().lastRunCompletedAt).toBeNull();
  });

  it("manages truth panel state", () => {
    const store = createAppStore();

    expect(selectTruthPanelState(store.getState())).toEqual({
      isTruthPanelOpen: false,
      truthPanelSnapshot: null,
    });

    store.getState().openTruthPanel();
    expect(store.getState().isTruthPanelOpen).toBe(true);

    store.getState().setTruthPanelSnapshot(snapshot);
    expect(selectTruthPanelState(store.getState())).toEqual({
      isTruthPanelOpen: true,
      truthPanelSnapshot: snapshot,
    });

    store.getState().toggleTruthPanel();
    expect(store.getState().isTruthPanelOpen).toBe(false);

    store.getState().closeTruthPanel();
    expect(store.getState().isTruthPanelOpen).toBe(false);

    store.getState().clearTruthPanelSnapshot();
    expect(store.getState().truthPanelSnapshot).toBeNull();
  });

  it("manages API key status by provider", () => {
    const store = createAppStore();

    store.getState().setApiKeyStatus("openai", openAiStatus);
    expect(selectApiKeyStatus("openai")(store.getState())).toEqual(openAiStatus);

    store.getState().setApiKeyStatuses({
      openai: openAiStatus,
      anthropic: anthropicStatus,
    });
    expect(store.getState().apiKeyStatuses).toEqual({
      openai: openAiStatus,
      anthropic: anthropicStatus,
    });

    store.getState().clearApiKeyStatus("anthropic");
    expect(store.getState().apiKeyStatuses).toEqual({
      openai: openAiStatus,
    });

    store.getState().resetApiKeyStatuses();
    expect(store.getState().apiKeyStatuses).toEqual({});
  });

  it("manages the shared model catalog", () => {
    const store = createAppStore();
    const ollamaModels = [
      {
        id: "ollama:qwen3:8b",
        provider: "ollama" as const,
        modelId: "qwen3:8b",
        label: "qwen3:8b",
        sizeBytes: 123,
        modifiedAt: "2026-03-17T10:00:00Z",
        source: "local" as const,
        availability: "ready" as const,
        supportsCandidate: true,
        supportsJudge: true,
      },
    ];

    store.getState().setProviderModelCatalog("ollama", ollamaModels);
    expect(selectProviderModelCatalog("ollama")(store.getState())).toEqual(ollamaModels);

    const replacementCatalog = buildModelCatalogRecord({
      providerConfiguredMap: {
        openrouter: true,
        ollama: true,
      },
      discoveredModels: {
        ollama: [
          {
            id: "ollama:llama3.2:latest",
            modelId: "llama3.2:latest",
            label: "llama3.2:latest",
            sizeBytes: 456,
            modifiedAt: "2026-03-17T10:10:00Z",
          },
        ],
      },
    });

    store.getState().setModelCatalog(replacementCatalog);
    expect(store.getState().modelCatalog).toEqual(replacementCatalog);

    store.getState().resetModelCatalog();
    expect(store.getState().modelCatalog).toEqual(buildModelCatalogRecord());
  });

  it("exports the shared hook and selectors from the store barrel", () => {
    const store = createAppStore();

    expect(typeof useAppStore).toBe("function");
    expect(selectApiKeyStatus("openai")(store.getState())).toBeUndefined();
    expect(selectProviderModelCatalog("ollama")(store.getState())).toEqual([]);
  });
});
