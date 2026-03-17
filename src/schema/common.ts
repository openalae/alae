import { z } from "zod";

export const NonEmptyStringSchema = z.string().trim().min(1);
export const EntityIdSchema = NonEmptyStringSchema;
export const IsoDatetimeSchema = z.string().datetime({ offset: true });
export const NullableIsoDatetimeSchema = IsoDatetimeSchema.nullable();
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const NullableNonNegativeIntegerSchema = NonNegativeIntegerSchema.nullable();

export const RunStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export const ValidationStatusSchema = z.enum(["pending", "passed", "failed"]);
export const ModelRoleSchema = z.enum(["strong", "fast", "judge"]);
export const ConflictSeveritySchema = z.enum(["low", "medium", "high"]);
export const ConflictCategorySchema = z.enum([
  "fact",
  "code",
  "approach",
  "parameter",
  "tooling",
  "other",
]);
export const NodeStatusSchema = z.enum(["idle", "running", "completed", "failed"]);
export const TraceLevelSchema = z.enum(["info", "warning", "error"]);
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export const ConsensusItemKindSchema = z.enum([
  "fact",
  "code",
  "approach",
  "risk",
  "assumption",
]);

export type EntityId = z.infer<typeof EntityIdSchema>;
export type IsoDatetime = z.infer<typeof IsoDatetimeSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;
export type ModelRole = z.infer<typeof ModelRoleSchema>;
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;
export type ConflictCategory = z.infer<typeof ConflictCategorySchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type TraceLevel = z.infer<typeof TraceLevelSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ConsensusItemKind = z.infer<typeof ConsensusItemKindSchema>;
