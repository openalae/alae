import {
  APICallError,
  NoObjectGeneratedError,
  generateObject,
  type LanguageModel,
} from "ai";
import { z } from "zod";

import { getProviderFactory } from "@/features/consensus/provider-registry";
import { getSynthesisPreset } from "@/features/consensus/presets";
import {
  buildCandidateSystemPrompt,
  buildCandidateUserPrompt,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
} from "@/features/consensus/prompts";
import {
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
const skippedNoCandidateSuccessCode = "SKIPPED_NO_CANDIDATE_SUCCESS";

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

function createSkippedJudgeRun(input: {
  slot: SynthesisModelSlot;
  generateId: () => string;
  currentDate: () => Date;
}) {
  const startedAt = input.currentDate();
  const completedAt = input.currentDate();

  return buildFailedRun({
    slot: input.slot,
    runId: `run-${input.slot.id}-${input.generateId()}`,
    startedAt,
    completedAt,
    errorMessage: "Judge run skipped because no candidate run completed successfully.",
    errorCode: skippedNoCandidateSuccessCode,
    retryable: false,
    validation: buildPendingValidation(),
  });
}

function selectFallbackSource(candidateRuns: ModelRun[]) {
  return (
    candidateRuns.find(
      (run) => run.role === "strong" && isCompletedCandidateRun(run),
    ) ?? candidateRuns.find(isCompletedCandidateRun)
  );
}

export async function runSynthesis(
  input: RunSynthesisInput,
  options: RunSynthesisOptions = {},
): Promise<SynthesisExecutionResult> {
  const generateId = options.generateId ?? createDefaultId;
  const currentDate = options.currentDate ?? (() => new Date());
  const prompt = NonEmptyStringSchema.parse(input.prompt);
  const preset = getSynthesisPreset(input.presetId ?? "crossVendorDefault");
  const reportId = `report-${generateId()}`;
  const createdAt = toIsoDatetime(currentDate());

  const candidateSlots = preset.slots.filter((slot) => slot.outputType === "candidate");
  const judgeSlot = preset.slots.find((slot) => slot.outputType === "judge");

  if (!judgeSlot) {
    throw new Error("The synthesis preset is missing a judge slot.");
  }

  const candidateRuns: ModelRun[] = await Promise.all(
    candidateSlots.map((slot) =>
      executeStructuredRun({
        slot,
        mode: input.mode,
        schema: CandidateModelOutputSchema,
        system: buildCandidateSystemPrompt(slot),
        prompt: buildCandidateUserPrompt(prompt),
        options,
        generateId,
        currentDate,
      }),
    ),
  );

  const successfulCandidateRuns = candidateRuns.filter(isCompletedCandidateRun);
  const consensusItems = extractConsensusItems(candidateRuns, { generateId });
  const conflicts = extractConflictPoints(candidateRuns, { generateId });

  const judgeRun: ModelRun =
    successfulCandidateRuns.length === 0
      ? createSkippedJudgeRun({
          slot: judgeSlot,
          generateId,
          currentDate,
        })
      : await executeStructuredRun({
          slot: judgeSlot,
          mode: input.mode,
          schema: JudgeModelOutputSchema,
          system: buildJudgeSystemPrompt(),
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

  let usedFallbackResolution = false;
  let resolution = isCompletedJudgeRun(judgeRun)
    ? buildResolutionFromJudge({
        judgeRun,
        conflicts,
      })
    : null;

  if (resolution === null && successfulCandidateRuns.length > 0) {
    const fallbackSource = selectFallbackSource(candidateRuns);

    if (fallbackSource && isCompletedCandidateRun(fallbackSource)) {
      usedFallbackResolution = true;
      resolution = buildFallbackResolution({
        sourceRun: fallbackSource,
        conflicts,
      });
    }
  }

  const allRuns = [...candidateRuns, judgeRun];
  const status =
    successfulCandidateRuns.length === 0 || resolution === null
      ? "failed"
      : allRuns.every((run) => run.status === "completed") && !usedFallbackResolution
        ? "ready"
        : "partial";

  const nextActions =
    status === "failed" ? [] : buildNextActions(successfulCandidateRuns, resolution);
  const summary =
    status === "failed" || resolution === null ? createDefaultFailureSummary() : resolution.summary;

  const report = SynthesisReportSchema.parse(
    buildSynthesisReport({
      id: reportId,
      prompt,
      summary,
      status,
      consensusItems,
      successfulCandidateCount: successfulCandidateRuns.length,
      conflicts,
      resolution,
      nextActions,
      modelRuns: allRuns,
      createdAt,
    }),
  );

  const slotExecutions: SlotExecution[] = [
    ...candidateSlots.map((slot, index) => ({
      slot,
      run: candidateRuns[index],
    })),
    {
      slot: judgeSlot,
      run: judgeRun,
    },
  ];

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

  return {
    report,
    truthPanelSnapshot,
  };
}
