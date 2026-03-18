import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";

const { runSynthesisMock } = vi.hoisted(() => ({
  runSynthesisMock: vi.fn(),
}));

vi.mock("@/features/consensus", async () => {
  const actual = await vi.importActual<typeof import("@/features/consensus")>(
    "@/features/consensus",
  );

  return {
    ...actual,
    runSynthesis: runSynthesisMock,
  };
});

import { ProgressiveWorkspace } from "@/features/workspace";

const report = {
  id: "report-module-7",
  prompt: "Build module 7.",
  summary: "Center the synthesis report and keep raw runs behind drill-down.",
  status: "partial" as const,
  consensus: {
    summary: "Two candidate runs agree on a report-first workspace.",
    items: [
      {
        id: "consensus-1",
        kind: "approach" as const,
        statement: "Render a high-signal synthesis report before raw model output.",
        confidence: "high" as const,
        supportingRunIds: ["run-strong-1", "run-fast-1"],
      },
    ],
  },
  conflicts: [
    {
      id: "conflict-1",
      title: "How raw output should surface",
      summary: "One model wants inline output while the others want drill-down disclosure.",
      category: "approach" as const,
      severity: "high" as const,
      question: "Should raw model outputs be shown inline by default?",
      positions: [
        {
          modelRunId: "run-strong-1",
          label: "anthropic / claude-sonnet-4-20250514",
          stance: "No. Keep raw output behind drill-down disclosure.",
          evidence: "Strong candidate summary",
        },
        {
          modelRunId: "run-fast-2",
          label: "google / gemini-2.5-flash",
          stance: "Yes. Surface raw output directly in the main report area.",
          evidence: "Fast candidate summary",
        },
      ],
    },
  ],
  resolution: {
    summary: "Use drill-down disclosure for raw model runs.",
    rationale: "It protects the signal-to-noise ratio of the main workspace.",
    chosenApproach:
      "Keep the center column focused on the synthesis report and expose raw runs in an accordion.",
    resolvedConflictIds: ["conflict-1"],
    judgeModelRunId: "run-judge-1",
    openRisks: ["Truth Panel visualization still lands in module 8."],
  },
  nextActions: ["Wire the workspace controller to the center column UI."],
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
          "Keep the center column focused on the synthesis report and expose raw runs in an accordion.",
        rationale: "It protects the signal-to-noise ratio of the main workspace.",
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
  events: [],
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

describe("ProgressiveWorkspace", () => {
  beforeEach(() => {
    runSynthesisMock.mockReset();
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
        },
      }),
    );
  });

  it("submits with Cmd/Ctrl+Enter, shows loading state, and stores the resulting report", async () => {
    const deferred = createDeferredPromise<{
      report: typeof report;
      truthPanelSnapshot: typeof truthPanelSnapshot;
    }>();
    runSynthesisMock.mockReturnValue(deferred.promise);

    render(<ProgressiveWorkspace />);

    const promptField = screen.getByLabelText("Prompt");
    fireEvent.change(promptField, { target: { value: "Build module 7." } });
    fireEvent.keyDown(promptField, { key: "Enter", metaKey: true });

    expect(runSynthesisMock).toHaveBeenCalledTimes(1);
    expect(promptField).toBeDisabled();
    expect(screen.getByRole("button", { name: /Running/i })).toBeDisabled();

    deferred.resolve({
      report,
      truthPanelSnapshot,
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: /Center the synthesis report and keep raw runs behind drill-down/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mock execution is active.")).toBeInTheDocument();

    await waitFor(() => {
      expect(appStore.getState().latestSynthesisReport).toEqual(report);
      expect(appStore.getState().truthPanelSnapshot).toEqual(truthPanelSnapshot);
    });

    fireEvent.click(screen.getByRole("button", { name: /judge\s+openai \/ gpt-5\.2/i }));
    expect(screen.getByText("{\"summary\":\"Judge run\"}")).toBeInTheDocument();
  });

  it("preserves the previous report when execution throws", async () => {
    runSynthesisMock.mockRejectedValue(new Error("transport down"));
    appStore.getState().setLatestSynthesisReport(report);
    appStore.getState().setTruthPanelSnapshot(truthPanelSnapshot);

    render(<ProgressiveWorkspace />);

    const promptField = screen.getByLabelText("Prompt");
    fireEvent.change(promptField, { target: { value: "Retry module 7." } });
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    expect(await screen.findByText("transport down")).toBeInTheDocument();
    expect(appStore.getState().runtimeErrorMessage).toBe("transport down");
    expect(appStore.getState().latestSynthesisReport).toEqual(report);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /Center the synthesis report and keep raw runs behind drill-down/i,
      }),
    ).toBeInTheDocument();
  });
});
