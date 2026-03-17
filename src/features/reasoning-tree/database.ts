import { PGlite } from "@electric-sql/pglite";

export const DEFAULT_REASONING_TREE_DATA_DIR = "idb://alae-reasoning-tree-v1";

const REASONING_TREE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_branches (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_node_id TEXT NULL,
    root_node_id TEXT NULL,
    head_node_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_nodes (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES conversation_branches(id) ON DELETE CASCADE,
    parent_node_id TEXT NULL,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    synthesis_report JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_runs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES conversation_nodes(id) ON DELETE CASCADE,
    report_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    latency_ms INTEGER NULL,
    raw_text TEXT NULL,
    usage JSONB NOT NULL,
    parsed JSONB NULL,
    validation JSONB NOT NULL,
    error JSONB NULL
  );

  CREATE INDEX IF NOT EXISTS idx_conversation_branches_conversation_id
    ON conversation_branches (conversation_id);

  CREATE INDEX IF NOT EXISTS idx_conversation_nodes_conversation_id_created_at
    ON conversation_nodes (conversation_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_conversation_nodes_branch_id_created_at
    ON conversation_nodes (branch_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_conversation_nodes_parent_node_id
    ON conversation_nodes (parent_node_id);

  CREATE INDEX IF NOT EXISTS idx_model_runs_node_id
    ON model_runs (node_id);

  CREATE INDEX IF NOT EXISTS idx_model_runs_report_id
    ON model_runs (report_id);
`;

let defaultDatabasePromise: Promise<PGlite> | null = null;

export async function bootstrapReasoningTreeDatabase(db: PGlite): Promise<PGlite> {
  await db.waitReady;
  await db.exec(REASONING_TREE_SCHEMA_SQL);
  return db;
}

export async function createReasoningTreeDatabase(
  dataDir = DEFAULT_REASONING_TREE_DATA_DIR,
): Promise<PGlite> {
  const db = new PGlite(dataDir);
  return bootstrapReasoningTreeDatabase(db);
}

export function getDefaultReasoningTreeDatabase(): Promise<PGlite> {
  if (defaultDatabasePromise === null) {
    defaultDatabasePromise = createReasoningTreeDatabase().catch((error) => {
      defaultDatabasePromise = null;
      throw error;
    });
  }

  return defaultDatabasePromise;
}

export async function closeDefaultReasoningTreeDatabase(): Promise<void> {
  if (defaultDatabasePromise === null) {
    return;
  }

  const db = await defaultDatabasePromise;
  defaultDatabasePromise = null;
  await db.close();
}
