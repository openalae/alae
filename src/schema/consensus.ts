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

export const SynthesisReportSchema = z
  .object({
    id: EntityIdSchema,
    prompt: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    status: z.enum(["ready", "partial", "failed"]),
    consensus: ConsensusSectionSchema,
    conflicts: z.array(ConflictPointSchema),
    resolution: ResolutionSchema.nullable(),
    nextActions: z.array(NonEmptyStringSchema),
    modelRuns: z.array(ModelRunSchema).min(1),
    createdAt: IsoDatetimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const conflictIds = new Set(value.conflicts.map((conflict) => conflict.id));

    if (value.status === "failed" && value.resolution !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed reports must not include a resolution",
        path: ["resolution"],
      });
    }

    if (value.status !== "failed" && value.resolution === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ready and partial reports must include a resolution",
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
export type SynthesisReport = z.infer<typeof SynthesisReportSchema>;
