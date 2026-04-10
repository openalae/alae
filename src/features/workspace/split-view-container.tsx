import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import type { ConflictPoint, ConversationNode, ModelRun, SynthesisReport } from "@/schema";

type ReportTab = "summary" | "conflicts" | "directory";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function getReportStageLabel(report: SynthesisReport, t: (key: string) => string) {
  if (report.reportStage === "awaiting_synthesis") return t("Awaiting synthesis");
  if (report.reportStage === "failed") return t("Failed");
  if (report.reportStage === "synthesized") return t("Synthesized");
  if (report.resolution) return t("Resolved");
  if (report.status === "ready") return t("Ready");
  return t("Candidate complete");
}

function getReportStageBadgeClasses(report: SynthesisReport) {
  if (report.reportStage === "awaiting_synthesis") return "badge-warning";
  if (report.reportStage === "failed") return "badge-error";
  if (report.resolution || report.status === "ready") return "badge-success";
  return "badge-neutral";
}

function formatRunStatus(status: ModelRun["status"], t: (key: string) => string) {
  if (status === "completed") return t("Completed");
  if (status === "running") return t("Running");
  if (status === "pending") return t("Pending");
  return t("Failed");
}

function getRunStatusClasses(status: ModelRun["status"]) {
  if (status === "completed") return "badge-success";
  if (status === "running") return "badge-info";
  if (status === "pending") return "badge-neutral";
  return "badge-error";
}

function getRunConversationText(run: ModelRun, t: (key: string, options?: Record<string, unknown>) => string) {
  if (run.parsed?.outputType === "candidate") {
    return t(run.parsed.summary, { topic: "" });
  }

  if (run.parsed?.outputType === "synthesis") {
    return [t(run.parsed.chosenApproach), t(run.parsed.summary)].filter(Boolean).join("\n\n");
  }

  return run.rawText ?? t("No content available.");
}

function buildMergedAnswerText(report: SynthesisReport, t: (key: string, options?: Record<string, unknown>) => string) {
  if (report.resolution) {
    return [t(report.resolution.chosenApproach), t(report.resolution.summary)]
      .filter(Boolean)
      .join("\n\n");
  }

  return t(report.summary, { topic: report.prompt });
}

function buildQuestionOutlineTitle(prompt: string) {
  const firstNonEmptyLine =
    prompt
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? prompt.trim();

  if (firstNonEmptyLine.length <= 72) {
    return firstNonEmptyLine;
  }

  return `${firstNonEmptyLine.slice(0, 69).trimEnd()}...`;
}

function ConversationPanel(props: {
  prompt: string;
  title: string;
  subtitle: string;
  status: ModelRun["status"];
  responseText: string;
  rawText: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  totalTokens: number | null;
  tone?: "candidate" | "merged";
}) {
  const { t } = useTranslation();
  const { developerMode } = useSettingsStore();
  const [showRaw, setShowRaw] = useState(false);
  const effectiveShowRaw = developerMode && showRaw;
  const answerTone =
    props.tone === "merged"
      ? "border-primary/25 bg-primary/5"
      : "border-border/50 bg-background/90";

  return (
    <article className="flex min-h-[420px] flex-col overflow-hidden rounded-[1.25rem] border border-border/40 bg-card/80 shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-border/30 bg-surface-container-low px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {props.tone === "merged" ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                  {props.title}
                </div>
                <span
                  className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getRunStatusClasses(props.status)}`}
                >
                  {formatRunStatus(props.status, t)}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {props.subtitle}
              </div>
            </div>
          </div>
        </div>

        {developerMode ? (
          <button
            type="button"
            onClick={() => setShowRaw((current) => !current)}
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
              effectiveShowRaw
                ? "border-primary/50 bg-primary text-primary-foreground"
                : "border-border/40 bg-background/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {effectiveShowRaw ? t("Parsed") : t("JSON")}
          </button>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {props.errorMessage ? (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {props.errorMessage}
          </div>
        ) : null}

        {effectiveShowRaw ? (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-muted-foreground">
            {props.rawText ?? t("No raw output recorded.")}
          </pre>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                {t("Question")}
              </div>
              <div className="rounded-[1.15rem] border border-border/50 bg-accent/30 px-4 py-3">
                <div className="text-sm leading-6 text-foreground">{props.prompt}</div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">
                {props.tone === "merged" ? <Sparkles className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                <span>{props.tone === "merged" ? t("Merged answer") : t("Model reply")}</span>
              </div>
              <div className={`rounded-[1.3rem] border px-5 py-5 shadow-sm ${answerTone}`}>
                {props.status === "running" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    {t("Model is thinking...")}
                  </div>
                ) : props.status === "failed" && !props.errorMessage ? (
                  <div className="text-sm text-destructive">
                    {t("An unknown error occurred during execution.")}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
                    {props.responseText}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border/30 bg-surface-container-low px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        <span>{props.latencyMs ?? 0} ms</span>
        <span>{props.totalTokens ?? 0} {t("TOKENS")}</span>
      </footer>
    </article>
  );
}

function ConflictList(props: { conflicts: ConflictPoint[] }) {
  const { t } = useTranslation();

  if (props.conflicts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
        {t("No cross-model conflicts were detected for this run.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.conflicts.map((conflict) => (
        <section
          key={conflict.id}
          className="breathing-critical rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{t(conflict.title)}</h4>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {t(conflict.severity)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(conflict.summary)}</p>
          <p className="mt-3 text-sm font-medium text-foreground">{t(conflict.question)}</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {conflict.positions.map((position) => (
              <div
                key={`${conflict.id}-${position.modelRunId}`}
                className="rounded-xl border border-border/50 bg-background/80 px-3 py-3"
              >
                <div className="text-xs font-semibold text-foreground">{t(position.label)}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(position.stance)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function OutlineLink(props: {
  indexLabel: string;
  title: string;
  description?: string;
  active?: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
        props.active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      } ${props.indent ? "ml-5 w-[calc(100%-1.25rem)]" : ""}`}
    >
      <span className="mt-0.5 min-w-7 font-mono text-[10px] uppercase tracking-[0.24em]">
        {props.indexLabel}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{props.title}</span>
        {props.description ? (
          <span className="block text-xs leading-5 text-muted-foreground">
            {props.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function MergedAnswerPanel(props: { report: SynthesisReport }) {
  const { t } = useTranslation();

  return (
    <ConversationPanel
      prompt={props.report.prompt}
      title={t("Merged answer")}
      subtitle={props.report.resolution ? t("Unified response") : t("Final answer")}
      status="completed"
      responseText={buildMergedAnswerText(props.report, t)}
      rawText={null}
      errorMessage={null}
      latencyMs={null}
      totalTokens={null}
      tone="merged"
    />
  );
}

function DirectoryPanel(props: {
  outlineNodes: ConversationNode[];
  activeNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-border/50 bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <Waypoints className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{t("Directory")}</h4>
      </div>

      <div className="mt-4 space-y-1">
        {props.outlineNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
            {t("No items yet.")}
          </div>
        ) : null}

        {props.outlineNodes.map((node, index) => (
          <OutlineLink
            key={node.id}
            indexLabel={String(index + 1).padStart(2, "0")}
            title={buildQuestionOutlineTitle(node.prompt)}
            active={props.activeNodeId === node.id}
            onClick={() => props.onSelectNode(node.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ReportTopBar(props: {
  report: SynthesisReport;
  candidateRuns: ModelRun[];
  outlineNodes: ConversationNode[];
  activeOutlineNodeId: string | null;
  onSelectOutlineNode: (nodeId: string) => void;
  activeTab: ReportTab;
  onChangeTab: (tab: ReportTab) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onResolve: () => void;
  isBusy: boolean;
  hasMergedView: boolean;
  showSourcePanels: boolean;
  onToggleSourcePanels: () => void;
  quickHints: string[];
}) {
  const { t } = useTranslation();

  const tabs: Array<{ id: ReportTab; label: string; count?: number }> = [
    { id: "summary", label: t("Summary") },
    { id: "conflicts", label: t("Conflicts"), count: props.report.conflicts.length },
    { id: "directory", label: t("Directory") },
  ];

  return (
    <section className="rounded-[1.4rem] border border-border/40 bg-card/80 shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Synthesis Report")}
              </div>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${getReportStageBadgeClasses(props.report)}`}
              >
                {getReportStageLabel(props.report, t)}
              </span>
              <span className="inline-flex rounded-full border border-border/50 bg-background/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {props.candidateRuns.length} {t("Candidate windows")}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {t(props.report.summary, { topic: props.report.prompt })}
              </h3>
              <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                {props.report.resolution
                  ? t(props.report.resolution.chosenApproach)
                  : t(props.report.summary, { topic: props.report.prompt })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {props.hasMergedView ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onToggleSourcePanels}
              >
                {props.showSourcePanels ? t("Focus merged answer") : t("Compare source models")}
              </Button>
            ) : null}

            {props.report.reportStage === "awaiting_synthesis" ? (
              <Button
                type="button"
                size="sm"
                disabled={props.isBusy}
                onClick={props.onResolve}
                className="gap-2"
              >
                {props.isBusy ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t("Run Synthesis")}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={props.onToggleExpanded}
              className="gap-2"
            >
              {props.isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {props.isExpanded ? t("Collapse report") : t("Expand report")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onChangeTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                props.activeTab === tab.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-background/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{t("Quick keys")}</span>
          {props.quickHints.map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-border/40 bg-background/70 px-2.5 py-1"
            >
              {hint}
            </span>
          ))}
        </div>
      </div>

      {props.isExpanded ? (
        <div className="border-t border-border/30 px-5 py-4">
          {props.activeTab === "summary" ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
              <section className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">{t("Consensus")}</h4>
                </div>
                <div className="mt-3 space-y-2">
                  {props.report.consensus?.items.length ? (
                    props.report.consensus.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/50 bg-card/80 px-4 py-3"
                      >
                        <div className="font-medium text-foreground">{t(item.statement)}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {t(item.kind)} · {t(item.confidence)} {t("confidence")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/50 bg-card/60 px-4 py-4 text-sm text-muted-foreground">
                      {t("No consensus items were extracted for this run.")}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h4 className="text-sm font-semibold">{t("Conflicts")}</h4>
                </div>
                <div className="mt-3">
                  <ConflictList conflicts={props.report.conflicts} />
                </div>
              </section>
            </div>
          ) : null}

          {props.activeTab === "conflicts" ? <ConflictList conflicts={props.report.conflicts} /> : null}

          {props.activeTab === "directory" ? (
            <DirectoryPanel
              outlineNodes={props.outlineNodes}
              activeNodeId={props.activeOutlineNodeId}
              onSelectNode={props.onSelectOutlineNode}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SynthesisReportSplitView(props: {
  report: SynthesisReport;
  onResolve: () => void;
  isBusy: boolean;
  conversationOutlineNodes?: ConversationNode[];
  activeOutlineNodeId?: string | null;
  onSelectOutlineNode?: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const candidateRuns = useMemo(
    () => props.report.modelRuns.filter((run) => run.role !== "judge" && run.role !== "synthesis"),
    [props.report.modelRuns],
  );
  const hasMergedView = candidateRuns.length > 1 && props.report.resolution !== null;
  const [activeTab, setActiveTab] = useState<ReportTab>(
    props.report.conflicts.length > 0 ? "conflicts" : "summary",
  );
  const [isExpanded, setIsExpanded] = useState(
    props.report.reportStage === "awaiting_synthesis" || props.report.reportStage === "failed",
  );
  const [showSourcePanels, setShowSourcePanels] = useState(!hasMergedView);
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    setActiveTab(props.report.conflicts.length > 0 ? "conflicts" : "summary");
    setIsExpanded(props.report.reportStage === "awaiting_synthesis" || props.report.reportStage === "failed");
    setShowSourcePanels(!hasMergedView);
    setActivePanelIndex(0);
  }, [props.report.id, props.report.reportStage, props.report.conflicts.length, hasMergedView]);

  const focusPanel = (index: number) => {
    const panel = panelRefs.current[index];

    if (!panel) {
      return;
    }

    setActivePanelIndex(index);
    panel.focus();
    panel.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  const openTab = (tab: ReportTab) => {
    setActiveTab(tab);
    setIsExpanded(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;

      if (hasModifier && event.shiftKey) {
        const key = event.key.toLowerCase();

        if (key === "s") {
          event.preventDefault();
          openTab("summary");
          return;
        }

        if (key === "o") {
          event.preventDefault();
          openTab("directory");
          return;
        }

        if (key === "r") {
          event.preventDefault();
          if (props.report.reportStage === "awaiting_synthesis" && !props.isBusy) {
            props.onResolve();
            return;
          }

          openTab("conflicts");
        }
      }

      if (hasModifier && !event.shiftKey && /^[1-3]$/u.test(event.key)) {
        const panelIndex = Number(event.key) - 1;

        if (panelIndex < panelRefs.current.length) {
          event.preventDefault();
          focusPanel(panelIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    props.onResolve,
    props.isBusy,
    props.report.reportStage,
    candidateRuns.length,
    hasMergedView,
    showSourcePanels,
  ]);

  const renderedPanels =
    hasMergedView && !showSourcePanels
      ? [
          {
            id: `${props.report.id}-merged`,
            content: <MergedAnswerPanel report={props.report} />,
            label: t("Merged answer"),
          },
        ]
      : candidateRuns.map((run, index) => ({
          id: run.id,
          content: (
            <ConversationPanel
              prompt={props.report.prompt}
              title={t(run.role)}
              subtitle={`${run.provider} / ${run.model}`}
              status={run.status}
              responseText={getRunConversationText(run, t)}
              rawText={run.rawText}
              errorMessage={run.error?.message ?? null}
              latencyMs={run.latencyMs}
              totalTokens={run.usage.totalTokens}
            />
          ),
          label: `${t("Pane")} ${index + 1}: ${t(run.role)} ${run.provider}/${run.model}`,
        }));

  const gridClassName =
    renderedPanels.length >= 3
      ? "xl:grid-cols-3"
      : renderedPanels.length === 2
        ? "lg:grid-cols-2"
        : "grid-cols-1";

  const quickHints = [
    `${t("Summary")} · Cmd/Ctrl+Shift+S`,
    `${props.report.reportStage === "awaiting_synthesis" ? t("Run Synthesis") : t("Conflicts")} · Cmd/Ctrl+Shift+R`,
    `${t("Directory")} · Cmd/Ctrl+Shift+O`,
    `Pane · Cmd/Ctrl+1-3`,
  ];

  const handleSelectOutlineNode = (nodeId: string) => {
    props.onSelectOutlineNode?.(nodeId);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-4 px-4 md:px-8">
      <ReportTopBar
        report={props.report}
        candidateRuns={candidateRuns}
        outlineNodes={props.conversationOutlineNodes ?? []}
        activeOutlineNodeId={props.activeOutlineNodeId ?? null}
        onSelectOutlineNode={handleSelectOutlineNode}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((current) => !current)}
        onResolve={props.onResolve}
        isBusy={props.isBusy}
        hasMergedView={hasMergedView}
        showSourcePanels={showSourcePanels}
        onToggleSourcePanels={() => setShowSourcePanels((current) => !current)}
        quickHints={quickHints}
      />

      <div className={`grid gap-4 ${gridClassName}`}>
        {renderedPanels.map((panel, index) => (
          <div
            key={panel.id}
            ref={(node) => {
              panelRefs.current[index] = node;
            }}
            tabIndex={-1}
            onClick={() => focusPanel(index)}
            onFocus={() => setActivePanelIndex(index)}
            aria-label={panel.label}
            className={`rounded-[1.35rem] transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              activePanelIndex === index ? "ring-2 ring-primary/30 ring-offset-0" : ""
            }`}
          >
            {panel.content}
          </div>
        ))}
      </div>
    </div>
  );
}
