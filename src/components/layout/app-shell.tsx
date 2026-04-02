import { useEffect, useState } from "react";
import {
  Search,
  Moon,
  Sun,
  Languages,
  Settings,
  PanelRight,
  Database,
  Radio,
  Cpu,
  MemoryStick,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";

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

/* ─────────────────────────────────────────
 *  Top Navigation Bar
 * ───────────────────────────────────────── */
function TopNavBar() {
  const { t } = useTranslation();
  const { theme, setTheme, locale, setLocale } = useSettingsStore();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleLocale = () => setLocale(locale === "en" ? "zh" : "en");

  return (
    <header className="z-50 flex h-12 w-full shrink-0 items-center justify-between border-b border-border/30 bg-surface px-4">
      <div className="flex items-center gap-6">
        <div className="font-headline text-lg font-bold tracking-tighter text-primary select-none">
          {t("ALAE")}
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {(["Models", "History", "Plugins"] as const).map((key, i) => (
            <a
              key={key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                i === 0
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              href="#"
            >
              {t(key)}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-container-low px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-44 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            placeholder={t("Global reasoning search...") as string}
            type="text"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLocale}
          title={t("Language") as string}
        >
          <Languages className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={t("Theme") as string}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" title={t("Settings") as string}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────
 *  Bottom Status Bar
 * ───────────────────────────────────────── */
function BottomStatusBar() {
  const { t } = useTranslation();

  return (
    <footer className="z-50 flex h-7 w-full shrink-0 items-center gap-6 border-t border-border/30 bg-surface-container-lowest px-4 font-mono text-[10px] uppercase tracking-widest">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Database className="h-3 w-3" />
        <span>{t("PGLite")}</span>
      </div>
      <div className="flex items-center gap-1.5 text-primary">
        <Radio className="h-3 w-3" />
        <span>{t("API: Active")}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Cpu className="h-3 w-3" />
        <span>CPU: 12%</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <MemoryStick className="h-3 w-3" />
        <span>MEM: 1.2GB</span>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
 *  App Shell (main layout)
 * ───────────────────────────────────────── */
export function AppShell() {
  const { t } = useTranslation();
  const { isRightPanelOpen, toggleRightPanel } = useSettingsStore();

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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top Navigation Bar */}
      <TopNavBar />

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border/30 bg-surface-container-lowest text-sm">
          {/* Explorer Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Search className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{t("Explorer")}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{t("AI Logic Gate")}</div>
            </div>
          </div>

          {/* Explorer Content */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
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
        </aside>

        {/* Center Workspace */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <ProgressiveWorkspace controller={controller} />
          </div>
        </main>

        {/* Right Panel Toggle Button (always visible) */}
        <button
          onClick={toggleRightPanel}
          className="z-10 flex w-6 shrink-0 items-center justify-center border-l border-border/30 bg-surface-container-low text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={isRightPanelOpen ? t("Hide details") as string : t("Inspector") as string}
        >
          {isRightPanelOpen ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Right Inspector Panel */}
        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-l border-border/30 bg-surface-container-low transition-all duration-300 ease-in-out ${
            isRightPanelOpen ? "w-80" : "w-0"
          }`}
        >
          {isRightPanelOpen && (
            <div className="flex h-full w-80 flex-col overflow-hidden">
              {/* Panel Tabs */}
              <div className="flex items-center gap-2 border-b border-border/20 px-4 py-2">
                <PanelRight className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  {t("Inspector")}
                </span>
              </div>

              {/* Panel Content */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <ProviderAccessCard
                  isRefreshing={isRefreshingProviders}
                  panelError={providerPanelError}
                  onRefresh={() => void refreshProviders()}
                />
                <TruthPanel />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <BottomStatusBar />
    </div>
  );
}
