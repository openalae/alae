import {
  APICallError,
  NoObjectGeneratedError,
  generateObject,
  type LanguageModel,
} from "ai";
import { z } from "zod";

import { buildExecutionPlanFromPreset } from "@/features/consensus/presets";
import {
  buildCandidateSystemPrompt,
  buildCandidateUserPrompt,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
} from "@/features/consensus/prompts";
import { getProviderFactory } from "@/features/consensus/provider-registry";
import {
  buildCandidateResolution,
  buildFallbackResolution,
  buildNextActions,
  buildResolutionFromJudge,
  buildSynthesisReport,
  buildTraceEvents,
  buildTruthPanelSnapshot,
  createDefaultFailureSummary,
  createValidationIssue,
  extractConflictPoints,
  extractConsensusItems,
  isCompletedCandidateRun,
  isCompletedJudgeRun,
} from "@/features/consensus/pure";
import type {
  ExecutionPlan,
  RunJudgeOnlyInput,
  RunSynthesisInput,
  RunSynthesisOptions,
  SlotExecution,
  SynthesisExecutionResult,
  SynthesisModelSlot,
} from "@/features/consensus/types";
import { readApiKey } from "@/features/settings/api-key-bridge";
import { providerRequiresApiKey } from "@/features/settings/providers";
import {
  CandidateModelOutputSchema,
  JudgeModelOutputSchema,
  NonEmptyStringSchema,
  SynthesisReportSchema,
  TruthPanelSnapshotSchema,
  type CandidateModelOutput,
  type JudgeModelOutput,
  type ModelRun,
  type ModelRunValidation,
} from "@/schema";

const missingApiKeyCode = "MISSING_API_KEY";
const missingMockModelCode = "MISSING_MOCK_MODEL";
const schemaValidationFailedCode = "SCHEMA_VALIDATION_FAILED";
const modelCallFailedCode = "MODEL_CALL_FAILED";

type ResolvedModelResult =
  | {
      kind: "model";
      model: LanguageModel;
    }
  | {
      kind: "error";
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    };

function createDefaultId() {
  return globalThis.crypto.randomUUID();
}

function mapUsage(usage?: {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}) {
  return {
    inputTokens: usage?.promptTokens ?? null,
    outputTokens: usage?.completionTokens ?? null,
    totalTokens:
      usage?.totalTokens ?? (usage ? usage.promptTokens + usage.completionTokens : null),
  };
}

function toIsoDatetime(value: Date) {
  return value.toISOString();
}

function calculateLatencyMs(startedAt: Date, completedAt: Date) {
  const delta = completedAt.getTime() - startedAt.getTime();
  return delta >= 0 ? delta : 0;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected model execution failure.";
}

function buildPendingValidation(): ModelRunValidation {
  return {
    status: "pending",
    issues: [],
  };
}

function buildPassedValidation(): ModelRunValidation {
  return {
    status: "passed",
    issues: [],
  };
}

function buildSchemaFailureValidation(runId: string, error: unknown): ModelRunValidation {
  const zodIssues = extractZodIssues(error);

  if (zodIssues.length === 0) {
    return {
      status: "failed",
      issues: [createValidationIssue(runId, ["output"], toErrorMessage(error))],
    };
  }

  return {
    status: "failed",
    issues: zodIssues.map((issue) =>
      createValidationIssue(
        runId,
        issue.path.map((segment) => String(segment)),
        issue.message,
      ),
    ),
  };
}

function extractZodIssues(error: unknown): Array<{ path: Array<string | number>; message: string }> {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
  }

  if (error && typeof error === "object") {
    if ("issues" in error && Array.isArray(error.issues)) {
      return error.issues
        .filter(
          (issue): issue is { path?: Array<string | number>; message?: string } =>
            !!issue && typeof issue === "object",
        )
        .map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path : ["output"],
          message: typeof issue.message === "string" ? issue.message : "Schema validation failed.",
        }));
    }

    if ("cause" in error) {
      return extractZodIssues(error.cause);
    }
  }

  return [];
}

function buildFailedRun(input: {
  slot: SynthesisModelSlot;
  runId: string;
  startedAt: Date;
  completedAt: Date;
  errorMessage: string;
  errorCode: string;
  retryable: boolean;
  validation: ModelRunValidation;
  rawText?: string | null;
  usage?: { promptTokens: number; completionTokens: number; totalTokens?: number };
}) {
  return {
    id: input.runId,
    provider: input.slot.provider,
    model: input.slot.modelId,
    role: input.slot.role,
    status: "failed",
    startedAt: toIsoDatetime(input.startedAt),
    completedAt: toIsoDatetime(input.completedAt),
    latencyMs: calculateLatencyMs(input.startedAt, input.completedAt),
    usage: mapUsage(input.usage),
    rawText: input.rawText ?? null,
    parsed: null,
    validation: input.validation,
    error: {
      message: input.errorMessage,
      code: input.errorCode,
      retryable: input.retryable,
    },
  } satisfies ModelRun;
}

function buildCompletedRun<T extends CandidateModelOutput | JudgeModelOutput>(input: {
  slot: SynthesisModelSlot;
  runId: string;
  startedAt: Date;
  completedAt: Date;
  usage: { promptTokens: number; completionTokens: number; totalTokens?: number };
  parsed: T;
}) {
  return {
    id: input.runId,
    provider: input.slot.provider,
    model: input.slot.modelId,
    role: input.slot.role,
    status: "completed",
    startedAt: toIsoDatetime(input.startedAt),
    completedAt: toIsoDatetime(input.completedAt),
    latencyMs: calculateLatencyMs(input.startedAt, input.completedAt),
    usage: mapUsage(input.usage),
    rawText: JSON.stringify(input.parsed, null, 2),
    parsed: input.parsed,
    validation: buildPassedValidation(),
    error: null,
  } satisfies ModelRun;
}

async function resolveModelForSlot(
  slot: SynthesisModelSlot,
  mode: RunSynthesisInput["mode"],
  options: RunSynthesisOptions,
): Promise<ResolvedModelResult> {
  if (mode === "mock") {
    const mockModel = options.mockRegistry?.[slot.id];

    if (!mockModel) {
      return {
        kind: "error",
        errorCode: missingMockModelCode,
        errorMessage: `Mock model for slot ${slot.id} is not configured.`,
        retryable: false,
      };
    }

    return { kind: "model", model: mockModel };
  }

  const providerFactory = getProviderFactory(slot.provider, options.realRegistry);

  if (!providerRequiresApiKey(slot.provider)) {
    return {
      kind: "model",
      model: providerFactory(slot.modelId, ""),
    };
  }

  try {
    const apiKey = await (options.readApiKey ?? readApiKey)(slot.provider);

    if (!apiKey) {
      return {
        kind: "error",
        errorCode: missingApiKeyCode,
        errorMessage: `Missing API key for provider ${slot.provider}.`,
        retryable: false,
      };
    }

    return { kind: "model", model: providerFactory(slot.modelId, apiKey) };
  } catch (error) {
    return {
      kind: "error",
      errorCode: missingApiKeyCode,
      errorMessage: toErrorMessage(error),
      retryable: false,
    };
  }
}

async function executeStructuredRun<T extends CandidateModelOutput | JudgeModelOutput>(input: {
  slot: SynthesisModelSlot;
  mode: RunSynthesisInput["mode"];
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
  options: RunSynthesisOptions;
  generateId: () => string;
  currentDate: () => Date;
}): Promise<ModelRun> {
  const runId = `run-${input.slot.id}-${input.generateId()}`;
  const startedAt = input.currentDate();
  const resolvedModel = await resolveModelForSlot(input.slot, input.mode, input.options);

  if (resolvedModel.kind === "error") {
    const completedAt = input.currentDate();
    return buildFailedRun({
      slot: input.slot,
      runId,
      startedAt,
      completedAt,
      errorMessage: resolvedModel.errorMessage,
      errorCode: resolvedModel.errorCode,
      retryable: resolvedModel.retryable,
      validation: buildPendingValidation(),
    });
  }

  try {
    const result = await generateObject({
      model: resolvedModel.model,
      mode: "json",
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
      _internal: {
        generateId: input.generateId,
        currentDate: input.currentDate,
      },
    });
    const completedAt = input.currentDate();

    return buildCompletedRun({
      slot: input.slot,
      runId,
      startedAt,
      completedAt,
      usage: result.usage,
      parsed: input.schema.parse(result.object),
    });
  } catch (error) {
    const completedAt = input.currentDate();

    if (NoObjectGeneratedError.isInstance(error)) {
      return buildFailedRun({
        slot: input.slot,
        runId,
        startedAt,
        completedAt,
        errorMessage: "Model output did not match the required schema.",
        errorCode: schemaValidationFailedCode,
        retryable: false,
        validation: buildSchemaFailureValidation(runId, error.cause ?? error),
        rawText: error.text ?? null,
        usage: error.usage,
      });
    }

    return buildFailedRun({
      slot: input.slot,
      runId,
      startedAt,
      completedAt,
      errorMessage: toErrorMessage(error),
      errorCode: modelCallFailedCode,
      retryable: APICallError.isInstance(error) ? error.isRetryable : false,
      validation: buildPendingValidation(),
    });
  }
}

function selectFallbackSource(candidateRuns: ModelRun[]) {
  return (
    candidateRuns.find((run) => run.role === "strong" && isCompletedCandidateRun(run)) ??
    candidateRuns.find(isCompletedCandidateRun)
  );
}

function getCandidateMode(candidateCount: number): "single" | "dual" | "multi" {
  if (candidateCount <= 1) {
    return "single";
  }

  return candidateCount === 2 ? "dual" : "multi";
}

function resolveExecutionPlan(input: {
  executionPlan?: ExecutionPlan;
  presetId?: RunSynthesisInput["presetId"];
  judgeMode?: RunSynthesisInput["judgeMode"];
}) {
  if (input.executionPlan) {
    return input.executionPlan;
  }

  return buildExecutionPlanFromPreset(
    input.presetId ?? "crossVendorDefault",
    input.judgeMode ?? "auto",
  );
}

function buildCandidateSlotExecutions(candidateSlots: readonly SynthesisModelSlot[], runs: ModelRun[]) {
  return candidateSlots.map<SlotExecution>((slot, index) => ({
    slot,
    run: runs[index] ?? runs[0],
  }));
}

async function runSingleMode(
  input: RunSynthesisInput & {
    prompt: string;
    reportId: string;
    createdAt: string;
    executionPlan: ExecutionPlan;
  },
  options: RunSynthesisOptions,
  generateId: () => string,
  currentDate: () => Date,
): Promise<SynthesisExecutionResult> {
  const candidateSlot = input.executionPlan.candidateSlots[0];

  if (!candidateSlot) {
    throw new Error("Single-model execution requires one candidate slot.");
  }

  const candidateRun = await executeStructuredRun({
    slot: candidateSlot,
    mode: input.mode,
    schema: CandidateModelOutputSchema,
    system: buildCandidateSystemPrompt(candidateSlot, input.language),
    prompt: buildCandidateUserPrompt(input.prompt),
    options,
    generateId,
    currentDate,
  });

  const completedCandidate = isCompletedCandidateRun(candidateRun) ? candidateRun : null;
  const resolution = completedCandidate
    ? {
        summary: completedCandidate.parsed.summary,
        rationale: "Single-model mode — no comparison was performed.",
        chosenApproach:
          completedCandidate.parsed.consensusItems[0]?.statement ??
          completedCandidate.parsed.summary,
        resolvedConflictIds: [],
        judgeModelRunId: completedCandidate.id,
        openRisks: [],
      }
    : null;
  const allRuns = [candidateRun];
  const status = completedCandidate ? "ready" : "failed";

  const report = SynthesisReportSchema.parse(
    buildSynthesisReport({
      id: input.reportId,
      prompt: input.prompt,
      summary: resolution?.summary ?? createDefaultFailureSummary(),
      status,
      candidateMode: "single",
      pendingJudge: false,
      reportStage: completedCandidate ? "resolved" : "failed",
      judgeStatus: "not_needed",
      executionPlan: input.executionPlan,
      consensusItems: [],
      successfulCandidateCount: completedCandidate ? 1 : 0,
      conflicts: [],
      resolution,
      nextActions: completedCandidate ? completedCandidate.parsed.recommendedActions : [],
      modelRuns: allRuns,
      createdAt: input.createdAt,
    }),
  );

  const truthPanelSnapshot = TruthPanelSnapshotSchema.parse(
    buildTruthPanelSnapshot({
      runs: allRuns,
      reportId: report.id,
      generatedAt: report.createdAt,
      events: buildTraceEvents({
        slotExecutions: [{ slot: candidateSlot, run: candidateRun }],
        generatedAt: report.createdAt,
        generateId,
        usedFallbackResolution: false,
      }),
    }),
  );

  return { report, truthPanelSnapshot };
}

async function runMultiCandidateMode(
  input: RunSynthesisInput & {
    prompt: string;
    reportId: string;
    createdAt: string;
    candidateMode: "dual" | "multi";
    executionPlan: ExecutionPlan;
  },
  options: RunSynthesisOptions,
  generateId: () => string,
  currentDate: () => Date,
): Promise<SynthesisExecutionResult> {
  const { candidateSlots, judgeSlot } = input.executionPlan;
  const candidateRuns = await Promise.all(
    candidateSlots.map((slot) =>
      executeStructuredRun({
        slot,
        mode: input.mode,
        schema: CandidateModelOutputSchema,
        system: buildCandidateSystemPrompt(slot, input.language),
        prompt: buildCandidateUserPrompt(input.prompt),
        options,
        generateId,
        currentDate,
      }),
    ),
  );

  const successfulCandidateRuns = candidateRuns.filter(isCompletedCandidateRun);
  const consensusItems = extractConsensusItems(candidateRuns, { generateId });
  const conflicts = extractConflictPoints(candidateRuns, { generateId });
  const hasConflicts = conflicts.length > 0;
  const deferJudge = input.executionPlan.conflictMode === "manual" && hasConflicts;
  const fallbackSource = selectFallbackSource(candidateRuns);

  let judgeRun: ModelRun | null = null;
  let usedFallbackResolution = false;
  let resolution =
    !hasConflicts && fallbackSource && isCompletedCandidateRun(fallbackSource)
      ? buildCandidateResolution({ sourceRun: fallbackSource })
      : null;

  if (successfulCandidateRuns.length > 0 && hasConflicts && !deferJudge) {
    if (!judgeSlot) {
      throw new Error("The execution plan is missing a judge slot for conflict resolution.");
    }

    judgeRun = await executeStructuredRun({
      slot: judgeSlot,
      mode: input.mode,
      schema: JudgeModelOutputSchema,
      system: buildJudgeSystemPrompt(input.language),
      prompt: buildJudgeUserPrompt({
        prompt: input.prompt,
        candidateRuns: successfulCandidateRuns,
        consensusItems,
        conflicts,
      }),
      options,
      generateId,
      currentDate,
    });

    resolution = isCompletedJudgeRun(judgeRun)
      ? buildResolutionFromJudge({ judgeRun, conflicts })
      : null;

    if (resolution === null && fallbackSource && isCompletedCandidateRun(fallbackSource)) {
      usedFallbackResolution = true;
      resolution = buildFallbackResolution({ sourceRun: fallbackSource, conflicts });
    }
  }

  const allRuns = judgeRun ? [...candidateRuns, judgeRun] : [...candidateRuns];
  const status =
    successfulCandidateRuns.length === 0
      ? "failed"
      : hasConflicts && deferJudge
        ? "partial"
        : resolution === null
          ? "failed"
          : allRuns.every((run) => run.status === "completed") && !usedFallbackResolution
            ? "ready"
            : "partial";

  const reportStage =
    status === "failed"
      ? "failed"
      : hasConflicts && deferJudge
        ? "awaiting_judge"
        : "resolved";
  const judgeStatus =
    !hasConflicts
      ? "not_needed"
      : deferJudge
        ? "pending"
        : judgeRun && isCompletedJudgeRun(judgeRun)
          ? "completed"
          : "failed";
  const summary =
    reportStage === "awaiting_judge" && fallbackSource && isCompletedCandidateRun(fallbackSource)
      ? fallbackSource.parsed.summary
      : resolution?.summary ?? createDefaultFailureSummary();
  const nextActions = status === "failed" ? [] : buildNextActions(successfulCandidateRuns, resolution);
  const slotExecutions = buildCandidateSlotExecutions(candidateSlots, candidateRuns);
  if (judgeSlot && judgeRun) {
    slotExecutions.push({ slot: judgeSlot, run: judgeRun });
  }

  const report = SynthesisReportSchema.parse(
    buildSynthesisReport({
      id: input.reportId,
      prompt: input.prompt,
      summary,
      status,
      candidateMode: input.candidateMode,
      pendingJudge: deferJudge,
      reportStage,
      judgeStatus,
      executionPlan: input.executionPlan,
      consensusItems,
      successfulCandidateCount: successfulCandidateRuns.length,
      conflicts,
      resolution,
      nextActions,
      modelRuns: allRuns,
      createdAt: input.createdAt,
    }),
  );

  const truthPanelSnapshot = TruthPanelSnapshotSchema.parse(
    buildTruthPanelSnapshot({
      runs: allRuns,
      reportId: report.id,
      generatedAt: report.createdAt,
      events: buildTraceEvents({
        slotExecutions,
        generatedAt: report.createdAt,
        generateId,
        usedFallbackResolution,
      }),
    }),
  );

  return { report, truthPanelSnapshot };
}

export async function runSynthesis(
  input: RunSynthesisInput,
  options: RunSynthesisOptions = {},
): Promise<SynthesisExecutionResult> {
  const generateId = options.generateId ?? createDefaultId;
  const currentDate = options.currentDate ?? (() => new Date());
  const prompt = NonEmptyStringSchema.parse(input.prompt);
  const executionPlan = resolveExecutionPlan(input);
  const reportId = `report-${generateId()}`;
  const createdAt = toIsoDatetime(currentDate());
  const candidateCount = executionPlan.candidateSlots.length;

  if (candidateCount === 1) {
    return runSingleMode(
      { ...input, prompt, reportId, createdAt, executionPlan },
      options,
      generateId,
      currentDate,
    );
  }

  return runMultiCandidateMode(
    {
      ...input,
      prompt,
      reportId,
      createdAt,
      executionPlan,
      candidateMode: candidateCount === 2 ? "dual" : "multi",
    },
    options,
    generateId,
    currentDate,
  );
}

export async function runJudgeOnly(
  input: RunJudgeOnlyInput,
  options: RunSynthesisOptions = {},
): Promise<SynthesisExecutionResult> {
  const generateId = options.generateId ?? createDefaultId;
  const currentDate = options.currentDate ?? (() => new Date());
  const prompt = NonEmptyStringSchema.parse(input.prompt);
  const executionPlan = resolveExecutionPlan(input);
  const reportId = `report-${generateId()}`;
  const createdAt = toIsoDatetime(currentDate());
  const candidateSlots = executionPlan.candidateSlots;
  const judgeSlot = executionPlan.judgeSlot;
  const candidateCount = input.candidateRuns.filter((run) => run.role !== "judge").length;
  const candidateMode = getCandidateMode(candidateCount);
  const successfulCandidateRuns = input.candidateRuns.filter(isCompletedCandidateRun);
  const consensusItems = extractConsensusItems(input.candidateRuns, { generateId });
  const conflicts = extractConflictPoints(input.candidateRuns, { generateId });
  const fallbackSource = selectFallbackSource(input.candidateRuns);

  let judgeRun: ModelRun | null = null;
  let usedFallbackResolution = false;
  let resolution =
    conflicts.length === 0 && fallbackSource && isCompletedCandidateRun(fallbackSource)
      ? buildCandidateResolution({ sourceRun: fallbackSource })
      : null;

  if (successfulCandidateRuns.length > 0 && conflicts.length > 0) {
    if (!judgeSlot) {
      throw new Error("No judge slot is configured for this execution plan.");
    }

    judgeRun = await executeStructuredRun({
      slot: judgeSlot,
      mode: input.mode,
      schema: JudgeModelOutputSchema,
      system: buildJudgeSystemPrompt(input.language),
      prompt: buildJudgeUserPrompt({
        prompt,
        candidateRuns: successfulCandidateRuns,
        consensusItems,
        conflicts,
      }),
      options,
      generateId,
      currentDate,
    });

    resolution = isCompletedJudgeRun(judgeRun)
      ? buildResolutionFromJudge({ judgeRun, conflicts })
      : null;

    if (resolution === null && fallbackSource && isCompletedCandidateRun(fallbackSource)) {
      usedFallbackResolution = true;
      resolution = buildFallbackResolution({ sourceRun: fallbackSource, conflicts });
    }
  }

  const allRuns = judgeRun ? [...input.candidateRuns, judgeRun] : [...input.candidateRuns];
  const status =
    successfulCandidateRuns.length === 0 || resolution === null
      ? "failed"
      : allRuns.every((run) => run.status === "completed") && !usedFallbackResolution
        ? "ready"
        : "partial";
  const slotExecutions = buildCandidateSlotExecutions(candidateSlots, input.candidateRuns);
  if (judgeSlot && judgeRun) {
    slotExecutions.push({ slot: judgeSlot, run: judgeRun });
  }

  const report = SynthesisReportSchema.parse(
    buildSynthesisReport({
      id: reportId,
      prompt,
      summary: resolution?.summary ?? createDefaultFailureSummary(),
      status,
      candidateMode,
      pendingJudge: false,
      reportStage: status === "failed" ? "failed" : "resolved",
      judgeStatus:
        conflicts.length === 0
          ? "not_needed"
          : judgeRun && isCompletedJudgeRun(judgeRun)
            ? "completed"
            : judgeRun
              ? "failed"
              : "not_needed",
      executionPlan,
      consensusItems,
      successfulCandidateCount: successfulCandidateRuns.length,
      conflicts,
      resolution,
      nextActions: status === "failed" ? [] : buildNextActions(successfulCandidateRuns, resolution),
      modelRuns: allRuns,
      createdAt,
    }),
  );

  const truthPanelSnapshot = TruthPanelSnapshotSchema.parse(
    buildTruthPanelSnapshot({
      runs: allRuns,
      reportId: report.id,
      generatedAt: report.createdAt,
      events: buildTraceEvents({
        slotExecutions,
        generatedAt: report.createdAt,
        generateId,
        usedFallbackResolution,
      }),
    }),
  );

  return { report, truthPanelSnapshot };
}
