import { z } from "zod";

import {
  EntityIdSchema,
  IsoDatetimeSchema,
  NodeStatusSchema,
  NonEmptyStringSchema,
} from "@/schema/common";
import { SynthesisReportSchema } from "@/schema/consensus";

export const ConversationNodeSchema = z
  .object({
    id: EntityIdSchema,
    conversationId: EntityIdSchema,
    branchId: EntityIdSchema,
    parentNodeId: EntityIdSchema.nullable(),
    title: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema,
    status: NodeStatusSchema,
    synthesisReport: SynthesisReportSchema.nullable(),
    createdAt: IsoDatetimeSchema,
    updatedAt: IsoDatetimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "completed" && value.synthesisReport === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completed nodes must include a synthesis report snapshot",
        path: ["synthesisReport"],
      });
    }
  });

export const ConversationBranchSchema = z
  .object({
    id: EntityIdSchema,
    conversationId: EntityIdSchema,
    name: NonEmptyStringSchema,
    sourceNodeId: EntityIdSchema.nullable(),
    rootNodeId: EntityIdSchema.nullable(),
    headNodeId: EntityIdSchema.nullable(),
    createdAt: IsoDatetimeSchema,
    updatedAt: IsoDatetimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const isEmptyBranch = value.rootNodeId === null && value.headNodeId === null;

    if (!isEmptyBranch && (value.rootNodeId === null || value.headNodeId === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "branches with nodes must include both rootNodeId and headNodeId",
        path: ["headNodeId"],
      });
    }
  });

export type ConversationNode = z.infer<typeof ConversationNodeSchema>;
export type ConversationBranch = z.infer<typeof ConversationBranchSchema>;
