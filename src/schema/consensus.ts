import { z } from "zod";

import {
  ConfidenceSchema,
  ConflictCategorySchema,
  ConflictSeveritySchema,
  ConsensusItemKindSchema,
  EntityIdSchema,
  IsoDatetimeSchema,
  ModelRoleSchema,
  NonEmptyStringSchema,
  NullableIsoDatetimeSchema,
  NullableNonNegativeIntegerSchema,
  RunStatusSchema,
  TraceLevelSchema,
  ValidationStatusSchema,
} from "@/schema/common";

export const ValidationIssueSchema = z
  .object({
    runId: EntityIdSchema,
    path: z.array(NonEmptyStringSchema),
    message: NonEmptyStringSchema,
    severity: TraceLevelSchema,
  })
  .strict();

export const ModelRunUsageSchema = z
  .object({
    inputTokens: NullableNonNegativeIntegerSchema,
    outputTokens: NullableNonNegativeIntegerSchema,
    totalTokens: NullableNonNegativeIntegerSchema,
  })
  .strict();

export const ConsensusItemSchema = z
  .object({
    id: EntityIdSchema,
    kind: ConsensusItemKindSchema,
    statement: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    supportingRunIds: z.array(EntityIdSchema),
  })
  .strict();

export const ConflictPositionSchema = z
  .object({
    modelRunId: EntityIdSchema,
    label: NonEmptyStringSchema,
    stance: NonEmptyStringSchema,
    evidence: NonEmptyStringSchema.nullable(),
  })
  .strict();

export const ConflictPointSchema = z
  .object({
    id: EntityIdSchema,
    title: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    category: ConflictCategorySchema,
    severity: ConflictSeveritySchema,
    question: NonEmptyStringSchema,
    positions: z.array(ConflictPositionSchema).min(2),
  })
  .strict();

export const ResolutionSchema = z
  .object({
    summary: NonEmptyStringSchema,
    rationale: NonEmptyStringSchema,
    chosenApproach: NonEmptyStringSchema,
    resolvedConflictIds: z.array(EntityIdSchema),
    judgeModelRunId: EntityIdSchema,
    openRisks: z.array(NonEmptyStringSchema),
  })
  .strict();

export const CandidateConsensusItemSchema = z
  .object({
    kind: ConsensusItemKindSchema,
    statement: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
  })
  .strict();

export const CandidateConflictObservationSchema = z
  .object({
    title: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    category: ConflictCategorySchema,
    severity: ConflictSeveritySchema,
    question: NonEmptyStringSchema,
    stance: NonEmptyStringSchema,
  })
  .strict();

export const CandidateModelOutputSchema = z
  .object({
    outputType: z.literal("candidate"),
    summary: NonEmptyStringSchema,
    consensusItems: z.array(CandidateConsensusItemSchema),
    conflictObservations: z.array(CandidateConflictObservationSchema),
    recommendedActions: z.array(NonEmptyStringSchema),
  })
  .strict();

export const JudgeModelOutputSchema = z
  .object({
    outputType: z.literal("judge"),
    summary: NonEmptyStringSchema,
    chosenApproach: NonEmptyStringSchema,
    rationale: NonEmptyStringSchema,
    resolvedConflictIds: z.array(EntityIdSchema),
    openRisks: z.array(NonEmptyStringSchema),
  })
  .strict();

export const ParsedModelOutputSchema = z.discriminatedUnion("outputType", [
  CandidateModelOutputSchema,
  JudgeModelOutputSchema,
]);

export const ModelRunErrorSchema = z
  .object({
    message: NonEmptyStringSchema,
    code: NonEmptyStringSchema.nullable(),
    retryable: z.boolean(),
  })
  .strict();

export const ModelRunValidationSchema = z
  .object({
    status: ValidationStatusSchema,
    issues: z.array(ValidationIssueSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "failed" && value.issues.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed validation must include at least one issue",
        path: ["issues"],
      });
    }

    if (value.status === "pending" && value.issues.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pending validation cannot include issues",
        path: ["issues"],
      });
    }
  });

export const ModelRunSchema = z
  .object({
    id: EntityIdSchema,
    provider: NonEmptyStringSchema,
    model: NonEmptyStringSchema,
    role: ModelRoleSchema,
    status: RunStatusSchema,
    startedAt: IsoDatetimeSchema,
    completedAt: NullableIsoDatetimeSchema,
    latencyMs: NullableNonNegativeIntegerSchema,
    usage: ModelRunUsageSchema,
    rawText: NonEmptyStringSchema.nullable(),
    parsed: ParsedModelOutputSchema.nullable(),
    validation: ModelRunValidationSchema,
    error: ModelRunErrorSchema.nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "completed") {
      if (value.completedAt === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completed runs must include completedAt",
          path: ["completedAt"],
        });
      }

      if (value.rawText === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completed runs must include rawText",
          path: ["rawText"],
        });
      }

      if (value.error !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completed runs cannot include an error payload",
          path: ["error"],
        });
      }

      if (value.validation.status === "pending") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completed runs cannot have pending validation",
          path: ["validation", "status"],
        });
      }
    }

    if (value.status === "failed" && value.error === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed runs must include an error payload",
        path: ["error"],
      });
    }
  });

export const ConsensusSectionSchema = z
  .object({
    summary: NonEmptyStringSchema,
    items: z.array(ConsensusItemSchema),
  })
  .strict();

export const CandidateModeSchema = z.enum(["single", "dual", "multi"]);
export const ReportStageSchema = z.enum([
  "candidate_complete",
  "awaiting_judge",
  "judge_running",
  "resolved",
  "failed",
]);
export const JudgeStatusSchema = z.enum([
  "not_needed",
  "pending",
  "running",
  "completed",
  "failed",
]);
export const ConflictModeSchema = z.enum(["auto", "manual"]);

export const ExecutionPlanSlotSchema = z
  .object({
    id: NonEmptyStringSchema,
    provider: NonEmptyStringSchema,
    modelId: NonEmptyStringSchema,
    role: ModelRoleSchema,
    outputType: z.enum(["candidate", "judge"]),
  })
  .strict();

export const ExecutionPlanSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      presetId: NonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("custom"),
      label: NonEmptyStringSchema.nullable(),
    })
    .strict(),
]);

export const ExecutionPlanSchema = z
  .object({
    version: z.literal(1),
    candidateSlots: z.array(ExecutionPlanSlotSchema).min(1).max(3),
    judgeSlot: ExecutionPlanSlotSchema.nullable(),
    conflictMode: ConflictModeSchema.default("auto"),
    source: ExecutionPlanSourceSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    value.candidateSlots.forEach((slot, index) => {
      if (slot.outputType !== "candidate") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "candidateSlots must only contain candidate slots",
          path: ["candidateSlots", index, "outputType"],
        });
      }

      if (slot.role === "judge") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "candidateSlots cannot include judge roles",
          path: ["candidateSlots", index, "role"],
        });
      }
    });

    if (value.judgeSlot) {
      if (value.judgeSlot.outputType !== "judge") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "judgeSlot must use outputType='judge'",
          path: ["judgeSlot", "outputType"],
        });
      }

      if (value.judgeSlot.role !== "judge") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "judgeSlot must use role='judge'",
          path: ["judgeSlot", "role"],
        });
      }
    }

    if (value.candidateSlots.length === 1 && value.judgeSlot !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "single-candidate execution plans should not include a judge slot",
        path: ["judgeSlot"],
      });
    }
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getLegacyJudgeRun(modelRuns: unknown): Record<string, unknown> | null {
  if (!Array.isArray(modelRuns)) {
    return null;
  }

  for (let index = modelRuns.length - 1; index >= 0; index -= 1) {
    const run = modelRuns[index];
    if (isRecord(run) && run.role === "judge") {
      return run;
    }
  }

  return null;
}

function deriveLegacyJudgeStatus(input: unknown): z.infer<typeof JudgeStatusSchema> {
  if (!isRecord(input)) {
    return "not_needed";
  }

  if (typeof input.judgeStatus === "string") {
    return input.judgeStatus as z.infer<typeof JudgeStatusSchema>;
  }

  if (input.pendingJudge === true) {
    return "pending";
  }

  const judgeRun = getLegacyJudgeRun(input.modelRuns);

  if (!judgeRun) {
    return "not_needed";
  }

  if (judgeRun.status === "running") {
    return "running";
  }

  const parsed = isRecord(judgeRun.parsed) ? judgeRun.parsed : null;
  if (judgeRun.status === "completed" && parsed?.outputType === "judge") {
    return "completed";
  }

  if (judgeRun.status === "failed") {
    const error = isRecord(judgeRun.error) ? judgeRun.error : null;
    if (error?.code === "SKIPPED_NO_CANDIDATE_SUCCESS") {
      return "not_needed";
    }

    return "failed";
  }

  return "not_needed";
}

function deriveLegacyReportStage(input: unknown): z.infer<typeof ReportStageSchema> {
  if (!isRecord(input)) {
    return "resolved";
  }

  if (typeof input.reportStage === "string") {
    return input.reportStage as z.infer<typeof ReportStageSchema>;
  }

  if (input.status === "failed") {
    return "failed";
  }

  const judgeStatus = deriveLegacyJudgeStatus(input);
  if (judgeStatus === "pending") {
    return "awaiting_judge";
  }

  if (judgeStatus === "running") {
    return "judge_running";
  }

  return "resolved";
}

const SynthesisReportObjectSchema = z
  .object({
    id: EntityIdSchema,
    prompt: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    status: z.enum(["ready", "partial", "failed"]),
    candidateMode: CandidateModeSchema.default("multi"),
    pendingJudge: z.boolean().default(false),
    reportStage: ReportStageSchema.default("resolved"),
    judgeStatus: JudgeStatusSchema.default("not_needed"),
    executionPlan: ExecutionPlanSchema.nullable().default(null),
    consensus: ConsensusSectionSchema,
    conflicts: z.array(ConflictPointSchema),
    resolution: ResolutionSchema.nullable(),
    nextActions: z.array(NonEmptyStringSchema),
    modelRuns: z.array(ModelRunSchema).min(1),
    createdAt: IsoDatetimeSchema,
  })
  .strict();

export const SynthesisReportSchema = z
  .preprocess((input) => {
    if (!isRecord(input)) {
      return input;
    }

    return {
      ...input,
      reportStage: deriveLegacyReportStage(input),
      judgeStatus: deriveLegacyJudgeStatus(input),
      executionPlan: "executionPlan" in input ? input.executionPlan : null,
    };
  }, SynthesisReportObjectSchema)
  .superRefine((value, ctx) => {
    const conflictIds = new Set(value.conflicts.map((conflict) => conflict.id));

    if (value.status === "failed" && value.resolution !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed reports must not include a resolution",
        path: ["resolution"],
      });
    }

    // When pendingJudge is true, a partial report without resolution is allowed
    if (value.status !== "failed" && value.resolution === null && !value.pendingJudge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ready and partial reports must include a resolution (or set pendingJudge=true)",
        path: ["resolution"],
      });
    }

    if (value.status !== "failed" && !value.modelRuns.some((run) => run.status === "completed")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ready and partial reports must include at least one completed run",
        path: ["modelRuns"],
      });
    }

    if (value.resolution !== null) {
      for (const [index, conflictId] of value.resolution.resolvedConflictIds.entries()) {
        if (!conflictIds.has(conflictId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "resolvedConflictIds must reference conflicts declared on the report",
            path: ["resolution", "resolvedConflictIds", index],
          });
        }
      }
    }

    if (value.status === "failed" && value.reportStage !== "failed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed reports must set reportStage='failed'",
        path: ["reportStage"],
      });
    }

    if (value.reportStage === "failed" && value.status !== "failed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reportStage='failed' requires status='failed'",
        path: ["status"],
      });
    }

    if (value.pendingJudge !== (value.reportStage === "awaiting_judge")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pendingJudge must match reportStage='awaiting_judge'",
        path: ["pendingJudge"],
      });
    }

    if (value.reportStage === "awaiting_judge" && value.judgeStatus !== "pending") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "awaiting_judge reports must set judgeStatus='pending'",
        path: ["judgeStatus"],
      });
    }

    if (value.judgeStatus === "pending" && value.reportStage !== "awaiting_judge") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "judgeStatus='pending' requires reportStage='awaiting_judge'",
        path: ["reportStage"],
      });
    }

    if (value.reportStage === "awaiting_judge" && value.resolution !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "awaiting_judge reports must not include a resolution yet",
        path: ["resolution"],
      });
    }

    if (value.executionPlan !== null) {
      const candidateCount = value.executionPlan.candidateSlots.length;
      const expectedMode =
        candidateCount === 1 ? "single" : candidateCount === 2 ? "dual" : "multi";

      if (value.candidateMode !== expectedMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "candidateMode must match the executionPlan candidate count",
          path: ["candidateMode"],
        });
      }
    }
  });

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ModelRunUsage = z.infer<typeof ModelRunUsageSchema>;
export type ConsensusItem = z.infer<typeof ConsensusItemSchema>;
export type ConflictPosition = z.infer<typeof ConflictPositionSchema>;
export type ConflictPoint = z.infer<typeof ConflictPointSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type CandidateConsensusItem = z.infer<typeof CandidateConsensusItemSchema>;
export type CandidateConflictObservation = z.infer<typeof CandidateConflictObservationSchema>;
export type CandidateModelOutput = z.infer<typeof CandidateModelOutputSchema>;
export type JudgeModelOutput = z.infer<typeof JudgeModelOutputSchema>;
export type ParsedModelOutput = z.infer<typeof ParsedModelOutputSchema>;
export type ModelRunError = z.infer<typeof ModelRunErrorSchema>;
export type ModelRunValidation = z.infer<typeof ModelRunValidationSchema>;
export type ModelRun = z.infer<typeof ModelRunSchema>;
export type ConsensusSection = z.infer<typeof ConsensusSectionSchema>;
export type CandidateMode = z.infer<typeof CandidateModeSchema>;
export type ReportStage = z.infer<typeof ReportStageSchema>;
export type JudgeStatus = z.infer<typeof JudgeStatusSchema>;
export type ConflictMode = z.infer<typeof ConflictModeSchema>;
export type ExecutionPlanSlot = z.infer<typeof ExecutionPlanSlotSchema>;
export type ExecutionPlanSource = z.infer<typeof ExecutionPlanSourceSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type SynthesisReport = z.infer<typeof SynthesisReportSchema>;
