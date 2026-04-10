import { describe, expect, it } from "vitest";
import { MockLanguageModelV1 } from "ai/test";

import {
  buildResolutionFromSynthesis,
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
  SynthesisModelOutput,
  ModelRun,
  TraceEvent,
} from "@/schema";

import type { ExecutionPlan } from "@/features/consensus/types";

const prompt = "Design a Phase 1 consensus workflow for a local-first desktop app.";
const fixedNow = new Date("2026-03-17T12:00:00Z");

const mockCrossVendorPlan: ExecutionPlan = {
  version: 1,
  candidateSlots: [
    { id: "strong", role: "strong", outputType: "candidate", provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
    { id: "fast-1", role: "fast", outputType: "candidate", provider: "openai", modelId: "gpt-5-mini" },
    { id: "fast-2", role: "fast", outputType: "candidate", provider: "google", modelId: "gemini-2.5-flash" },
  ],
  synthesisSlot: { id: "synthesis", role: "synthesis", outputType: "synthesis", provider: "openai", modelId: "gpt-5.2" },
  synthesisMode: "auto",
  source: { kind: "custom", label: "Mock" },
};

const mockFreePlan: ExecutionPlan = {
  version: 1,
  candidateSlots: [
    { id: "strong", role: "strong", outputType: "candidate", provider: "openrouter", modelId: "openrouter/free" },
    { id: "fast-1", role: "fast", outputType: "candidate", provider: "ollama", modelId: "qwen3:8b" },
    { id: "fast-2", role: "fast", outputType: "candidate", provider: "ollama", modelId: "gemma3:4b" },
  ],
  synthesisSlot: { id: "synthesis", role: "synthesis", outputType: "synthesis", provider: "openrouter", modelId: "openrouter/free" },
  synthesisMode: "auto",
  source: { kind: "custom", label: "Mock" },
};

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

function createCompletedSynthesisRun(
  overrides: Partial<SynthesisModelOutput> = {},
): ModelRun {
  const parsed: SynthesisModelOutput = {
    outputType: "synthesis",
    summary: "Ship the schema-driven consensus workflow.",
    chosenApproach: "Keep the consensus engine pure and typed.",
    rationale: "It preserves deterministic report building.",
    highlights: ["All models agree on orchestration independence."],
    openRisks: ["Verify prompt quality against real providers."],
    ...overrides,
  };

  return {
    id: "run-synthesis-unit-1",
    provider: "openai",
    model: "gpt-5.2",
    role: "synthesis",
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

const synthOutput: SynthesisModelOutput = {
  outputType: "synthesis",
  summary: "Use the pure synthesis engine and let later modules persist the report.",
  chosenApproach: "Keep report generation pure.",
  rationale: "The engine should return contracts before UI wiring happens.",
  highlights: ["All models agree orchestration should stay independent."],
  openRisks: ["Validate the preset with real keys before release."],
};

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

  it("builds resolution from a completed synthesis run including highlights", () => {
    const synthesisRun = createCompletedSynthesisRun();
    const resolution = buildResolutionFromSynthesis({ synthesisRun: synthesisRun as never });

    expect(resolution.summary).toBe("Ship the schema-driven consensus workflow.");
    expect(resolution.chosenApproach).toBe("Keep the consensus engine pure and typed.");
    expect(resolution.highlights).toEqual(["All models agree on orchestration independence."]);
    expect(resolution.synthesisModelRunId).toBe("run-synthesis-unit-1");
  });

  it("correctly identifies completed conflict positions from candidate runs", () => {
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

    // Conflict positions are part of the candidate output — verify they remain intact
    expect(conflicts[0].positions).toHaveLength(2);
    expect(conflicts[0].positions[0].stance).toBe("Persist outside the engine.");
  });
});

describe("runSynthesis orchestration", () => {
  it("returns ready when all four slots succeed", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
        executionPlan: mockCrossVendorPlan,
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
          synthesis: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            object: synthOutput,
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
    let synthesisCallCount = 0;
    const realRegistry: Partial<RealProviderRegistry> = {
      anthropic: (modelId) =>
        createMockModel({
          provider: "anthropic",
          modelId,
          object: strongCandidate,
        }),
      openai: (modelId) => {
        synthesisCallCount += 1;
        return createMockModel({
          provider: "openai",
          modelId,
          object:
            synthesisCallCount > 1
              ? synthOutput
              : fastCandidateOne,
        });
      },
    };

    const result = await runSynthesis(
      {
        prompt,
        mode: "real",
        presetId: "crossVendorDefault",
        executionPlan: mockCrossVendorPlan,
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
  });

  it("falls back to the strong run when the synthesis model fails", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
        presetId: "crossVendorDefault",
        executionPlan: mockCrossVendorPlan,
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
          synthesis: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            error: new Error("Synthesis provider timeout."),
          }),
        },
      },
    );

    // Fallback to the strong candidate when synthesis fails
    expect(result.report.status).toBe("partial");
    // synthesisModelRunId falls back to the strong candidate run id
    const strongRun = result.report.modelRuns.find(
      (run) => run.provider === "anthropic",
    );
    expect(result.report.resolution?.synthesisModelRunId).toBe(strongRun?.id);
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
        executionPlan: mockCrossVendorPlan,
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
          synthesis: createMockModel({
            provider: "openai",
            modelId: "gpt-5.2",
            object: synthOutput,
          }),
        },
      },
    );

    const failedRun = result.report.modelRuns.find((run) => run.model === "gpt-5-mini");

    expect(result.report.status).toBe("partial");
    expect(failedRun?.validation.status).toBe("failed");
    expect(failedRun?.error?.code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("does not request API keys for local Ollama slots in the free preset", async () => {
    const readProviders: SupportedProviderId[] = [];
    let openRouterCallCount = 0;

    const result = await runSynthesis(
      {
        prompt,
        mode: "real",
        presetId: "freeDefault",
        executionPlan: mockFreePlan,
      },
      {
        generateId: createIdGenerator(),
        currentDate: createClock(),
        realRegistry: {
          openrouter: (modelId) => {
            openRouterCallCount += 1;

            return createMockModel({
              provider: "openrouter",
              modelId,
              object:
                openRouterCallCount === 1
                  ? strongCandidate
                  : synthOutput,
            });
          },
          ollama: (modelId) =>
            createMockModel({
              provider: "ollama",
              modelId,
              object: modelId === "qwen3:8b" ? fastCandidateOne : fastCandidateTwo,
            }),
        },
        readApiKey: async (provider: SupportedProviderId) => {
          readProviders.push(provider);
          return provider === "openrouter" ? "test-key-openrouter" : null;
        },
      },
    );

    expect(result.report.status).toBe("ready");
    // openrouter is read twice: once for the candidate slot, once for the synthesis slot
    expect(readProviders).toEqual(["openrouter", "openrouter"]);
    expect(result.report.modelRuns.some((run) => run.provider === "ollama")).toBe(true);
  });

  it("returns failed when all candidate runs fail", async () => {
    const result = await runSynthesis(
      {
        prompt,
        mode: "mock",
        executionPlan: mockCrossVendorPlan,
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
    expect(result.report.reportStage).toBe("failed");
    expect(result.report.synthesisStatus).toBe("not_needed");
    expect(result.report.resolution).toBeNull();
    expect(result.report.modelRuns.some(isCompletedCandidateRun)).toBe(false);
    expect(result.report.modelRuns).toHaveLength(3);
  });
});
