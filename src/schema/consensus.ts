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
    highlights: z.array(NonEmptyStringSchema).default([]),
    synthesisModelRunId: EntityIdSchema.nullable().default(null),
    openRisks: z.array(NonEmptyStringSchema),
  })
  .strip();

export const CandidateConsensusItemSchema = z
  .object({
    kind: z.preprocess(
      (val) => (typeof val === "string" && ConsensusItemKindSchema.safeParse(val).success ? val : "other"),
      ConsensusItemKindSchema,
    ),
    statement: NonEmptyStringSchema,
    confidence: z.preprocess(
      (val) => (typeof val === "string" && ConfidenceSchema.safeParse(val).success ? val : "medium"),
      ConfidenceSchema,
    ),
  })
  .strip();

/** Strict version for internal persistence / test assertions. */
export const CandidateConsensusItemStrictSchema = z
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
    category: z.preprocess(
      (val) => (typeof val === "string" && ConflictCategorySchema.safeParse(val).success ? val : "other"),
      ConflictCategorySchema,
    ),
    severity: z.preprocess(
      (val) => (typeof val === "string" && ConflictSeveritySchema.safeParse(val).success ? val : "medium"),
      ConflictSeveritySchema,
    ),
    question: NonEmptyStringSchema,
    stance: NonEmptyStringSchema,
  })
  .strip();

export const CandidateModelOutputSchema = z
  .object({
    outputType: z.literal("candidate").default("candidate"),
    summary: NonEmptyStringSchema,
    consensusItems: z.array(CandidateConsensusItemSchema).default([]),
    conflictObservations: z.array(CandidateConflictObservationSchema).default([]),
    recommendedActions: z.array(NonEmptyStringSchema).default([]),
  })
  .strip();

export const SynthesisModelOutputSchema = z
  .object({
    outputType: z.literal("synthesis").default("synthesis"),
    summary: NonEmptyStringSchema,
    chosenApproach: NonEmptyStringSchema,
    rationale: NonEmptyStringSchema,
    highlights: z.array(NonEmptyStringSchema).default([]),
    openRisks: z.array(NonEmptyStringSchema).default([]),
  })
  .strip();

/** @deprecated Kept for backward-compatible parsing of persisted judge runs. */
export const LegacyJudgeModelOutputSchema = z
  .object({
    outputType: z.literal("judge"),
    summary: NonEmptyStringSchema,
    chosenApproach: NonEmptyStringSchema,
    rationale: NonEmptyStringSchema,
    resolvedConflictIds: z.array(EntityIdSchema).default([]),
    openRisks: z.array(NonEmptyStringSchema).default([]),
  })
  .strip();

export const ParsedModelOutputSchema = z.discriminatedUnion("outputType", [
  CandidateModelOutputSchema,
  SynthesisModelOutputSchema,
  LegacyJudgeModelOutputSchema,
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
  "awaiting_synthesis",
  "synthesized",
  "resolved",
  "failed",
]);
export const SynthesisStatusSchema = z.enum([
  "not_needed",
  "pending",
  "running",
  "completed",
  "failed",
  "off",
]);
export const SynthesisModeSchema = z.preprocess(
  (val) => (val === "off" ? "manual" : val),
  z.enum(["auto", "manual"]),
);

/** @deprecated Kept for backward-compatible parsing. */
export const JudgeStatusSchema = SynthesisStatusSchema;
/** @deprecated Kept for backward-compatible parsing. */
export const ConflictModeSchema = SynthesisModeSchema;

export const ExecutionPlanSlotSchema = z
  .object({
    id: NonEmptyStringSchema,
    provider: NonEmptyStringSchema,
    modelId: NonEmptyStringSchema,
    role: ModelRoleSchema,
    outputType: z.enum(["candidate", "judge", "synthesis"]),
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

const ExecutionPlanObjectSchema = z
  .object({
    version: z.literal(1),
    candidateSlots: z.array(ExecutionPlanSlotSchema).min(1).max(3),
    synthesisSlot: ExecutionPlanSlotSchema.nullable().default(null),
    synthesisMode: SynthesisModeSchema.default("auto"),
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

      if (slot.role === "judge" || slot.role === "synthesis") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "candidateSlots cannot include judge or synthesis roles",
          path: ["candidateSlots", index, "role"],
        });
      }
    });

    if (value.synthesisSlot) {
      if (value.synthesisSlot.outputType !== "synthesis" && value.synthesisSlot.outputType !== "judge") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "synthesisSlot must use outputType='synthesis'",
          path: ["synthesisSlot", "outputType"],
        });
      }
    }
  });

export const ExecutionPlanSchema = z.preprocess(
  (input) => {
    if (!isRecord(input)) return input;
    return migrateExecutionPlan(input);
  },
  ExecutionPlanObjectSchema,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deriveSynthesisStatus(input: unknown): z.infer<typeof SynthesisStatusSchema> {
  if (!isRecord(input)) {
    return "not_needed";
  }

  // New-format field
  if (typeof input.synthesisStatus === "string") {
    return input.synthesisStatus as z.infer<typeof SynthesisStatusSchema>;
  }

  // Legacy judge-based fields
  if (typeof input.judgeStatus === "string") {
    const legacyStatus = input.judgeStatus as string;
    if (legacyStatus === "completed") return "completed";
    if (legacyStatus === "pending") return "pending";
    if (legacyStatus === "running") return "running";
    if (legacyStatus === "failed") return "failed";
    return "not_needed";
  }

  if (input.pendingJudge === true || input.pendingSynthesis === true) {
    return "pending";
  }

  return "not_needed";
}

function deriveReportStage(input: unknown): z.infer<typeof ReportStageSchema> {
  if (!isRecord(input)) {
    return "resolved";
  }

  if (typeof input.reportStage === "string") {
    const stage = input.reportStage as string;
    // Map legacy stages to new ones
    if (stage === "awaiting_judge") return "awaiting_synthesis";
    if (stage === "judge_running") return "awaiting_synthesis";
    return stage as z.infer<typeof ReportStageSchema>;
  }

  if (input.status === "failed") {
    return "failed";
  }

  const synthStatus = deriveSynthesisStatus(input);
  if (synthStatus === "pending" || synthStatus === "running") {
    return "awaiting_synthesis";
  }

  if (synthStatus === "completed") {
    return "synthesized";
  }

  return "resolved";
}

/** Migrate legacy resolution fields (judgeModelRunId → synthesisModelRunId, resolvedConflictIds → highlights). */
function migrateResolution(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const result = { ...input };
  if ("judgeModelRunId" in result && !("synthesisModelRunId" in result)) {
    result.synthesisModelRunId = result.judgeModelRunId;
    delete result.judgeModelRunId;
  }
  if ("resolvedConflictIds" in result && !("highlights" in result)) {
    result.highlights = [];
    delete result.resolvedConflictIds;
  }
  return result;
}

/** Migrate legacy ExecutionPlan (judgeSlot → synthesisSlot, conflictMode → synthesisMode). */
function migrateExecutionPlan(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const result = { ...input };
  if ("judgeSlot" in result && !("synthesisSlot" in result)) {
    const legacySlot = result.judgeSlot;
    if (isRecord(legacySlot)) {
      result.synthesisSlot = { ...legacySlot, role: "synthesis", outputType: "synthesis" };
    } else {
      result.synthesisSlot = null;
    }
    delete result.judgeSlot;
  }
  if ("conflictMode" in result && !("synthesisMode" in result)) {
    result.synthesisMode = result.conflictMode;
    delete result.conflictMode;
  }
  return result;
}

const SynthesisReportObjectSchema = z
  .object({
    id: EntityIdSchema,
    prompt: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    status: z.enum(["ready", "partial", "failed"]),
    candidateMode: CandidateModeSchema.default("multi"),
    pendingSynthesis: z.boolean().default(false),
    reportStage: ReportStageSchema.default("resolved"),
    synthesisStatus: SynthesisStatusSchema.default("not_needed"),
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

    const migrated = { ...input };

    // Migrate legacy pendingJudge → pendingSynthesis
    if ("pendingJudge" in migrated && !("pendingSynthesis" in migrated)) {
      migrated.pendingSynthesis = migrated.pendingJudge;
      delete migrated.pendingJudge;
    }
    // Remove leftover legacy judgeStatus key (replaced by synthesisStatus)
    if ("judgeStatus" in migrated) {
      delete migrated.judgeStatus;
    }

    // Migrate legacy resolution fields
    if (isRecord(migrated.resolution)) {
      migrated.resolution = migrateResolution(migrated.resolution);
    }

    // Migrate legacy execution plan
    if (isRecord(migrated.executionPlan)) {
      migrated.executionPlan = migrateExecutionPlan(migrated.executionPlan);
    }

    return {
      ...migrated,
      reportStage: deriveReportStage(migrated),
      synthesisStatus: deriveSynthesisStatus(migrated),
      executionPlan: "executionPlan" in migrated ? migrated.executionPlan : null,
    };
  }, SynthesisReportObjectSchema)
  .superRefine((value, ctx) => {
    if (value.status === "failed" && value.resolution !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed reports must not include a resolution",
        path: ["resolution"],
      });
    }

    // When pendingSynthesis is true, a partial report without resolution is allowed
    if (value.status !== "failed" && value.resolution === null && !value.pendingSynthesis) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ready and partial reports must include a resolution (or set pendingSynthesis=true)",
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

    if (value.pendingSynthesis !== (value.reportStage === "awaiting_synthesis")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pendingSynthesis must match reportStage='awaiting_synthesis'",
        path: ["pendingSynthesis"],
      });
    }

    if (value.reportStage === "awaiting_synthesis" && value.synthesisStatus !== "pending") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "awaiting_synthesis reports must set synthesisStatus='pending'",
        path: ["synthesisStatus"],
      });
    }

    if (value.reportStage === "awaiting_synthesis" && value.resolution !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "awaiting_synthesis reports must not include a resolution yet",
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
export type SynthesisModelOutput = z.infer<typeof SynthesisModelOutputSchema>;
/** @deprecated Use SynthesisModelOutput instead. */
export type JudgeModelOutput = z.infer<typeof LegacyJudgeModelOutputSchema>;
export type ParsedModelOutput = z.infer<typeof ParsedModelOutputSchema>;
export type ModelRunError = z.infer<typeof ModelRunErrorSchema>;
export type ModelRunValidation = z.infer<typeof ModelRunValidationSchema>;
export type ModelRun = z.infer<typeof ModelRunSchema>;
export type ConsensusSection = z.infer<typeof ConsensusSectionSchema>;
export type CandidateMode = z.infer<typeof CandidateModeSchema>;
export type ReportStage = z.infer<typeof ReportStageSchema>;
export type SynthesisStatus = z.infer<typeof SynthesisStatusSchema>;
export type SynthesisMode = z.infer<typeof SynthesisModeSchema>;
/** @deprecated Use SynthesisStatus instead. */
export type JudgeStatus = SynthesisStatus;
/** @deprecated Use SynthesisMode instead. */
export type ConflictMode = SynthesisMode;
export type ExecutionPlanSlot = z.infer<typeof ExecutionPlanSlotSchema>;
export type ExecutionPlanSource = z.infer<typeof ExecutionPlanSourceSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type SynthesisReport = z.infer<typeof SynthesisReportSchema>;
