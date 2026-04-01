import { z } from "zod";

import {
  EntityIdSchema,
  IsoDatetimeSchema,
  NodeStatusSchema,
  NonNegativeIntegerSchema,
  NonEmptyStringSchema,
} from "@/schema/common";
import { ModelRunSchema, SynthesisReportSchema } from "@/schema/consensus";
import { TruthPanelSnapshotSchema } from "@/schema/truth-panel";

export const ConversationSchema = z
  .object({
    id: EntityIdSchema,
    title: NonEmptyStringSchema,
    createdAt: IsoDatetimeSchema,
    updatedAt: IsoDatetimeSchema,
  })
  .strict();

export const ConversationSummarySchema = z
  .object({
    id: EntityIdSchema,
    title: NonEmptyStringSchema,
    updatedAt: IsoDatetimeSchema,
    branchCount: NonNegativeIntegerSchema,
    nodeCount: NonNegativeIntegerSchema,
    latestNodeStatus: NodeStatusSchema.nullable(),
  })
  .strict();

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
    truthPanelSnapshot: TruthPanelSnapshotSchema.nullable(),
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

    if (value.truthPanelSnapshot !== null && value.synthesisReport === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "truthPanelSnapshot requires a synthesis report snapshot",
        path: ["truthPanelSnapshot"],
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

export const LoadedConversationSchema = z
  .object({
    conversation: ConversationSchema,
    branches: z.array(ConversationBranchSchema),
    nodes: z.array(ConversationNodeSchema),
    modelRuns: z.array(ModelRunSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    const branchIds = new Set(value.branches.map((branch) => branch.id));
    const nodeIds = new Set(value.nodes.map((node) => node.id));

    value.branches.forEach((branch, index) => {
      if (branch.conversationId !== value.conversation.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "branch conversationId must match the loaded conversation id",
          path: ["branches", index, "conversationId"],
        });
      }

      for (const [field, nodeId] of [
        ["sourceNodeId", branch.sourceNodeId],
        ["rootNodeId", branch.rootNodeId],
        ["headNodeId", branch.headNodeId],
      ] as const) {
        if (nodeId !== null && !nodeIds.has(nodeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} must reference a node included in the loaded conversation`,
            path: ["branches", index, field],
          });
        }
      }
    });

    value.nodes.forEach((node, index) => {
      if (node.conversationId !== value.conversation.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "node conversationId must match the loaded conversation id",
          path: ["nodes", index, "conversationId"],
        });
      }

      if (!branchIds.has(node.branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "node branchId must reference a branch included in the loaded conversation",
          path: ["nodes", index, "branchId"],
        });
      }

      if (node.parentNodeId !== null && !nodeIds.has(node.parentNodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "node parentNodeId must reference a node included in the loaded conversation",
          path: ["nodes", index, "parentNodeId"],
        });
      }
    });
  });

export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationNode = z.infer<typeof ConversationNodeSchema>;
export type ConversationBranch = z.infer<typeof ConversationBranchSchema>;
export type LoadedConversation = z.infer<typeof LoadedConversationSchema>;
