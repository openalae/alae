import { describe, expect, it } from "vitest";
import { MockLanguageModelV1 } from "ai/test";

import {
  buildResolutionFromJudge,
  buildTraceEvents,
  buildTruthPanelSnapshot,
  extractConflictPoints,
  extractConsensusItems,
  isCompletedCandidateRun,
  runSynthesis,
} from "@/features/consensus";
import type { RealProviderRegistry } from "@/features/consensus";
import type { SupportedProviderId } from "@/features/settings/providers";
import type {
  CandidateModelOutput,
  ConflictPoint,
  JudgeModelOutput,
  ModelRun,
  TraceEvent,
} from "@/schema";

const prompt = "Design a Phase 1 consensus workflow for a local-first desktop app.";
const fixedNow = new Date("2026-03-17T12:00:00Z");

function createIdGenerator() {
  let counter = 0;

  return () => {
    counter += 1;
    return `id-${counter}`;
  };
}

function createClock() {
  return () => fixedNow;
}

function createMockModel(input: {
  provider: string;
  modelId: string;
  object?: Record<string, unknown>;
  error?: Error;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}) {
  return new MockLanguageModelV1({
    provider: input.provider,
    modelId: input.modelId,
    defaultObjectGenerationMode: "json",
    supportsStructuredOutputs: true,
    doGenerate: async () => {
      if (input.error) {
        throw input.error;
      }

      return {
        text: JSON.stringify(input.object ?? {}),
        finishReason: "stop",
        usage: input.usage ?? {
          promptTokens: 100,
          completionTokens: 40,
        },
        rawCall: {
          rawPrompt: null,
          rawSettings: {},
        },
      };
    },
  });
}

function createCompletedCandidateRun(
  id: string,
  provider: string,
  model: string,
  parsed: CandidateModelOutput,
): ModelRun {
  return {
    id,
    provider,
    model,
    role: provider === "anthropic" ? "strong" : "fast",
    status: "completed",
    startedAt: "2026-03-17T12:00:00Z",
    completedAt: "2026-03-17T12:00:01Z",
    latencyMs: 1000,
    usage: {
      inputTokens: 120,
      outputTokens: 60,
      totalTokens: 180,
    },
    rawText: JSON.stringify(parsed),
    parsed,
    validation: {
      status: "passed",
      issues: [],
    },
    error: null,
  };
}

function createCompletedJudgeRun(
  conflictIds: string[],
  overrides: Partial<JudgeModelOutput> = {},
): ModelRun {
  const parsed: JudgeModelOutput = {
    outputType: "judge",
    summary: "Ship the schema-driven consensus workflow.",
    chosenApproach: "Keep the consensus engine pure and typed.",
    rationale: "It preserves deterministic report building.",
    resolvedConflictIds: conflictIds,
    openRisks: ["Verify prompt quality against real providers."],
    ...overrides,
  };

  return {
    id: "run-judge-unit-1",
    provider: "openai",
    model: "gpt-5.2",
    role: "judge",
    status: "completed",
    startedAt: "2026-03-17T12:00:00Z",
    completedAt: "2026-03-17T12:00:02Z",
    latencyMs: 2000,
    usage: {
      inputTokens: 150,
      outputTokens: 70,
      totalTokens: 220,
    },
    rawText: JSON.stringify(parsed),
    parsed,
    validation: {
      status: "passed",
      issues: [],
    },
    error: null,
  };
}

function createCandidateOutput(input: {
  summary: string;
  consensusItems: CandidateModelOutput["consensusItems"];
  conflictObservations?: CandidateModelOutput["conflictObservations"];
  recommendedActions?: string[];
}): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: input.summary,
    consensusItems: input.consensusItems,
    conflictObservations: input.conflictObservations ?? [],
    recommendedActions: input.recommendedActions ?? [],
  };
}

const strongCandidate = createCandidateOutput({
  summary: "Use a typed synthesis report and a separate truth snapshot.",
  consensusItems: [
    {
      kind: "approach",
      statement: "Keep synthesis orchestration independent from UI state.",
      confidence: "high",
    },
    {
      kind: "risk",
      statement: "Handle missing provider credentials before execution.",
      confidence: "medium",
    },
  ],
  conflictObservations: [
    {
      title: "Where to persist reports",
      summary: "Persisting inside the store would couple orchestration to UI.",
      category: "approach",
      severity: "medium",
      question: "Should synthesis results be written directly to UI state?",
      stance: "No, keep persistence outside the orchestration service.",
    },
  ],
  recommendedActions: ["Wire the service into the workspace UI."],
});

const fastCandidateOne = createCandidateOutput({
  summary: "Keep the engine pure and return validated contracts.",
  consensusItems: [
    {
      kind: "approach",
      statement: "Keep synthesis orchestration independent from UI state.",
      confidence: "medium",
    },
  ],
  conflictObservations: [
    {
      title: "Where to persist reports",
      summary: "Writing from the engine into global state hides orchestration failures.",
      category: "approach",
      severity: "high",
      question: "Should synthesis results be written directly to UI state?",
      stance: "No, return the report and let later modules persist it.",
    },
  ],
  recommendedActions: ["Track validation failures in the truth panel."],
});

const fastCandidateTwo = createCandidateOutput({
  summary: "A cross-vendor preset gives stronger disagreement detection.",
  consensusItems: [
    {
      kind: "risk",
      statement: "Handle missing provider credentials before execution.",
      confidence: "high",
    },
  ],
  conflictObservations: [
    {
      title: "Where to persist reports",
      summary: "Immediate store writes are fine if the engine stays deterministic.",
      category: "approach",
      severity: "low",
      question: "Should synthesis results be written directly to UI state?",
      stance: "It is acceptable once the pure orchestration contract is stable.",
    },
  ],
  recommendedActions: ["Add a local smoke path for configured providers."],
});

describe("consensus pure helpers", () => {
  it("extracts 2-of-3 consensus items and keeps stable ordering", () => {
    const runs = [
      createCompletedCandidateRun("run-strong", "anthropic", "claude-sonnet-4-20250514", strongCandidate),
      createCompletedCandidateRun("run-fast-1", "openai", "gpt-5-mini", fastCandidateOne),
      createCompletedCandidateRun("run-fast-2", "google", "gemini-2.5-flash", fastCandidateTwo),
    ];

    const items = extractConsensusItems(runs, {
      generateId: createIdGenerator(),
    });

    expect(items).toHaveLength(2);
    expect(items[0].statement).toBe("Keep synthesis orchestration independent from UI state.");
    expect(items[0].supportingRunIds).toEqual(["run-strong", "run-fast-1"]);
    expect(items[1].statement).toBe("Handle missing provider credentials before execution.");
  });

  it("does not extract consensus from a single successful candidate run", () => {
    const items = extractConsensusItems(
      [createCompletedCandidateRun("run-strong", "anthropic", "claude-sonnet-4-20250514", strongCandidate)],
      {
        generateId: createIdGenerator(),
      },
    );

    expect(items).toEqual([]);
  });

  it("aggregates conflicts by question, drops single-stance groups, and keeps highest severity", () => {
    const runs = [
      createCompletedCandidateRun("run-strong", "anthropic", "claude-sonnet-4-20250514", strongCandidate),
      createCompletedCandidateRun("run-fast-1", "openai", "gpt-5-mini", fastCandidateOne),
      createCompletedCandidateRun("run-fast-2", "google", "gemini-2.5-flash", fastCandidateTwo),
    ];

    const conflicts = extractConflictPoints(runs, {
      generateId: createIdGenerator(),
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("high");
    expect(conflicts[0].positions).toHaveLength(3);
  });

  it("builds truth panel aggregates from completed runs and flattened issues", () => {
    const candidateRun = createCompletedCandidateRun(
      "run-strong",
      "anthropic",
      "claude-sonnet-4-20250514",
      strongCandidate,
    );
    const failedRun: ModelRun = {
      id: "run-fast-failed",
      provider: "openai",
      model: "gpt-5-mini",
      role: "fast",
      status: "failed",
      startedAt: "2026-03-17T12:00:00Z",
      completedAt: "2026-03-17T12:00:00Z",
      latencyMs: 0,
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
      rawText: "{\"bad\":true}",
      parsed: null,
      validation: {
        status: "failed",
        issues: [
          {
            runId: "run-fast-failed",
            path: ["output", "summary"],
            message: "String must contain at least 1 character(s)",
            severity: "error",
          },
        ],
      },
      error: {
        message: "Model output did not match the required schema.",
        code: "SCHEMA_VALIDATION_FAILED",
        retryable: false,
      },
    };
    const events: TraceEvent[] = buildTraceEvents({
      slotExecutions: [
        {
          slot: {
            id: "strong",
            provider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            role: "strong",
            outputType: "candidate",
          },
          run: candidateRun,
        },
        {
          slot: {
            id: "fast-1",
            provider: "openai",
            modelId: "gpt-5-mini",
            role: "fast",
            outputType: "candidate",
          },
          run: failedRun,
        },
      ],
      generatedAt: "2026-03-17T12:00:03Z",
      generateId: createIdGenerator(),
      usedFallbackResolution: true,
    });

    const snapshot = buildTruthPanelSnapshot({
      runs: [candidateRun, failedRun],
      reportId: "report-truth-1",
      generatedAt: "2026-03-17T12:00:03Z",
      events,
    });

    expect(snapshot.runSummary.totalRuns).toBe(2);
    expect(snapshot.runSummary.completedRuns).toBe(1);
    expect(snapshot.runSummary.failedRuns).toBe(1);
    expect(snapshot.runSummary.aggregateTotalTokens).toBe(180);
    expect(snapshot.validationIssues).toHaveLength(1);
    expect(snapshot.events[snapshot.events.length - 1]?.scope).toBe("fallback-resolution");
  });

  it("filters judge conflict references that are not present in the conflict list", () => {
    const conflicts: ConflictPoint[] = [
      {
        id: "conflict-1",
        title: "Conflict",
        summary: "Conflict summary",
        category: "approach",
        severity: "medium",
        question: "What should we persist?",
        positions: [
          {
            modelRunId: "run-strong",
            label: "strong:anthropic/claude-sonnet-4-20250514",
            stance: "Persist outside the engine.",
            evidence: "Store writes couple orchestration to UI.",
          },
          {
            modelRunId: "run-fast-1",
            label: "fast:openai/gpt-5-mini",
            stance: "Persist from the UI layer.",
            evidence: "It keeps the orchestration pure.",
          },
        ],
      },
    ];

    const resolution = buildResolutionFromJudge({
      judgeRun: createCompletedJudgeRun(["conflict-1", "missing-conflict"]) as never,
      conflicts,
    });

    expect(resolution.resolvedConflictIds).toEqual(["conflict-1"]);
  });
});

describe("runSynthesis orchestration", () => {
  it("returns ready when all four slots succeed", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        mockRegistry: {
          strong: createMockModel({
            provider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            object: strongCandidate,
          }),
          "fast-1": createMockModel({
            provider: "openai",
            modelId: "gpt-5-mini",
            object: fastCandidateOne,
          }),
          "fast-2": createMockModel({
            provider: "google",
            modelId: "gemini-2.5-flash",
            object: fastCandidateTwo,
          }),
          judge: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            object: {
              outputType: "judge",
              summary: "Use the pure synthesis engine and let later modules persist the report.",
              chosenApproach: "Keep report generation pure.",
              rationale: "The engine should return contracts before UI wiring happens.",
              resolvedConflictIds: [],
              openRisks: ["Validate the preset with real keys before release."],
            },
          }),
        },
      },
    );

    expect(result.report.status).toBe("ready");
    expect(result.report.resolution?.chosenApproach).toBe("Keep report generation pure.");
    expect(result.truthPanelSnapshot.runSummary.totalRuns).toBe(4);
    expect(result.truthPanelSnapshot.validationIssues).toEqual([]);
  });

  it("returns partial when one provider key is missing in real mode", async () => {
    const realRegistry: Partial<RealProviderRegistry> = {
      anthropic: (modelId) =>
        createMockModel({
          provider: "anthropic",
          modelId,
          object: strongCandidate,
        }),
      openai: (modelId) =>
        createMockModel({
          provider: "openai",
          modelId,
          object:
            modelId === "gpt-5.2"
              ? {
                  outputType: "judge",
                  summary: "Proceed with the pure orchestration engine.",
                  chosenApproach: "Return validated report contracts.",
                  rationale: "It supports later persistence and UI wiring.",
                  resolvedConflictIds: [],
                  openRisks: ["Exercise the Google slot after keys are configured."],
                }
              : fastCandidateOne,
        }),
    };

    const result = await runSynthesis(
      {
        prompt,
        mode: "real",
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        realRegistry,
        readApiKey: async (provider: SupportedProviderId) =>
          provider === "google" ? null : `test-key-${provider}`,
      },
    );

    expect(result.report.status).toBe("partial");
    expect(result.report.modelRuns.find((run) => run.model === "gemini-2.5-flash")?.error?.code).toBe(
      "MISSING_API_KEY",
    );
    expect(result.report.resolution?.chosenApproach).toBe("Return validated report contracts.");
  });

  it("falls back to the strong run when the judge fails", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        mockRegistry: {
          strong: createMockModel({
            provider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            object: strongCandidate,
          }),
          "fast-1": createMockModel({
            provider: "openai",
            modelId: "gpt-5-mini",
            object: fastCandidateOne,
          }),
          "fast-2": createMockModel({
            provider: "google",
            modelId: "gemini-2.5-flash",
            object: fastCandidateTwo,
          }),
          judge: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            error: new Error("Judge provider timeout."),
          }),
        },
      },
    );

    expect(result.report.status).toBe("partial");
    expect(result.report.resolution?.resolvedConflictIds).toEqual([]);
    expect(result.report.resolution?.judgeModelRunId).toBe(result.report.modelRuns[0].id);
    expect(
      result.truthPanelSnapshot.events.some((event) => event.scope === "fallback-resolution"),
    ).toBe(true);
  });

  it("marks schema-invalid candidate output as failed validation", async () => {
    const invalidCandidate = {
      outputType: "candidate",
      summary: "",
      consensusItems: [],
      conflictObservations: [],
      recommendedActions: [],
    };

    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        mockRegistry: {
          strong: createMockModel({
            provider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            object: strongCandidate,
          }),
          "fast-1": createMockModel({
            provider: "openai",
            modelId: "gpt-5-mini",
            object: invalidCandidate,
          }),
          "fast-2": createMockModel({
            provider: "google",
            modelId: "gemini-2.5-flash",
            object: fastCandidateTwo,
          }),
          judge: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            object: {
              outputType: "judge",
              summary: "Proceed with the valid runs only.",
              chosenApproach: "Ignore the invalid candidate output.",
              rationale: "Two valid candidates are enough for a partial synthesis.",
              resolvedConflictIds: [],
              openRisks: ["Review schema drift in the invalid slot."],
            },
          }),
        },
      },
    );

    const failedRun = result.report.modelRuns.find((run) => run.model === "gpt-5-mini");

    expect(result.report.status).toBe("partial");
    expect(failedRun?.validation.status).toBe("failed");
    expect(failedRun?.error?.code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("returns failed when all candidate runs fail", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        mockRegistry: {
          strong: createMockModel({
            provider: "anthropic",
            modelId: "claude-sonnet-4-20250514",
            error: new Error("Strong model unavailable."),
          }),
          "fast-1": createMockModel({
            provider: "openai",
            modelId: "gpt-5-mini",
            object: {
              outputType: "candidate",
              summary: "",
              consensusItems: [],
              conflictObservations: [],
              recommendedActions: [],
            },
          }),
          "fast-2": createMockModel({
            provider: "google",
            modelId: "gemini-2.5-flash",
            error: new Error("Fast model unavailable."),
          }),
        },
      },
    );

    expect(result.report.status).toBe("failed");
    expect(result.report.resolution).toBeNull();
    expect(result.report.modelRuns.some(isCompletedCandidateRun)).toBe(false);
    expect(result.report.modelRuns[result.report.modelRuns.length - 1]?.error?.code).toBe(
      "SKIPPED_NO_CANDIDATE_SUCCESS",
    );
  });
});
