import { describe, expect, it, vi } from "vitest";

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
    expect(createMockRegistry).toHaveBeenCalledWith("freeDefault");
    expect(runSynthesisImpl).toHaveBeenCalledWith(
      {
        prompt: "Draft module 7",
        mode: "mock",
        presetId: "freeDefault",
      },
      {
        mockRegistry: createMockRegistry.mock.results[0]?.value,
      },
    );
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
    expect(runSynthesisImpl).toHaveBeenCalledWith({
      prompt: "Draft module 7",
      mode: "real",
      presetId: "freeDefault",
    });
  });
});
