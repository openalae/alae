import { useEffect } from "react";
import {
  PanelLeft,
  PanelRight,
  Plus,
  Puzzle,
  Search,
  Settings,
  GitCompare,
  Presentation,
  MessageSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { SettingsModal } from "@/features/settings";
import { ReasoningTreeExplorer, type ReasoningTreeConversationSummary } from "@/features/reasoning-tree";

import { BottomRuntimeDrawer } from "@/features/runtime/components/BottomRuntimeDrawer";
import {
  CenterPane,
  useWorkspaceController,
  type WorkspaceController,
} from "@/features/workspace";
import { BottomStatusBar } from "@/features/runtime/components/BottomStatusBar";
import { CanvasModeShell } from "@/features/canvas/components/CanvasModeShell";
import { CompareModeShell } from "@/features/compare/components/CompareModeShell";
import { RecipeEditorShell } from "@/features/recipe/components/RecipeEditorShell";
import { selectLatestSynthesisReport, useAppStore } from "@/store";
import { useSettingsStore } from "@/store/settings";
import { useState } from "react";

export type CenterViewMode = "chat" | "compare" | "canvas";

function TopNavBar(props: {
  viewMode: CenterViewMode;
  onViewChange: (mode: CenterViewMode) => void;
}) {
  const { t } = useTranslation();
  const {
    toggleLeftPanel,
    toggleRightPanel,
    isLeftPanelOpen,
    isRightPanelOpen,
    openSettingsModal,
  } = useSettingsStore();

  return (
    <header className="z-50 flex h-12 w-full shrink-0 items-center justify-between border-b border-border/30 bg-surface px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className={isLeftPanelOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground"}
          onClick={toggleLeftPanel}
          title={isLeftPanelOpen ? t("Collapse Explorer") as string : t("Expand Explorer") as string}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <div className="mr-2 select-none font-headline text-lg font-bold tracking-tighter text-primary">
          {t("ALAE")}
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          <div className="flex bg-accent/30 p-1 rounded-md border border-border/30">
            <button
              onClick={() => props.onViewChange("chat")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-sm transition-all ${props.viewMode === "chat" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t("Chat")}
            </button>
            <button
              onClick={() => props.onViewChange("compare")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-sm transition-all ${props.viewMode === "compare" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              {t("Compare")}
            </button>
            <button
              onClick={() => props.onViewChange("canvas")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-sm transition-all ${props.viewMode === "canvas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Presentation className="w-3.5 h-3.5" />
              {t("Canvas")}
            </button>
          </div>
          <a
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground hidden xl:flex items-center gap-1.5"
            href="#"
          >
            <Puzzle className="h-3.5 w-3.5" />
            {t("Plugins")}
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openSettingsModal()}
          title={t("Settings") as string}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={isRightPanelOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground"}
          onClick={toggleRightPanel}
          title={t("Inspector") as string}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}


function WorkspaceInspector(props: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const latestSynthesisReport = props.controller.latestSynthesisReport;
  const activeTitle =
    props.controller.selectedConversation?.title ??
    props.controller.selectedNode?.title ??
    t("No saved analysis selected");
  const candidateCount =
    latestSynthesisReport?.modelRuns.filter((run) => run.role !== "judge").length ??
    props.controller.selectedExecutionPlan.candidateSlots.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/20 px-4 py-2">
        <PanelRight className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest text-primary">
          {t("Inspector")}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-border/50 bg-card/70 p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("Current context")}
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{activeTitle}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t("The detailed model status and logs now live in the bottom diagnostics panel.")}
          </p>
        </section>

        <section className="space-y-2 rounded-xl border border-border/50 bg-card/70 p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("Next run status")}
          </div>
          <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("Run phase")}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {props.controller.runPhase}
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("Candidate windows")}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">{candidateCount}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("Report stage")}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {latestSynthesisReport?.reportStage ?? props.controller.runPhase}
            </div>
          </div>
        </section>

        <RecipeEditorShell />
      </div>
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { isRightPanelOpen, isLeftPanelOpen, setLeftPanelOpen, setRightPanelOpen } = useSettingsStore();
  const [centerView, setCenterView] = useState<CenterViewMode>("chat");

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [setLeftPanelOpen, setRightPanelOpen]);

  const controller = useWorkspaceController();
  const explorerConversations: ReasoningTreeConversationSummary[] = controller.conversationSummaries;
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const truthPanelSnapshot = useAppStore((state) => state.truthPanelSnapshot);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopNavBar viewMode={centerView} onViewChange={setCenterView} />
      <SettingsModal />

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-r border-border/30 bg-surface-container-lowest text-sm transition-[width] duration-300 ease-in-out ${
            isLeftPanelOpen ? "w-60" : "w-0"
          }`}
        >
          {isLeftPanelOpen ? (
            <div className="flex h-full w-60 flex-col overflow-hidden">
              <div className="border-b border-border/20 px-3 py-3">
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={controller.startNewConversation}
                    className="h-9 w-full justify-start gap-2 border-primary/10 bg-primary/5 text-primary hover:bg-primary/10"
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t("New Chat")}</span>
                  </Button>
                  <div className="group relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      placeholder={t("Search conversations...")}
                      className="w-full rounded-lg border border-transparent bg-accent/10 py-1.5 pl-8 pr-3 text-xs outline-none transition-all placeholder:text-muted-foreground/50 hover:bg-accent/20 focus:border-primary/20 focus:bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2">
                <ReasoningTreeExplorer
                  conversations={explorerConversations}
                  activeConversationId={controller.selectedConversation?.id ?? null}
                  onSelectConversation={(id: string) => void controller.selectConversation(id)}
                />
              </div>
            </div>
          ) : null}
        </aside>

        <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
          <div className="mx-auto flex h-full w-full flex-col">
            {centerView === "compare" ? (
              <CompareModeShell controller={controller} />
            ) : centerView === "canvas" ? (
              <CanvasModeShell />
            ) : (
              <CenterPane controller={controller} />
            )}
          </div>
        </main>

        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-l border-border/30 bg-surface-container-low transition-[width] duration-300 ease-in-out ${
            isRightPanelOpen ? "w-80" : "w-0"
          }`}
        >
          {isRightPanelOpen ? (
            <div className="flex h-full w-80 flex-col overflow-hidden">
              <WorkspaceInspector controller={controller} />
            </div>
          ) : null}
        </aside>
      </div>

      {latestSynthesisReport || truthPanelSnapshot || runtimeErrorMessage ? <BottomRuntimeDrawer /> : null}
      <BottomStatusBar />
    </div>
  );
}
