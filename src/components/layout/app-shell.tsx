import { useEffect, useState } from "react";
import { Search, User, Moon, Sun, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";

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
  const { t } = useTranslation();
  const { theme, setTheme, locale, setLocale } = useSettingsStore();

  const controller = useWorkspaceController();
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(true);
  const [providerPanelError, setProviderPanelError] = useState<string | null>(null);

  const refreshProviders = async () => {
    setIsRefreshingProviders(true);
    setProviderPanelError(null);
    try {
      await refreshApiKeyStatuses();
    } catch (error) {
      setProviderPanelError(getErrorMessage(error));
    } finally {
      setIsRefreshingProviders(false);
    }
  };

  useEffect(() => {
    let active = true;
    void refreshApiKeyStatuses()
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

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleLocale = () => setLocale(locale === "en" ? "zh" : "en");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top Navigation Bar */}
      <header className="z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-surface px-6">
        <div className="flex items-center gap-8">
          <div className="font-headline text-xl font-bold tracking-tighter text-primary">{t("ALAE")}</div>
          <nav className="hidden items-center gap-6 md:flex">
            <a className="border-b-2 border-primary pb-1 font-headline font-bold tracking-tight text-primary transition-colors hover:text-foreground" href="#">{t("Models")}</a>
            <a className="font-headline tracking-tight text-muted-foreground transition-colors hover:text-foreground" href="#">{t("History")}</a>
            <a className="font-headline tracking-tight text-muted-foreground transition-colors hover:text-foreground" href="#">{t("Plugins")}</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded bg-surface-container-low px-3 py-1">
            <Search className="h-4 w-4 text-primary" />
            <input 
              className="w-48 bg-transparent font-mono text-xs text-on-surface-variant outline-none focus:ring-0" 
              placeholder={t("Global reasoning search...") as string}
              type="text"
            />
          </div>
          <button onClick={toggleLocale} className="rounded-md py-1 px-2 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground" title={t("Language") as string}>
            <Languages className="h-5 w-5" />
          </button>
          <button onClick={toggleTheme} className="rounded-md py-1 px-2 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground" title={t("Theme") as string}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button className="rounded-md py-1 px-2 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground" title={t("Settings") as string}>
            <User className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar (Reasoning Tree / Explorer) */}
        <aside className="border-r border-border/40 bg-surface-container-lowest shrink-0 w-72 flex flex-col h-full overflow-hidden text-sm font-body">
          <div className="px-4 py-4 mb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
                <Search className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-primary font-bold text-xs uppercase tracking-widest">{t("Explorer")}</div>
                <div className="text-[10px] text-muted-foreground font-mono">AI Logic Gate</div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto w-full px-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2 py-2">{t("Conversations")}</div>
            <div className="w-full">
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
            </div>
          </div>
        </aside>

        {/* Center Workspace */}
        <main className="relative flex flex-1 flex-col overflow-y-auto bg-surface p-4">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <ProgressiveWorkspace controller={controller} />
          </div>
        </main>

        {/* Right Inspector */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-border/40 bg-surface-container-low">
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <ProviderAccessCard
              isRefreshing={isRefreshingProviders}
              panelError={providerPanelError}
              onRefresh={() => void refreshProviders()}
            />
            <TruthPanel />
          </div>
        </aside>

      </div>
    </div>
  );
}
