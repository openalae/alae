import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  ReasoningTreeExplorer,
  type ReasoningTreeBranchSummary,
  type ReasoningTreeConversationSummary,
  type ReasoningTreeNodeSummary,
} from "@/features/reasoning-tree";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";
import { ProviderAccessCard } from "@/features/settings";
import { TruthPanel } from "@/features/truth-panel";
import { ProgressiveWorkspace, useWorkspaceController } from "@/features/workspace";
import type { LoadedConversation } from "@/schema";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unable to refresh provider access state.";
}

function sortBranches(branches: LoadedConversation["branches"]) {
  return [...branches].sort((left, right) => {
    if (left.name === "main" && right.name !== "main") {
      return -1;
    }

    if (right.name === "main" && left.name !== "main") {
      return 1;
    }

    const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);

    if (updatedAtOrder !== 0) {
      return updatedAtOrder;
    }

    return right.id.localeCompare(left.id);
  });
}

function sortNodes(nodes: LoadedConversation["nodes"]) {
  return [...nodes].sort((left, right) => {
    const createdAtOrder = left.createdAt.localeCompare(right.createdAt);

    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

function buildBranchSummaries(
  loadedConversation: LoadedConversation | null,
  selectedBranchId: string | null,
): ReasoningTreeBranchSummary[] {
  if (!loadedConversation) {
    return [];
  }

  return sortBranches(loadedConversation.branches).map((branch) => ({
    id: branch.id,
    name: branch.name,
    updatedAt: branch.updatedAt,
    isMain: branch.name === "main",
    isActive: branch.id === selectedBranchId,
    nodeCount: loadedConversation.nodes.filter((node) => node.branchId === branch.id).length,
    headNodeId: branch.headNodeId,
    sourceNodeId: branch.sourceNodeId,
    rootNodeId: branch.rootNodeId,
  }));
}

function buildNodeSummaries(
  loadedConversation: LoadedConversation | null,
  selectedBranchId: string | null,
  selectedNodeId: string | null,
): ReasoningTreeNodeSummary[] {
  if (!loadedConversation || !selectedBranchId) {
    return [];
  }

  const forkSourceNodeIds = new Set(
    loadedConversation.branches
      .map((branch) => branch.sourceNodeId)
      .filter((nodeId): nodeId is string => nodeId !== null),
  );
  const branch = loadedConversation.branches.find((item) => item.id === selectedBranchId) ?? null;

  return sortNodes(
    loadedConversation.nodes.filter((node) => node.branchId === selectedBranchId),
  ).map((node) => ({
    id: node.id,
    title: node.title,
    prompt: node.prompt,
    status: node.status,
    createdAt: node.createdAt,
    isHead: branch?.headNodeId === node.id,
    isSelected: node.id === selectedNodeId,
    isForkSource: forkSourceNodeIds.has(node.id),
    hasSynthesisReport: node.synthesisReport !== null,
  }));
}

export function AppShell() {
  const controller = useWorkspaceController();
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(true);
  const [providerPanelError, setProviderPanelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    refreshApiKeyStatuses()
      .catch((error) => {
        if (active) {
          setProviderPanelError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setIsRefreshingProviders(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const explorerConversations: ReasoningTreeConversationSummary[] = controller.conversationSummaries;
  const explorerBranches = buildBranchSummaries(
    controller.loadedConversation,
    controller.selectedBranchId,
  );
  const explorerNodes = buildNodeSummaries(
    controller.loadedConversation,
    controller.selectedBranchId,
    controller.selectedNodeId,
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-6 py-8 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Module 10
          </div>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-balance lg:text-6xl">
              Alae now exposes the reasoning tree as a real AI Git Explorer.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
              Module 10 turns the local conversation graph into a browsable, forkable workflow:
              switch sessions, inspect branch history, recover historical snapshots, and continue
              from any node without losing the original path.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current module
            </div>
            <div className="mt-2 text-lg font-semibold">10. AI Git Explorer</div>
          </div>
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Diagnostic focus
            </div>
            <div className="mt-2 text-lg font-semibold">History navigation, branch recovery, and fork-first continuation</div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-6 py-8 xl:grid-cols-[300px_minmax(0,1.8fr)_320px]">
        <ReasoningTreeExplorer
          conversations={explorerConversations}
          activeConversationId={controller.selectedConversation?.id ?? null}
          branches={explorerBranches}
          nodes={explorerNodes}
          onSelectConversation={(id) => void controller.selectConversation(id)}
          onSelectBranch={(id) => void controller.selectBranch(id)}
          onSelectNode={(id) => void controller.selectNode(id)}
          onForkSelectedNode={() => void controller.forkSelectedNode()}
          isForkDisabled={controller.isBusy || controller.selectedNode === null}
        />

        <ProgressiveWorkspace controller={controller} />

        <div className="space-y-5">
          <ProviderAccessCard
            isRefreshing={isRefreshingProviders}
            panelError={providerPanelError}
          />
          <TruthPanel />
        </div>
      </main>
    </div>
  );
}
