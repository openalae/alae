import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createInitialAppStoreState } from "@/store";
import { appStore } from "@/store/app-store";
import { TruthPanel } from "@/features/truth-panel";
import type { TruthPanelSnapshot, SynthesisReport } from "@/schema";

const failedReport: SynthesisReport = {
  id: "report-failed",
  prompt: "Inspect a failing run.",
  summary: "A model failure prevented a valid synthesis resolution.",
  status: "failed",
  consensus: {
    summary: "No reliable consensus was extracted.",
    items: [],
  },
  conflicts: [],
  resolution: null,
  nextActions: [],
  modelRuns: [
    {
      id: "run-failed-1",
      provider: "openai",
      model: "gpt-5.2",
      role: "judge",
      status: "failed",
      startedAt: "2026-03-18T00:00:00.000Z",
      completedAt: "2026-03-18T00:00:02.000Z",
      latencyMs: 2000,
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
      rawText: null,
      parsed: null,
      validation: {
        status: "pending",
        issues: [],
      },
      error: {
        message: "Provider timeout",
        code: "MODEL_TIMEOUT",
        retryable: true,
      },
    },
  ],
  createdAt: "2026-03-18T00:00:02.000Z",
};

const partialReport: SynthesisReport = {
  id: "report-partial",
  prompt: "Inspect a partial run.",
  summary: "One candidate failed but the report still rendered.",
  status: "partial",
  consensus: {
    summary: "One valid candidate completed.",
    items: [],
  },
  conflicts: [],
  resolution: {
    summary: "Fallback resolution kept the report usable.",
    rationale: "One candidate still produced structured output.",
    chosenApproach: "Render telemetry and diagnostics without blocking the UI.",
    resolvedConflictIds: [],
    judgeModelRunId: "run-judge-1",
    openRisks: [],
  },
  nextActions: ["Review the failed run diagnostics."],
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
        summary: "Render telemetry and diagnostics without blocking the UI.",
        chosenApproach: "Render telemetry and diagnostics without blocking the UI.",
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

const readyReport: SynthesisReport = {
  ...partialReport,
  id: "report-ready",
  status: "ready",
  summary: "All runs completed successfully.",
};

const snapshot: TruthPanelSnapshot = {
  reportId: partialReport.id,
  generatedAt: partialReport.createdAt,
  runSummary: {
    totalRuns: 2,
    pendingRuns: 0,
    runningRuns: 0,
    completedRuns: 1,
    failedRuns: 1,
    aggregateInputTokens: 120,
    aggregateOutputTokens: 60,
    aggregateTotalTokens: 180,
    aggregateLatencyMs: 1000,
    maxLatencyMs: 1000,
  },
  runs: [
    partialReport.modelRuns[0],
    {
      id: "run-fast-1",
      provider: "google",
      model: "gemini-2.5-flash",
      role: "fast",
      status: "failed",
      startedAt: "2026-03-18T00:00:00.000Z",
      completedAt: "2026-03-18T00:00:01.000Z",
      latencyMs: 1000,
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
      rawText: null,
      parsed: null,
      validation: {
        status: "failed",
        issues: [
          {
            runId: "run-fast-1",
            path: ["output", "summary"],
            message: "String must contain at least 1 character(s)",
            severity: "error",
          },
        ],
      },
      error: {
        message: "Schema validation failed",
        code: "SCHEMA_VALIDATION_FAILED",
        retryable: false,
      },
    },
  ],
  validationIssues: [
    {
      runId: "run-fast-1",
      path: ["output", "summary"],
      message: "String must contain at least 1 character(s)",
      severity: "error",
    },
  ],
  events: [
    {
      id: "trace-1",
      scope: "judge",
      level: "info",
      message: "Judge run completed successfully.",
      occurredAt: "2026-03-18T00:00:01.000Z",
    },
    {
      id: "trace-2",
      scope: "fast-1",
      level: "error",
      message: "Schema validation failed.",
      occurredAt: "2026-03-18T00:00:01.000Z",
    },
  ],
};

describe("TruthPanel", () => {
  beforeEach(() => {
    appStore.setState(createInitialAppStoreState());
  });

  it("renders an empty state instead of the old preview copy", () => {
    render(<TruthPanel />);

    expect(screen.getByRole("heading", { name: "Truth Panel" })).toBeInTheDocument();
    expect(
      screen.getByText(/Run a synthesis to populate telemetry, validation, and trace diagnostics/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Truth Panel Preview/i)).not.toBeInTheDocument();
  });

  it("renders summary, runs, validation issues, and trace events when expanded", () => {
    appStore.setState(
      createInitialAppStoreState({
        isTruthPanelOpen: true,
        latestSynthesisReport: partialReport,
        truthPanelSnapshot: snapshot,
      }),
    );

    render(<TruthPanel />);

    expect(screen.getByRole("heading", { name: "Run summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Validation issues" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trace events" })).toBeInTheDocument();
    expect(screen.getByText("Aggregate input")).toBeInTheDocument();
    expect(screen.getByText("Schema validation failed")).toBeInTheDocument();
    expect(screen.getByText("Judge run completed successfully.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hide details/i }));
    expect(screen.queryByRole("heading", { name: "Run summary" })).not.toBeInTheDocument();
    expect(screen.getByText("Aggregate total")).toBeInTheDocument();
  });

  it("auto opens when a runtime error exists without a new snapshot", async () => {
    appStore.setState(
      createInitialAppStoreState({
        runtimeErrorMessage: "transport down",
      }),
    );

    render(<TruthPanel />);

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(true);
    });
    expect(screen.getByText("Runtime failure")).toBeInTheDocument();
    expect(screen.getByText("transport down")).toBeInTheDocument();
  });

  it("auto opens when the latest report failed", async () => {
    appStore.setState(
      createInitialAppStoreState({
        latestSynthesisReport: failedReport,
        truthPanelSnapshot: snapshot,
      }),
    );

    render(<TruthPanel />);

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(true);
    });
    expect(screen.getByText("Report failed")).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
  });

  it("does not auto open for partial reports", async () => {
    appStore.setState(
      createInitialAppStoreState({
        latestSynthesisReport: partialReport,
        truthPanelSnapshot: snapshot,
      }),
    );

    render(<TruthPanel />);

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(false);
    });
    expect(screen.getByRole("button", { name: /Show details/i })).toBeInTheDocument();
  });

  it("does not auto open for ready reports", async () => {
    appStore.setState(
      createInitialAppStoreState({
        latestSynthesisReport: readyReport,
        truthPanelSnapshot: snapshot,
      }),
    );

    render(<TruthPanel />);

    await waitFor(() => {
      expect(appStore.getState().isTruthPanelOpen).toBe(false);
    });
    expect(screen.getByRole("button", { name: /Show details/i })).toBeInTheDocument();
  });
});
