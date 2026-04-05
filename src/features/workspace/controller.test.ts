import { describe, expect, it, vi } from "vitest";

import {
  buildExecutionPlanFromModelSelection,
  buildExecutionPlanFromPreset,
} from "@/features/consensus";
import { buildModelCatalogRecord } from "@/features/settings/providers";
import {
  resolveWorkspaceRunMode,
  runWorkspaceSynthesis,
  type WorkspaceRunResult,
} from "@/features/workspace";
import type { ApiKeyStatus } from "@/store";

const configuredStatus: ApiKeyStatus = {
  configured: true,
  lastCheckedAt: "2026-03-18T00:00:00.000Z",
  error: null,
};

const missingStatus: ApiKeyStatus = {
  configured: false,
  lastCheckedAt: "2026-03-18T00:00:00.000Z",
  error: null,
};

const stubResult: WorkspaceRunResult = {
  effectiveMode: "mock",
  report: {
    id: "report-1",
    prompt: "Design module 7.",
    summary: "Keep the synthesis report in the center column.",
    status: "ready",
    candidateMode: "single",
    pendingJudge: false,
    reportStage: "resolved",
    judgeStatus: "completed",
    executionPlan: null,
    consensus: {
      summary: "The workspace should stay report-first.",
      items: [],
    },
    conflicts: [],
    resolution: {
      summary: "Use a report-first workspace.",
      rationale: "It preserves progressive disclosure.",
      chosenApproach: "Center the synthesis report and hide raw runs behind drill-down.",
      resolvedConflictIds: [],
      judgeModelRunId: "run-judge-1",
      openRisks: [],
    },
    nextActions: ["Ship the center-column workspace."],
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
        rawText: "{\"outputType\":\"judge\"}",
        parsed: {
          outputType: "judge",
          summary: "Use a report-first workspace.",
          chosenApproach: "Center the synthesis report and hide raw runs behind drill-down.",
          rationale: "It preserves progressive disclosure.",
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
  },
  truthPanelSnapshot: {
    reportId: "report-1",
    generatedAt: "2026-03-18T00:00:01.000Z",
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
    runs: [],
    validationIssues: [],
    events: [],
  },
};

describe("workspace controller helpers", () => {
  it("selects real mode when all preset providers are configured", () => {
    expect(
      resolveWorkspaceRunMode({
        openrouter: configuredStatus,
      }),
    ).toBe("real");
  });

  it("falls back to mock mode when any required provider is missing", () => {
    expect(
      resolveWorkspaceRunMode({
        openrouter: missingStatus,
      }),
    ).toBe("mock");
  });

  it("injects the default mock registry when Auto resolves to mock", async () => {
    const runSynthesisImpl = vi.fn().mockResolvedValue(stubResult);
    const createMockRegistry = vi.fn().mockReturnValue({
      strong: {} as never,
      "fast-1": {} as never,
      "fast-2": {} as never,
      judge: {} as never,
    });

    const result = await runWorkspaceSynthesis("Draft module 7", {
      apiKeyStatuses: {
        openrouter: missingStatus,
      },
      runSynthesisImpl,
      createMockRegistry,
    });

    expect(result.effectiveMode).toBe("mock");
    const executionPlan = buildExecutionPlanFromPreset("freeDefault", "auto");
    expect(createMockRegistry).toHaveBeenCalledWith(executionPlan);
    expect(runSynthesisImpl).toHaveBeenCalledWith(
      {
        prompt: "Draft module 7",
        mode: "mock",
        presetId: "freeDefault",
        executionPlan,
        judgeMode: undefined,
        language: undefined,
      },
      {
        mockRegistry: createMockRegistry.mock.results[0]?.value,
      },
    );
  });

  it("supports custom execution plans when the selected models do not match a preset exactly", async () => {
    const runSynthesisImpl = vi.fn().mockResolvedValue(stubResult);
    const executionPlan = buildExecutionPlanFromModelSelection({
      modelCatalog: buildModelCatalogRecord({
        providerConfiguredMap: {
          openrouter: true,
          ollama: true,
        },
        discoveredModels: {
          ollama: [
            {
              id: "ollama:deepseek-r1:8b",
              modelId: "deepseek-r1:8b",
              label: "deepseek-r1:8b",
              sizeBytes: 123,
              modifiedAt: "2026-03-18T00:00:00.000Z",
            },
          ],
        },
      }),
      selection: {
        candidateModelIds: ["openrouter:openrouter/free", "ollama:deepseek-r1:8b"],
        judgeModelId: "openrouter:openrouter/free",
      },
      conflictMode: "manual",
      label: "Custom",
    });

    const result = await runWorkspaceSynthesis("Draft module 7", {
      apiKeyStatuses: {
        openrouter: configuredStatus,
        ollama: configuredStatus,
      },
      executionPlan,
      runSynthesisImpl,
    });

    expect(result.effectiveMode).toBe("real");
    expect(runSynthesisImpl).toHaveBeenCalledWith({
      prompt: "Draft module 7",
      mode: "real",
      presetId: "freeDefault",
      executionPlan,
      judgeMode: undefined,
      language: undefined,
    });
  });

  it("runs without a mock registry when Auto resolves to real", async () => {
    const runSynthesisImpl = vi.fn().mockResolvedValue(stubResult);

    const result = await runWorkspaceSynthesis("Draft module 7", {
      apiKeyStatuses: {
        openrouter: configuredStatus,
      },
      runSynthesisImpl,
    });

    expect(result.effectiveMode).toBe("real");
    const executionPlan = buildExecutionPlanFromPreset("freeDefault", "auto");
    expect(runSynthesisImpl).toHaveBeenCalledWith({
      prompt: "Draft module 7",
      mode: "real",
      presetId: "freeDefault",
      executionPlan,
      judgeMode: undefined,
      language: undefined,
    });
  });
});
