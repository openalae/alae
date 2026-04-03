import { useEffect } from "react";
import {
  Search,
  PanelLeft,
  PanelRight,
  Database,
  Radio,
  Cpu,
  MemoryStick,
  Settings,
  Puzzle,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";

import {
  ReasoningTreeExplorer,
  type ReasoningTreeConversationSummary,
} from "@/features/reasoning-tree";
import { SettingsModal } from "@/features/settings";
import { TruthPanel } from "@/features/truth-panel";
import { ProgressiveWorkspace, useWorkspaceController, GlobalInputShell } from "@/features/workspace";



/* ─────────────────────────────────────────
 *  Top Navigation Bar (Simplified)
 * ───────────────────────────────────────── */
function TopNavBar() {
  const { t } = useTranslation();
  const { toggleLeftPanel, toggleRightPanel, isLeftPanelOpen, isRightPanelOpen, openSettingsModal } = useSettingsStore();

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
        <div className="font-headline text-lg font-bold tracking-tighter text-primary select-none mr-2">
          {t("ALAE")}
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          <a
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
            href="#"
          >
            <span className="flex items-center gap-1.5">
              <Puzzle className="h-3.5 w-3.5" />
              {t("Plugins")}
            </span>
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

/* ─────────────────────────────────────────
 *  Bottom Status Bar
 * ───────────────────────────────────────── */
function BottomStatusBar() {
  const { t } = useTranslation();
  const { developerMode } = useSettingsStore();

  if (!developerMode) return null;

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
  const { isRightPanelOpen, isLeftPanelOpen, setLeftPanelOpen, setRightPanelOpen } = useSettingsStore();

  // Responsive logic
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    // Trigger once on mount
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [setLeftPanelOpen, setRightPanelOpen]);

  const controller = useWorkspaceController();

  const explorerConversations: ReasoningTreeConversationSummary[] = controller.conversationSummaries;


  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top Navigation Bar */}
      <TopNavBar />

      {/* Settings Modal */}
      <SettingsModal />

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-r border-border/30 bg-surface-container-lowest text-sm transition-[width] duration-300 ease-in-out ${
            isLeftPanelOpen ? "w-60" : "w-0"
          }`}
        >
          {isLeftPanelOpen && (
            <div className="flex h-full w-60 flex-col overflow-hidden">
              {/* Search Sidebar Header (Replaces Static Explorer Header) */}
              <div className="flex flex-col gap-2 px-3 py-3 border-b border-border/20">
                <Button 
                  onClick={controller.startNewConversation}
                  className="w-full justify-start gap-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/10 h-9"
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold uppercase tracking-widest">{t("New Chat")}</span>
                </Button>
                <div className="relative group">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <input 
                    type="text" 
                    placeholder={t("Search conversations...")}
                    className="w-full bg-accent/10 hover:bg-accent/20 focus:bg-background border border-transparent focus:border-primary/20 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Explorer Content */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <ReasoningTreeExplorer
                  conversations={explorerConversations}
                  activeConversationId={controller.selectedConversation?.id ?? null}
                  onSelectConversation={(id: string) => void controller.selectConversation(id)}
                />
              </div>
            </div>
          )}
        </aside>

        {/* Center Workspace */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
          <div className="mx-auto flex h-full w-full flex-col">
            <ProgressiveWorkspace controller={controller} />
          </div>
          {/* Global Input Shell floating over the workspace */}
          <GlobalInputShell controller={controller} />
        </main>

        {/* Right Inspector Panel */}
        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-l border-border/30 bg-surface-container-low transition-[width] duration-300 ease-in-out ${
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

              {/* Panel Content — only TruthPanel, ProviderAccessCard moved to Settings */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
