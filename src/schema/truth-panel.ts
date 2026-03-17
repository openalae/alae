import { z } from "zod";

import {
  EntityIdSchema,
  IsoDatetimeSchema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  NullableNonNegativeIntegerSchema,
  TraceLevelSchema,
} from "@/schema/common";
import { ModelRunSchema, ValidationIssueSchema } from "@/schema/consensus";

export const TraceEventSchema = z
  .object({
    id: EntityIdSchema,
    scope: NonEmptyStringSchema,
    level: TraceLevelSchema,
    message: NonEmptyStringSchema,
    occurredAt: IsoDatetimeSchema,
  })
  .strict();

export const RunSummarySchema = z
  .object({
    totalRuns: NonNegativeIntegerSchema,
    pendingRuns: NonNegativeIntegerSchema,
    runningRuns: NonNegativeIntegerSchema,
    completedRuns: NonNegativeIntegerSchema,
    failedRuns: NonNegativeIntegerSchema,
    aggregateInputTokens: NullableNonNegativeIntegerSchema,
    aggregateOutputTokens: NullableNonNegativeIntegerSchema,
    aggregateTotalTokens: NullableNonNegativeIntegerSchema,
    aggregateLatencyMs: NullableNonNegativeIntegerSchema,
    maxLatencyMs: NullableNonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const accountedRuns =
      value.pendingRuns + value.runningRuns + value.completedRuns + value.failedRuns;

    if (value.totalRuns !== accountedRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "run summary counts must add up to totalRuns",
        path: ["totalRuns"],
      });
    }
  });

export const TruthPanelSnapshotSchema = z
  .object({
    reportId: EntityIdSchema.nullable(),
    generatedAt: IsoDatetimeSchema,
    runSummary: RunSummarySchema,
    runs: z.array(ModelRunSchema),
    validationIssues: z.array(ValidationIssueSchema),
    events: z.array(TraceEventSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    const runIds = new Set(value.runs.map((run) => run.id));
    const totalRuns = value.runs.length;
    const pendingRuns = value.runs.filter((run) => run.status === "pending").length;
    const runningRuns = value.runs.filter((run) => run.status === "running").length;
    const completedRuns = value.runs.filter((run) => run.status === "completed").length;
    const failedRuns = value.runs.filter((run) => run.status === "failed").length;

    if (value.runSummary.totalRuns !== totalRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runSummary.totalRuns must match runs length",
        path: ["runSummary", "totalRuns"],
      });
    }

    if (value.runSummary.pendingRuns !== pendingRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runSummary.pendingRuns must match run statuses",
        path: ["runSummary", "pendingRuns"],
      });
    }

    if (value.runSummary.runningRuns !== runningRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runSummary.runningRuns must match run statuses",
        path: ["runSummary", "runningRuns"],
      });
    }

    if (value.runSummary.completedRuns !== completedRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runSummary.completedRuns must match run statuses",
        path: ["runSummary", "completedRuns"],
      });
    }

    if (value.runSummary.failedRuns !== failedRuns) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runSummary.failedRuns must match run statuses",
        path: ["runSummary", "failedRuns"],
      });
    }

    for (const [index, issue] of value.validationIssues.entries()) {
      if (!runIds.has(issue.runId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validationIssues must reference known runs",
          path: ["validationIssues", index, "runId"],
        });
      }
    }
  });

export type TraceEvent = z.infer<typeof TraceEventSchema>;
export type RunSummary = z.infer<typeof RunSummarySchema>;
export type TruthPanelSnapshot = z.infer<typeof TruthPanelSnapshotSchema>;
