// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createReasoningTreeRepository,
} from "@/features/reasoning-tree";
import type { SynthesisReport } from "@/schema";

const startedAt = "2026-03-17T11:00:00Z";
const completedAt = "2026-03-17T11:01:00Z";
const createdAt = "2026-03-17T11:02:00Z";

const reportFixture: SynthesisReport = {
  id: "report-node-1",
  prompt: "Evaluate whether the repository layer should use PGlite.",
  summary: "PGlite should own the local reasoning tree persistence boundary.",
  status: "ready",
  consensus: {
    summary: "A single local Postgres-like store keeps the conversation tree queryable.",
    items: [
      {
        id: "consensus-repo-1",
        kind: "approach",
        statement: "Persist conversation branches and nodes in PGlite.",
        confidence: "high",
        supportingRunIds: ["run-judge-1"],
      },
    ],
  },
  conflicts: [],
  resolution: {
    summary: "Use a repository API backed by PGlite.",
    rationale: "This keeps tree mutations testable and local-first.",
    chosenApproach: "Introduce a dedicated reasoning-tree repository.",
    resolvedConflictIds: [],
    judgeModelRunId: "run-judge-1",
    openRisks: [],
  },
  nextActions: ["Wire the repo into state and UI in later modules."],
  modelRuns: [
    {
      id: "run-judge-1",
      provider: "openai",
      model: "gpt-5.4",
      role: "judge",
      status: "completed",
      startedAt,
      completedAt,
      latencyMs: 980,
      usage: {
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
      },
      rawText: "Repository-backed reasoning tree accepted.",
      parsed: {
        outputType: "judge",
        summary: "Use a local repo abstraction.",
        chosenApproach: "PGlite repository.",
        rationale: "It keeps the desktop app local-first.",
        resolvedConflictIds: [],
        openRisks: [],
      },
      validation: {
        status: "passed",
        issues: [],
      },
      error: null,
    },
  ],
  createdAt,
};

const cleanupTasks: Array<() => Promise<void>> = [];

async function createRepository() {
  const dataDir = await mkdtemp(join(tmpdir(), "alae-reasoning-tree-"));
  const repository = createReasoningTreeRepository({ dataDir });

  cleanupTasks.push(async () => {
    await repository.close().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true });
  });

  return { dataDir, repository };
}

afterEach(async () => {
  while (cleanupTasks.length > 0) {
    const cleanup = cleanupTasks.pop();

    if (cleanup) {
      await cleanup();
    }
  }
});

describe("reasoning tree repository", () => {
  it("creates a conversation with an empty main branch", async () => {
    const { repository } = await createRepository();

    const loadedConversation = await repository.createConversation({
      id: "conversation-create-1",
      title: "Persistence bootstrap",
      createdAt,
    });

    expect(loadedConversation.conversation.id).toBe("conversation-create-1");
    expect(loadedConversation.conversation.title).toBe("Persistence bootstrap");
    expect(loadedConversation.branches).toHaveLength(1);
    expect(loadedConversation.branches[0].name).toBe("main");
    expect(loadedConversation.branches[0].rootNodeId).toBeNull();
    expect(loadedConversation.branches[0].headNodeId).toBeNull();
    expect(loadedConversation.nodes).toEqual([]);
    expect(loadedConversation.modelRuns).toEqual([]);
  });

  it("appends nodes, advances branch heads, and mirrors model runs", async () => {
    const { repository } = await createRepository();
    const loadedConversation = await repository.createConversation({
      id: "conversation-append-1",
      createdAt,
    });
    const mainBranch = loadedConversation.branches[0];

    const rootNode = await repository.appendNode({
      conversationId: loadedConversation.conversation.id,
      branchId: mainBranch.id,
      id: "node-root-append-1",
      title: "Kick off persistence layer",
      prompt: "Create the initial node.",
      createdAt,
    });

    const childNode = await repository.appendNode({
      conversationId: loadedConversation.conversation.id,
      branchId: mainBranch.id,
      id: "node-child-append-1",
      title: "Persist the model report",
      prompt: "Attach the synthesis report to the second node.",
      synthesisReport: reportFixture,
      createdAt: completedAt,
    });

    const reloadedConversation = await repository.loadConversation(
      loadedConversation.conversation.id,
    );

    expect(rootNode.parentNodeId).toBeNull();
    expect(rootNode.status).toBe("idle");
    expect(childNode.parentNodeId).toBe(rootNode.id);
    expect(childNode.status).toBe("completed");
    expect(reloadedConversation?.branches[0].rootNodeId).toBe(rootNode.id);
    expect(reloadedConversation?.branches[0].headNodeId).toBe(childNode.id);
    expect(reloadedConversation?.modelRuns).toHaveLength(1);
    expect(reloadedConversation?.modelRuns[0].id).toBe("run-judge-1");
  });

  it("forks from an existing node without copying prior nodes", async () => {
    const { repository } = await createRepository();
    const loadedConversation = await repository.createConversation({
      id: "conversation-fork-1",
      createdAt,
    });
    const mainBranch = loadedConversation.branches[0];
    const rootNode = await repository.appendNode({
      conversationId: loadedConversation.conversation.id,
      branchId: mainBranch.id,
      id: "node-root-fork-1",
      title: "Root node",
      prompt: "Start the branch.",
      createdAt,
    });

    const forkBranch = await repository.forkNode({
      conversationId: loadedConversation.conversation.id,
      sourceNodeId: rootNode.id,
      id: "branch-fork-1",
      name: "alternate-plan",
      createdAt: completedAt,
    });

    const forkNode = await repository.appendNode({
      conversationId: loadedConversation.conversation.id,
      branchId: forkBranch.id,
      id: "node-fork-child-1",
      title: "Fork follow-up",
      prompt: "Continue from the fork.",
      createdAt: "2026-03-17T11:03:00Z",
    });

    const reloadedConversation = await repository.loadConversation(
      loadedConversation.conversation.id,
    );
    const persistedFork = reloadedConversation?.branches.find((branch) => branch.id === forkBranch.id);

    expect(forkBranch.sourceNodeId).toBe(rootNode.id);
    expect(forkBranch.rootNodeId).toBe(rootNode.id);
    expect(forkBranch.headNodeId).toBe(rootNode.id);
    expect(forkNode.parentNodeId).toBe(rootNode.id);
    expect(reloadedConversation?.nodes).toHaveLength(2);
    expect(persistedFork?.headNodeId).toBe(forkNode.id);
  });

  it("reloads persisted data from the same database directory", async () => {
    const { dataDir, repository } = await createRepository();
    const createdConversation = await repository.createConversation({
      id: "conversation-persist-1",
      createdAt,
    });

    await repository.appendNode({
      conversationId: createdConversation.conversation.id,
      branchId: createdConversation.branches[0].id,
      id: "node-persist-1",
      title: "Persistent node",
      prompt: "Verify on-disk persistence.",
      synthesisReport: reportFixture,
      createdAt: completedAt,
    });

    await repository.close();

    const reopenedRepository = createReasoningTreeRepository({ dataDir });
    cleanupTasks.push(async () => {
      await reopenedRepository.close().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true });
    });

    const reloadedConversation = await reopenedRepository.loadConversation(
      createdConversation.conversation.id,
    );

    expect(reloadedConversation).not.toBeNull();
    expect(reloadedConversation?.nodes).toHaveLength(1);
    expect(reloadedConversation?.modelRuns).toHaveLength(1);
    expect(reloadedConversation?.conversation.id).toBe(createdConversation.conversation.id);
  });

  it("rejects missing records, mismatched branches, and duplicate identifiers", async () => {
    const { repository } = await createRepository();
    const firstConversation = await repository.createConversation({
      id: "conversation-errors-1",
      createdAt,
    });
    const secondConversation = await repository.createConversation({
      id: "conversation-errors-2",
      createdAt: completedAt,
    });

    await expect(
      repository.appendNode({
        conversationId: "conversation-missing",
        branchId: firstConversation.branches[0].id,
        title: "Missing conversation",
        prompt: "This should fail.",
      }),
    ).rejects.toThrow("Conversation conversation-missing was not found.");

    await expect(
      repository.appendNode({
        conversationId: firstConversation.conversation.id,
        branchId: "branch-missing",
        title: "Missing branch",
        prompt: "This should fail.",
      }),
    ).rejects.toThrow("Branch branch-missing was not found.");

    await expect(
      repository.appendNode({
        conversationId: secondConversation.conversation.id,
        branchId: firstConversation.branches[0].id,
        title: "Mismatched branch",
        prompt: "This should fail.",
      }),
    ).rejects.toThrow(
      `Branch ${firstConversation.branches[0].id} does not belong to conversation ${secondConversation.conversation.id}.`,
    );

    await expect(
      repository.forkNode({
        conversationId: firstConversation.conversation.id,
        sourceNodeId: "node-missing",
        name: "missing-node",
      }),
    ).rejects.toThrow("Node node-missing was not found.");

    await expect(
      repository.createConversation({
        id: firstConversation.conversation.id,
        createdAt: "2026-03-17T11:04:00Z",
      }),
    ).rejects.toThrow(/duplicate/i);
  });
});
