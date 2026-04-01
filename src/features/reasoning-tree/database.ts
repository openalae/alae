import { PGlite, type PGliteOptions } from "@electric-sql/pglite";
import pgliteDataUrl from "../../../node_modules/@electric-sql/pglite/dist/pglite.data?url";
import pgliteWasmUrl from "../../../node_modules/@electric-sql/pglite/dist/pglite.wasm?url";

export const DEFAULT_REASONING_TREE_DATA_DIR = "idb://alae-reasoning-tree-v1";

type PGliteRuntimeAssets = Pick<PGliteOptions, "fsBundle" | "wasmModule">;

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
    truth_panel_snapshot JSONB NULL,
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

  ALTER TABLE conversation_nodes
    ADD COLUMN IF NOT EXISTS truth_panel_snapshot JSONB NULL;
`;

let defaultDatabasePromise: Promise<PGlite> | null = null;
let defaultDatabaseLeaseCount = 0;
let defaultDatabaseCloseTimer: ReturnType<typeof setTimeout> | null = null;
let runtimeAssetsPromise: Promise<PGliteRuntimeAssets> | null = null;

function runsInBrowserRuntime() {
  return typeof window !== "undefined";
}

async function fetchAsset(url: string, label: string): Promise<Response> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load ${label}. ${response.status} ${response.statusText}`);
  }

  return response;
}

async function compileWasmModule(response: Response): Promise<WebAssembly.Module> {
  if (typeof WebAssembly.compileStreaming === "function") {
    try {
      return await WebAssembly.compileStreaming(response.clone());
    } catch {
      // Some runtimes do not serve wasm with a compatible MIME type in development.
    }
  }

  return WebAssembly.compile(await response.arrayBuffer());
}

async function loadRuntimeAssets(): Promise<PGliteRuntimeAssets> {
  if (!runsInBrowserRuntime()) {
    throw new Error("Bundled PGlite assets are only required in browser runtimes.");
  }

  if (runtimeAssetsPromise === null) {
    runtimeAssetsPromise = Promise.all([
      fetchAsset(pgliteDataUrl, "PGlite filesystem bundle"),
      fetchAsset(pgliteWasmUrl, "PGlite wasm module"),
    ])
      .then(async ([fsBundleResponse, wasmResponse]) => ({
        fsBundle: await fsBundleResponse.blob(),
        wasmModule: await compileWasmModule(wasmResponse),
      }))
      .catch((error: unknown) => {
        runtimeAssetsPromise = null;
        throw error;
      });
  }

  return runtimeAssetsPromise;
}

export async function bootstrapReasoningTreeDatabase(db: PGlite): Promise<PGlite> {
  await db.waitReady;
  await db.exec(REASONING_TREE_SCHEMA_SQL);
  return db;
}

export async function createReasoningTreeDatabase(
  dataDir = DEFAULT_REASONING_TREE_DATA_DIR,
): Promise<PGlite> {
  const db = runsInBrowserRuntime()
    ? new PGlite(dataDir, await loadRuntimeAssets())
    : new PGlite(dataDir);

  return bootstrapReasoningTreeDatabase(db);
}

export function getDefaultReasoningTreeDatabase(): Promise<PGlite> {
  if (runsInBrowserRuntime()) {
    if (defaultDatabasePromise === null) {
      defaultDatabasePromise = createReasoningTreeDatabase().catch((error) => {
        defaultDatabasePromise = null;
        throw error;
      });
    }

    return defaultDatabasePromise;
  }

  if (defaultDatabaseCloseTimer !== null) {
    clearTimeout(defaultDatabaseCloseTimer);
    defaultDatabaseCloseTimer = null;
  }

  defaultDatabaseLeaseCount += 1;

  if (defaultDatabasePromise === null) {
    defaultDatabasePromise = createReasoningTreeDatabase().catch((error) => {
      defaultDatabasePromise = null;
      throw error;
    });
  }

  return defaultDatabasePromise;
}

export async function closeDefaultReasoningTreeDatabase(): Promise<void> {
  if (runsInBrowserRuntime()) {
    return;
  }

  if (defaultDatabaseLeaseCount > 0) {
    defaultDatabaseLeaseCount -= 1;
  }

  if (defaultDatabaseLeaseCount > 0 || defaultDatabasePromise === null) {
    return;
  }

  const closeDefaultDatabaseNow = async () => {
    const dbPromise = defaultDatabasePromise;
    defaultDatabasePromise = null;

    if (dbPromise === null) {
      return;
    }

    const db = await dbPromise;

    if (db.closed) {
      return;
    }

    await db.close();
  };

  if (runsInBrowserRuntime()) {
    if (defaultDatabaseCloseTimer !== null) {
      return;
    }

    defaultDatabaseCloseTimer = setTimeout(() => {
      defaultDatabaseCloseTimer = null;

      if (defaultDatabaseLeaseCount > 0 || defaultDatabasePromise === null) {
        return;
      }

      void closeDefaultDatabaseNow().catch(() => undefined);
    }, 0);

    return;
  }

  await closeDefaultDatabaseNow();
}
