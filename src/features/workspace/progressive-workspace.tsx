import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  History,
  KeyRound,
  LoaderCircle,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
} from "@/components/ui/card";

import {
  useWorkspaceController,
  type WorkspaceController,
} from "@/features/workspace/controller";
import { SynthesisReportSplitView } from "@/features/workspace/split-view-container";
import { useSettingsStore } from "@/store/settings";
import type { ConversationNode, ModelRun } from "@/schema";

const examplePrompts = [
  {
    label: "State library tradeoffs",
    prompt:
      "Compare Zustand vs Redux Toolkit for a Tauri + React desktop app. Focus on complexity, debugging, persistence, and long-term maintainability.",
  },
  {
    label: "Debug a startup issue",
    prompt:
      "Investigate a Tauri startup error where the app restores local history incorrectly and sometimes shows a runtime failure on launch.",
  },
  {
    label: "Review an API design",
    prompt:
      "Review the risks in a local conversation-history API for branching, recovery, and persistence. Call out edge cases and safer defaults.",
  },
] as const;

function formatModeLabel(mode: "mock" | "real", t: (key: string) => string) {
  return mode === "real" ? t("Live") : t("Demo");
}

function formatNodeStatus(status: ConversationNode["status"], t: (key: string) => string) {
  if (status === "completed") return t("Completed");
  if (status === "running") return t("Running");
  if (status === "failed") return t("Failed");
  return t("Idle");
}

function getRunStatusClasses(status: ModelRun["status"] | ConversationNode["status"]) {
  if (status === "completed") return "badge-success";
  if (status === "running") return "badge-info";
  if (status === "pending" || status === "idle") return "badge-neutral";
  return "badge-error";
}

function getModeBadgeClasses(mode: "mock" | "real") {
  return mode === "real" ? "badge-success" : "badge-warning";
}



function buildModeNotice(mode: "mock" | "real", t: (key: string) => string) {
  if (mode === "real") {
    return {
      title: t("Live model mode is ready."),
      description: t("live_mode_description"),
      classes: "badge-success",
    };
  }
  return {
    title: t("Demo mode is on."),
    description: t("demo_mode_description"),
    classes: "badge-warning",
  };
}

function buildNodeAnswerText(node: ConversationNode, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!node.synthesisReport) {
    if (node.status === "failed") {
      return t("An unknown error occurred during execution.");
    }

    return t("No content available.");
  }

  if (node.synthesisReport.resolution) {
    return [
      t(node.synthesisReport.resolution.chosenApproach),
      t(node.synthesisReport.resolution.summary),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return t(node.synthesisReport.summary, { topic: node.synthesisReport.prompt });
}


/* ─────  Sub Components  ───── */



function EmptyWorkspaceState(props: { mode: "mock" | "real"; onOpenSettings: () => void }) {
  const { t } = useTranslation();
  const notice = buildModeNotice(props.mode, t);

  return (
    <div className="space-y-5">
      {/* Hero area */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          {t("Start here")}
        </div>
        <h3 className="text-xl font-semibold tracking-tight text-balance">
          {t("Ask a question and get a combined answer.")}
        </h3>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("Start with one question. Alae compares several model responses, highlights agreements and disagreements, and keeps each step in a saved local history.")}
        </p>
      </div>

      {/* Mode indicator with API key guidance */}
      <div className={`rounded-lg border px-4 py-3 ${notice.classes}`}>
        <div className="text-sm font-semibold">{notice.title}</div>
        <p className="mt-1 text-xs leading-5">{notice.description}</p>
        {props.mode === "mock" && (
          <button
            onClick={props.onOpenSettings}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <KeyRound className="h-3 w-3" />
            {t("Configure API keys")}
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { key: "01. Ask", descKey: "Ask step description" },
          { key: "02. Compare", descKey: "Compare step description" },
          { key: "03. Inspect", descKey: "Inspect step description" },
        ].map((step) => (
          <div key={step.key} className="rounded-lg border border-border/50 bg-card/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t(step.key)}
            </div>
            <p className="mt-2 text-xs leading-5">{t(step.descKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingWorkspaceState() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-background/65 p-5">
      <div className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
        {t("Restoring your history")}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-balance">
        {t("Loading your latest saved analysis.")}
      </h3>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        {t("Alae is reopening your last saved step before enabling new questions.")}
      </p>
    </div>
  );
}

function VersionSwitcher(props: {
  siblings: WorkspaceController["siblingBranches"];
  selectedBranchId: string | null;
  onSelectBranch: WorkspaceController["selectBranch"];
}) {
  const { t } = useTranslation();
  if (props.siblings.length <= 1) return null;
  const currentIndex = props.siblings.findIndex(b => b.id === props.selectedBranchId);
  if (currentIndex === -1) return null;
  
  const handlePrev = () => {
    if (currentIndex > 0) void props.onSelectBranch(props.siblings[currentIndex - 1].id);
  };
  const handleNext = () => {
    if (currentIndex < props.siblings.length - 1) void props.onSelectBranch(props.siblings[currentIndex + 1].id);
  };

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-surface-container-lowest border border-border/40 px-2 py-1 rounded-md w-fit mb-4">
      <button disabled={currentIndex === 0} onClick={handlePrev} className="hover:text-foreground disabled:opacity-30 transition-opacity">{"<"}</button>
      <span className="font-mono">{t("Version")} {currentIndex + 1} / {props.siblings.length}</span>
      <button disabled={currentIndex === props.siblings.length - 1} onClick={handleNext} className="hover:text-foreground disabled:opacity-30 transition-opacity">{">"}</button>
    </div>
  );
}

function HistoricalNodeState(props: { mode: "mock" | "real"; node: ConversationNode }) {
  const { t } = useTranslation();
  const modeNotice = buildModeNotice(props.mode, t);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/50 bg-card/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("Saved step")}
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{props.node.title}</h3>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getModeBadgeClasses(props.mode)}`}>
              {formatModeLabel(props.mode, t)}
            </span>
            <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getRunStatusClasses(props.node.status)}`}>
              {formatNodeStatus(props.node.status, t)}
            </span>
          </div>
        </div>

        <div className={`mt-4 rounded-lg border px-4 py-3 ${modeNotice.classes}`}>
          <div className="text-sm font-semibold">{modeNotice.title}</div>
          <p className="mt-1 text-xs leading-5">{modeNotice.description}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border/50 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{t("Checkpoint details")}</h4>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-background/80 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("Status")}</div>
            <div className="mt-1 text-sm font-medium">{formatNodeStatus(props.node.status, t)}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/80 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("Created")}</div>
            <div className="mt-1 text-sm font-medium">{props.node.createdAt}</div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border/50 bg-background/80 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("Question")}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{props.node.prompt}</p>
        </div>
      </section>
    </div>
  );
}

function HistoricalConversationTurn(props: {
  node: ConversationNode;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <article
      className={`rounded-[1.25rem] border bg-card/75 shadow-sm transition-colors ${
        props.isActive ? "border-primary/40 ring-2 ring-primary/15" : "border-border/40"
      }`}
    >
      <button
        type="button"
        onClick={props.onSelect}
        className="flex w-full items-start justify-between gap-4 border-b border-border/30 px-5 py-4 text-left"
      >
        <div className="min-w-0 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            {t("Question")}
          </div>
          <div className="text-sm leading-6 text-foreground">{props.node.prompt}</div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getRunStatusClasses(props.node.status)}`}
        >
          {formatNodeStatus(props.node.status, t)}
        </span>
      </button>

      <div className="px-5 py-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t("Merged answer")}</span>
        </div>
        <div className="mt-3 rounded-[1.2rem] border border-border/50 bg-background/85 px-5 py-5">
          <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
            {buildNodeAnswerText(props.node, t)}
          </div>
        </div>
      </div>
    </article>
  );
}



/* ─────  Main Component  ───── */

type ProgressiveWorkspaceProps = {
  controller?: WorkspaceController;
};

export function ProgressiveWorkspace(props: ProgressiveWorkspaceProps) {
  const { t } = useTranslation();
  const controller = props.controller ?? useWorkspaceController();
  const { openSettingsModal } = useSettingsStore();
  const nodeSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollNodeId, setPendingScrollNodeId] = useState<string | null>(null);
  const {
    setPromptDraft,
    inputErrorMessage,
    latestSynthesisReport,
    runtimeErrorMessage,
    bootstrapErrorMessage,
    isBootstrapping,
    isBusy,
    displayMode,

    siblingBranches,
    selectedBranchId,
    selectBranch,
    selectedNode,
    outlineNodes,
    selectNode,
    conversationSummaries,
    runManualSynthesis,
  } = controller;

  // Only show example prompts when there's no conversation history and no active content
  const showExamplePrompts = conversationSummaries.length === 0 && !latestSynthesisReport && !selectedNode && !isBootstrapping;

  const handleSelectOutlineNode = (nodeId: string) => {
    const section = nodeSectionRefs.current[nodeId];
    section?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (selectedNode?.id === nodeId) {
      return;
    }

    setPendingScrollNodeId(nodeId);
    void selectNode(nodeId);
  };

  useEffect(() => {
    if (!pendingScrollNodeId) {
      return;
    }

    const section = nodeSectionRefs.current[pendingScrollNodeId];

    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScrollNodeId(null);
  }, [pendingScrollNodeId, selectedNode?.id, outlineNodes.length]);

  return (
    <Card className="flex flex-col h-full w-full border-none shadow-none bg-transparent overflow-hidden relative">
      <div className="flex-1 overflow-y-auto pb-36 pt-4">
        <div className="space-y-4 px-4 md:px-8">
          {/* Version Switcher */}
          <VersionSwitcher
            siblings={siblingBranches}
            selectedBranchId={selectedBranchId}
            onSelectBranch={selectBranch}
          />

          {/* Example Prompts — only when empty state */}
          {showExamplePrompts && (
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example) => (
                <Button
                  key={example.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setPromptDraft(example.prompt)}
                >
                  {t(example.label)}
                </Button>
              ))}
            </div>
          )}

          {/* Error notices */}
          {inputErrorMessage ? (
            <div className="rounded-lg border px-4 py-3 text-sm badge-warning">{inputErrorMessage}</div>
          ) : null}
          {bootstrapErrorMessage ? (
            <div className="rounded-lg border px-4 py-3 text-sm badge-error">{bootstrapErrorMessage}</div>
          ) : null}
          {runtimeErrorMessage ? (
            <div className="rounded-lg border px-4 py-3 text-sm badge-error">{runtimeErrorMessage}</div>
          ) : null}

        </div>

        {/* Main content area */}
        <div className="mt-0">
          {isBootstrapping ? (
            <div className="px-4 md:px-8"><LoadingWorkspaceState /></div>
          ) : outlineNodes.length > 0 ? (
            <div className="space-y-6 px-4 md:px-8">
              {outlineNodes.map((node) => (
                <div
                  key={node.id}
                  ref={(section) => {
                    nodeSectionRefs.current[node.id] = section;
                  }}
                  id={`workspace-node-${node.id}`}
                  className="scroll-mt-24"
                >
                  {node.id === selectedNode?.id && node.synthesisReport ? (
                    <SynthesisReportSplitView
                      report={node.synthesisReport}
                      onResolve={runManualSynthesis}
                      isBusy={isBusy}
                      conversationOutlineNodes={outlineNodes}
                      activeOutlineNodeId={selectedNode?.id ?? null}
                      onSelectOutlineNode={handleSelectOutlineNode}
                    />
                  ) : node.id === selectedNode?.id ? (
                    <HistoricalNodeState mode={displayMode} node={node} />
                  ) : (
                    <HistoricalConversationTurn
                      node={node}
                      isActive={node.id === selectedNode?.id}
                      onSelect={() => handleSelectOutlineNode(node.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : selectedNode ? (
            <div className="px-4 md:px-8"><HistoricalNodeState mode={displayMode} node={selectedNode} /></div>
          ) : (
            <div className="px-4 md:px-8"><EmptyWorkspaceState mode={displayMode} onOpenSettings={() => openSettingsModal("providers")} /></div>
          )}
        </div>
      </div>
    </Card>
  );
}
