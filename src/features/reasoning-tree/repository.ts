import type { PGlite, Transaction } from "@electric-sql/pglite";
import { z } from "zod";

import {
  ConversationBranchSchema,
  ConversationNodeSchema,
  ConversationSchema,
  LoadedConversationSchema,
  ModelRunSchema,
  NodeStatusSchema,
  SynthesisReportSchema,
  type Conversation,
  type ConversationBranch,
  type ConversationNode,
  type LoadedConversation,
  type ModelRun,
  type NodeStatus,
  type SynthesisReport,
} from "@/schema";
import { EntityIdSchema, IsoDatetimeSchema, NonEmptyStringSchema } from "@/schema";
import {
  bootstrapReasoningTreeDatabase,
  closeDefaultReasoningTreeDatabase,
  createReasoningTreeDatabase,
  getDefaultReasoningTreeDatabase,
} from "@/features/reasoning-tree/database";

const DEFAULT_CONVERSATION_TITLE = "Untitled conversation";

const CreateConversationInputSchema = z
  .object({
    id: EntityIdSchema.optional(),
    title: NonEmptyStringSchema.optional(),
    createdAt: IsoDatetimeSchema.optional(),
  })
  .strict();

const AppendNodeInputSchema = z
  .object({
    conversationId: EntityIdSchema,
    branchId: EntityIdSchema,
    id: EntityIdSchema.optional(),
    title: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema,
    status: NodeStatusSchema.optional(),
    synthesisReport: SynthesisReportSchema.nullable().optional(),
    createdAt: IsoDatetimeSchema.optional(),
    updatedAt: IsoDatetimeSchema.optional(),
  })
  .strict();

const ForkNodeInputSchema = z
  .object({
    conversationId: EntityIdSchema,
    sourceNodeId: EntityIdSchema,
    id: EntityIdSchema.optional(),
    name: NonEmptyStringSchema,
    createdAt: IsoDatetimeSchema.optional(),
    updatedAt: IsoDatetimeSchema.optional(),
  })
  .strict();

type Queryable = Pick<PGlite, "query"> | Transaction;

type ConversationRow = {
  id: string;
  title: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type BranchRow = {
  id: string;
  conversationId: string;
  name: string;
  sourceNodeId: string | null;
  rootNodeId: string | null;
  headNodeId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type NodeRow = {
  id: string;
  conversationId: string;
  branchId: string;
  parentNodeId: string | null;
  title: string;
  prompt: string;
  status: NodeStatus;
  synthesisReportJson: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ModelRunRow = {
  id: string;
  provider: string;
  model: string;
  role: ModelRun["role"];
  status: ModelRun["status"];
  startedAt: string | Date;
  completedAt: string | Date | null;
  latencyMs: number | null;
  rawText: string | null;
  usageJson: string;
  parsedJson: string | null;
  validationJson: string;
  errorJson: string | null;
};

export type CreateConversationInput = z.input<typeof CreateConversationInputSchema>;
export type AppendNodeInput = z.input<typeof AppendNodeInputSchema>;
export type ForkNodeInput = z.input<typeof ForkNodeInputSchema>;

export type CreateReasoningTreeRepositoryOptions = {
  dataDir?: string;
  db?: PGlite;
};

export type ReasoningTreeRepository = {
  createConversation: (input?: CreateConversationInput) => Promise<LoadedConversation>;
  appendNode: (input: AppendNodeInput) => Promise<ConversationNode>;
  forkNode: (input: ForkNodeInput) => Promise<ConversationBranch>;
  loadConversation: (id: string) => Promise<LoadedConversation | null>;
  close: () => Promise<void>;
};

function createEntityId() {
  return globalThis.crypto.randomUUID();
}

function getTimestamp() {
  return new Date().toISOString();
}

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function deserializeJson<TValue>(value: string | null): TValue | null {
  return value === null ? null : (JSON.parse(value) as TValue);
}

function normalizeIsoDatetime(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function mapConversationRow(row: ConversationRow): Conversation {
  return ConversationSchema.parse({
    ...row,
    createdAt: normalizeIsoDatetime(row.createdAt),
    updatedAt: normalizeIsoDatetime(row.updatedAt),
  });
}

function mapBranchRow(row: BranchRow): ConversationBranch {
  return ConversationBranchSchema.parse({
    ...row,
    createdAt: normalizeIsoDatetime(row.createdAt),
    updatedAt: normalizeIsoDatetime(row.updatedAt),
  });
}

function mapNodeRow(row: NodeRow): ConversationNode {
  const { synthesisReportJson, ...nodeFields } = row;

  return ConversationNodeSchema.parse({
    ...nodeFields,
    createdAt: normalizeIsoDatetime(row.createdAt),
    updatedAt: normalizeIsoDatetime(row.updatedAt),
    synthesisReport:
      synthesisReportJson === null
        ? null
        : SynthesisReportSchema.parse(deserializeJson(synthesisReportJson)),
  });
}

function mapModelRunRow(row: ModelRunRow): ModelRun {
  return ModelRunSchema.parse({
    id: row.id,
    provider: row.provider,
    model: row.model,
    role: row.role,
    status: row.status,
    startedAt: normalizeIsoDatetime(row.startedAt),
    completedAt: row.completedAt === null ? null : normalizeIsoDatetime(row.completedAt),
    latencyMs: row.latencyMs,
    usage: deserializeJson(row.usageJson),
    parsed: deserializeJson(row.parsedJson),
    validation: deserializeJson(row.validationJson),
    error: deserializeJson(row.errorJson),
    rawText: row.rawText,
  });
}

async function assertConversationExists(db: Queryable, conversationId: string) {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM conversations WHERE id = $1 LIMIT 1`,
    [conversationId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Conversation ${conversationId} was not found.`);
  }
}

async function getBranchById(db: Queryable, branchId: string) {
  const result = await db.query<BranchRow>(
    `
      SELECT
        id,
        conversation_id AS "conversationId",
        name,
        source_node_id AS "sourceNodeId",
        root_node_id AS "rootNodeId",
        head_node_id AS "headNodeId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM conversation_branches
      WHERE id = $1
      LIMIT 1
    `,
    [branchId],
  );

  return result.rows[0] ?? null;
}

async function getNodeById(db: Queryable, nodeId: string) {
  const result = await db.query<NodeRow>(
    `
      SELECT
        id,
        conversation_id AS "conversationId",
        branch_id AS "branchId",
        parent_node_id AS "parentNodeId",
        title,
        prompt,
        status,
        synthesis_report::text AS "synthesisReportJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM conversation_nodes
      WHERE id = $1
      LIMIT 1
    `,
    [nodeId],
  );

  return result.rows[0] ?? null;
}

async function insertModelRuns(
  db: Queryable,
  conversationId: string,
  nodeId: string,
  report: SynthesisReport,
) {
  for (const run of report.modelRuns) {
    await db.query(
      `
        INSERT INTO model_runs (
          id,
          conversation_id,
          node_id,
          report_id,
          provider,
          model,
          role,
          status,
          started_at,
          completed_at,
          latency_ms,
          raw_text,
          usage,
          parsed,
          validation,
          error
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          CAST($13 AS jsonb),
          CAST($14 AS jsonb),
          CAST($15 AS jsonb),
          CAST($16 AS jsonb)
        )
      `,
      [
        run.id,
        conversationId,
        nodeId,
        report.id,
        run.provider,
        run.model,
        run.role,
        run.status,
        run.startedAt,
        run.completedAt,
        run.latencyMs,
        run.rawText,
        serializeJson(run.usage),
        run.parsed === null ? null : serializeJson(run.parsed),
        serializeJson(run.validation),
        run.error === null ? null : serializeJson(run.error),
      ],
    );
  }
}

class ReasoningTreeRepositoryImpl implements ReasoningTreeRepository {
  private readonly dbPromise: Promise<PGlite>;
  private readonly closeDatabase: () => Promise<void>;

  constructor(options: CreateReasoningTreeRepositoryOptions = {}) {
    if (options.db) {
      this.dbPromise = bootstrapReasoningTreeDatabase(options.db);
      this.closeDatabase = async () => {
        await options.db!.close();
      };
      return;
    }

    if (options.dataDir) {
      this.dbPromise = createReasoningTreeDatabase(options.dataDir);
      this.closeDatabase = async () => {
        const db = await this.dbPromise;
        await db.close();
      };
      return;
    }

    this.dbPromise = getDefaultReasoningTreeDatabase();
    this.closeDatabase = closeDefaultReasoningTreeDatabase;
  }

  async createConversation(input: CreateConversationInput = {}): Promise<LoadedConversation> {
    const value = CreateConversationInputSchema.parse(input);
    const createdAt = value.createdAt ?? getTimestamp();
    const conversationId = value.id ?? createEntityId();
    const branchId = createEntityId();
    const title = value.title ?? DEFAULT_CONVERSATION_TITLE;
    const db = await this.dbPromise;

    await db.transaction(async (tx) => {
      await tx.query(
        `
          INSERT INTO conversations (id, title, created_at, updated_at)
          VALUES ($1, $2, $3, $4)
        `,
        [conversationId, title, createdAt, createdAt],
      );

      await tx.query(
        `
          INSERT INTO conversation_branches (
            id,
            conversation_id,
            name,
            source_node_id,
            root_node_id,
            head_node_id,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, NULL, NULL, NULL, $4, $5)
        `,
        [branchId, conversationId, "main", createdAt, createdAt],
      );
    });

    const loadedConversation = await this.loadConversation(conversationId);

    if (loadedConversation === null) {
      throw new Error(`Conversation ${conversationId} could not be loaded after creation.`);
    }

    return loadedConversation;
  }

  async appendNode(input: AppendNodeInput): Promise<ConversationNode> {
    const value = AppendNodeInputSchema.parse(input);
    const createdAt = value.createdAt ?? getTimestamp();
    const updatedAt = value.updatedAt ?? createdAt;
    const nodeId = value.id ?? createEntityId();
    const synthesisReport =
      value.synthesisReport === undefined ? null : SynthesisReportSchema.parse(value.synthesisReport);
    const status = value.status ?? (synthesisReport === null ? "idle" : "completed");
    const db = await this.dbPromise;

    return db.transaction(async (tx) => {
      await assertConversationExists(tx, value.conversationId);

      const branch = await getBranchById(tx, value.branchId);

      if (branch === null) {
        throw new Error(`Branch ${value.branchId} was not found.`);
      }

      if (branch.conversationId !== value.conversationId) {
        throw new Error(
          `Branch ${value.branchId} does not belong to conversation ${value.conversationId}.`,
        );
      }

      const node = ConversationNodeSchema.parse({
        id: nodeId,
        conversationId: value.conversationId,
        branchId: value.branchId,
        parentNodeId: branch.headNodeId,
        title: value.title,
        prompt: value.prompt,
        status,
        synthesisReport,
        createdAt,
        updatedAt,
      });

      await tx.query(
        `
          INSERT INTO conversation_nodes (
            id,
            conversation_id,
            branch_id,
            parent_node_id,
            title,
            prompt,
            status,
            synthesis_report,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            CAST($8 AS jsonb),
            $9,
            $10
          )
        `,
        [
          node.id,
          node.conversationId,
          node.branchId,
          node.parentNodeId,
          node.title,
          node.prompt,
          node.status,
          node.synthesisReport === null ? null : serializeJson(node.synthesisReport),
          node.createdAt,
          node.updatedAt,
        ],
      );

      if (node.synthesisReport !== null) {
        await insertModelRuns(tx, node.conversationId, node.id, node.synthesisReport);
      }

      await tx.query(
        `
          UPDATE conversation_branches
          SET
            root_node_id = COALESCE(root_node_id, $2),
            head_node_id = $2,
            updated_at = $3
          WHERE id = $1
        `,
        [branch.id, node.id, updatedAt],
      );

      await tx.query(
        `
          UPDATE conversations
          SET updated_at = $2
          WHERE id = $1
        `,
        [value.conversationId, updatedAt],
      );

      return node;
    });
  }

  async forkNode(input: ForkNodeInput): Promise<ConversationBranch> {
    const value = ForkNodeInputSchema.parse(input);
    const createdAt = value.createdAt ?? getTimestamp();
    const updatedAt = value.updatedAt ?? createdAt;
    const branchId = value.id ?? createEntityId();
    const db = await this.dbPromise;

    return db.transaction(async (tx) => {
      await assertConversationExists(tx, value.conversationId);

      const sourceNode = await getNodeById(tx, value.sourceNodeId);

      if (sourceNode === null) {
        throw new Error(`Node ${value.sourceNodeId} was not found.`);
      }

      if (sourceNode.conversationId !== value.conversationId) {
        throw new Error(
          `Node ${value.sourceNodeId} does not belong to conversation ${value.conversationId}.`,
        );
      }

      const branch = ConversationBranchSchema.parse({
        id: branchId,
        conversationId: value.conversationId,
        name: value.name,
        sourceNodeId: sourceNode.id,
        rootNodeId: sourceNode.id,
        headNodeId: sourceNode.id,
        createdAt,
        updatedAt,
      });

      await tx.query(
        `
          INSERT INTO conversation_branches (
            id,
            conversation_id,
            name,
            source_node_id,
            root_node_id,
            head_node_id,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          branch.id,
          branch.conversationId,
          branch.name,
          branch.sourceNodeId,
          branch.rootNodeId,
          branch.headNodeId,
          branch.createdAt,
          branch.updatedAt,
        ],
      );

      await tx.query(
        `
          UPDATE conversations
          SET updated_at = $2
          WHERE id = $1
        `,
        [value.conversationId, updatedAt],
      );

      return branch;
    });
  }

  async loadConversation(id: string): Promise<LoadedConversation | null> {
    const conversationId = EntityIdSchema.parse(id);
    const db = await this.dbPromise;
    const conversationResult = await db.query<ConversationRow>(
      `
      SELECT
        id,
        title,
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM conversations
      WHERE id = $1
      LIMIT 1
      `,
      [conversationId],
    );

    const conversationRow = conversationResult.rows[0];

    if (!conversationRow) {
      return null;
    }

    const [branchesResult, nodesResult, modelRunsResult] = await Promise.all([
      db.query<BranchRow>(
        `
          SELECT
            id,
            conversation_id AS "conversationId",
            name,
            source_node_id AS "sourceNodeId",
            root_node_id AS "rootNodeId",
            head_node_id AS "headNodeId",
            created_at::text AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM conversation_branches
          WHERE conversation_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [conversationId],
      ),
      db.query<NodeRow>(
        `
          SELECT
            id,
            conversation_id AS "conversationId",
            branch_id AS "branchId",
            parent_node_id AS "parentNodeId",
            title,
            prompt,
            status,
            synthesis_report::text AS "synthesisReportJson",
            created_at::text AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM conversation_nodes
          WHERE conversation_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [conversationId],
      ),
      db.query<ModelRunRow>(
        `
          SELECT
            id,
            provider,
            model,
            role,
            status,
            started_at::text AS "startedAt",
            completed_at::text AS "completedAt",
            latency_ms AS "latencyMs",
            raw_text AS "rawText",
            usage::text AS "usageJson",
            parsed::text AS "parsedJson",
            validation::text AS "validationJson",
            error::text AS "errorJson"
          FROM model_runs
          WHERE conversation_id = $1
          ORDER BY started_at ASC, id ASC
        `,
        [conversationId],
      ),
    ]);

    return LoadedConversationSchema.parse({
      conversation: mapConversationRow(conversationRow),
      branches: branchesResult.rows.map(mapBranchRow),
      nodes: nodesResult.rows.map(mapNodeRow),
      modelRuns: modelRunsResult.rows.map(mapModelRunRow),
    });
  }

  async close(): Promise<void> {
    await this.closeDatabase();
  }
}

export function createReasoningTreeRepository(
  options: CreateReasoningTreeRepositoryOptions = {},
): ReasoningTreeRepository {
  return new ReasoningTreeRepositoryImpl(options);
}
