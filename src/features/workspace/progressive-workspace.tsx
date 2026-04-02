import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  ChevronDown,
  History,
  LoaderCircle,
  Sparkles,
  Waypoints,
  GitFork,
  Play
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { synthesisPresetDefinitions } from "@/features/consensus";
import {
  getProviderAccessSectionId,
  getProviderDefinition,
  providerAccessCardId,
  type SupportedProviderId,
} from "@/features/settings";
import {
  useWorkspaceController,
  type WorkspaceController,
} from "@/features/workspace/controller";
import type { ConversationNode, ModelRun, SynthesisReport } from "@/schema";

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

function formatReportStatus(status: SynthesisReport["status"], t: (key: string) => string) {
  if (status === "ready") return t("Ready");
  if (status === "partial") return t("Partial");
  return t("Failed");
}

function formatRunStatus(status: ModelRun["status"], t: (key: string) => string) {
  if (status === "completed") return t("Completed");
  if (status === "running") return t("Running");
  if (status === "pending") return t("Pending");
  return t("Failed");
}

function formatNodeStatus(status: ConversationNode["status"], t: (key: string) => string) {
  if (status === "completed") return t("Completed");
  if (status === "running") return t("Running");
  if (status === "failed") return t("Failed");
  return t("Idle");
}

function getModeBadgeClasses(mode: "mock" | "real") {
  return mode === "real" ? "badge-success" : "badge-warning";
}

function getReportStatusClasses(status: SynthesisReport["status"]) {
  if (status === "ready") return "badge-success";
  if (status === "partial") return "badge-warning";
  return "badge-error";
}

function getRunStatusClasses(status: ModelRun["status"] | ConversationNode["status"]) {
  if (status === "completed") return "badge-success";
  if (status === "running") return "badge-info";
  if (status === "pending" || status === "idle") return "badge-neutral";
  return "badge-error";
}

function formatTokenUsage(run: ModelRun) {
  const { inputTokens, outputTokens, totalTokens } = run.usage;
  return [
    `In ${inputTokens ?? "–"}`,
    `Out ${outputTokens ?? "–"}`,
    `Σ ${totalTokens ?? "–"}`,
  ].join(" · ");
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

function joinProviderLabels(providers: Array<{ label: string }>) {
  return providers.map((provider) => provider.label).join(", ");
}

function buildPresetReadinessNotice(props: {
  presetLabel: string;
  readyProviders: WorkspaceController["selectedPresetReadyProviders"];
  missingHostedProviders: WorkspaceController["selectedPresetMissingHostedProviders"];
  unavailableLocalProviders: WorkspaceController["selectedPresetUnavailableLocalProviders"];
}) {
  const readyLabels = joinProviderLabels(props.readyProviders);
  const missingHostedLabels = joinProviderLabels(props.missingHostedProviders);
  const unavailableLocalLabels = joinProviderLabels(props.unavailableLocalProviders);
  const localErrorDetails = props.unavailableLocalProviders
    .filter((provider) => provider.error)
    .map((provider) => `${provider.label}: ${provider.error}`);

  if (props.missingHostedProviders.length > 0) {
    return {
      title: `${props.presetLabel} is missing required hosted access.`,
      description: [
        `Missing hosted access: ${missingHostedLabels}. This preset will stay in Demo until those providers are configured.`,
        props.unavailableLocalProviders.length > 0 ?
          `Optional local: ${unavailableLocalLabels}.`
        : null,
        localErrorDetails.length > 0 ? `Last local check: ${localErrorDetails.join(" · ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      classes: "badge-warning",
    };
  }

  if (props.unavailableLocalProviders.length > 0) {
    return {
      title: `${props.presetLabel} can run live with reduced local coverage.`,
      description: [
        readyLabels ? `Hosted ready: ${readyLabels}.` : "Hosted access is ready.",
        `Optional local runtime unavailable: ${unavailableLocalLabels}. Live runs can continue, but those local slots may fail and the report may be partial.`,
        localErrorDetails.length > 0 ? `Last local check: ${localErrorDetails.join(" · ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      classes: "badge-info",
    };
  }

  return {
    title: `${props.presetLabel} is ready for live runs.`,
    description:
      readyLabels.length > 0 ?
        `Available: ${readyLabels}.`
      : "All required providers are configured.",
    classes: "badge-success",
  };
}

function focusProviderAccess(providerId?: SupportedProviderId) {
  if (typeof document === "undefined") return;
  const targetId = providerId ? getProviderAccessSectionId(providerId) : providerAccessCardId;
  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus();
}

function renderList(items: string[], t: (key: string) => string) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{t("No items yet.")}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-lg border border-border/50 bg-background/80 px-4 py-2.5 text-sm leading-6"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ─────  Sub Components  ───── */

function PresetPicker(props: {
  selectedPresetId: WorkspaceController["selectedPresetId"];
  onSelectPresetId: WorkspaceController["setSelectedPresetId"];
  isBusy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-border/50 bg-background/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium">{t("Run preset")}</div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("Choose the model mix for the next analysis run.")}
          </p>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          Next run: {synthesisPresetDefinitions.find(p => p.id === props.selectedPresetId)?.label ?? "—"}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {synthesisPresetDefinitions.map((preset) => {
          const isSelected = preset.id === props.selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={props.isBusy}
              aria-pressed={isSelected}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-card/60 hover:bg-accent"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => props.onSelectPresetId(preset.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{preset.label}</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {preset.providerSummary}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PresetReadinessNotice(props: {
  presetLabel: string;
  readyProviders: WorkspaceController["selectedPresetReadyProviders"];
  missingHostedProviders: WorkspaceController["selectedPresetMissingHostedProviders"];
  unavailableLocalProviders: WorkspaceController["selectedPresetUnavailableLocalProviders"];
}) {
  const { t } = useTranslation();
  const notice = buildPresetReadinessNotice(props);
  const firstMissingHostedProvider = props.missingHostedProviders[0] ?? null;
  const firstUnavailableLocalProvider = props.unavailableLocalProviders[0] ?? null;
  const localSetupHint =
    firstUnavailableLocalProvider ?
      getProviderDefinition(firstUnavailableLocalProvider.id).connectionHint ?? null
    : null;

  return (
    <section className={`rounded-lg border px-4 py-3 ${notice.classes}`}>
      <div className="text-[10px] uppercase tracking-widest">{t("Next run status")}</div>
      <div className="mt-1.5 text-sm font-semibold">{notice.title}</div>
      <p className="mt-1.5 text-xs leading-5">{notice.description}</p>

      {localSetupHint ? (
        <div className="mt-3 rounded-md border border-current/15 bg-background/50 px-3 py-2 text-xs leading-5">
          {localSetupHint}
        </div>
      ) : null}

      {firstMissingHostedProvider || firstUnavailableLocalProvider ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {firstMissingHostedProvider ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => focusProviderAccess(firstMissingHostedProvider.id)}
            >
              {t("Open provider access")}
            </Button>
          ) : null}
          {firstUnavailableLocalProvider ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => focusProviderAccess(firstUnavailableLocalProvider.id)}
            >
              View {firstUnavailableLocalProvider.label} setup
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EmptyWorkspaceState(props: { mode: "mock" | "real" }) {
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

      {/* Mode indicator */}
      <div className={`rounded-lg border px-4 py-3 ${notice.classes}`}>
        <div className="text-sm font-semibold">{notice.title}</div>
        <p className="mt-1 text-xs leading-5">{notice.description}</p>
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

function WorkspaceContext(props: {
  conversationTitle: string | null;
  branchName: string | null;
  nodeTitle: string | null;
  pendingSubmissionMode: "append" | "fork";
  selectedNodeIsHead: boolean;
}) {
  const { t } = useTranslation();
  const submissionHint =
    props.pendingSubmissionMode === "fork"
      ? t("Branch next run")
      : t("Continue current path");

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-muted-foreground">{t("Analysis")}:</span>
      <span className="truncate font-medium">{props.conversationTitle ?? t("No saved analysis selected")}</span>
      <span className="text-muted-foreground">›</span>
      <span className="truncate text-muted-foreground">{props.branchName ?? t("No path selected")}</span>
      <span className="text-muted-foreground">›</span>
      <span className="truncate text-muted-foreground">{props.nodeTitle ?? t("No step selected")}</span>
      <span className="ml-auto rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider badge-neutral">
        {submissionHint}
      </span>
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

function ModelRunsAccordion(props: { runs: ModelRun[] }) {
  const { t } = useTranslation();
  const [openRunId, setOpenRunId] = useState<string | null>(props.runs[0]?.id ?? null);

  return (
    <div className="space-y-1">
      {props.runs.map((run) => {
        const isOpen = openRunId === run.id;
        const colorClass = run.status === "completed" ? "text-primary" : run.status === "failed" ? "text-destructive" : "text-muted-foreground";

        return (
          <div
            key={run.id}
            className={`rounded-lg transition-colors border border-border/30 ${isOpen ? 'bg-surface-container-high' : 'bg-surface-container-low hover:bg-surface-container-high cursor-pointer'}`}
          >
            <button type="button" className={`w-full p-3 flex items-center justify-between text-left ${isOpen ? 'border-b border-border/20' : ''}`} onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}>
              <div className="flex w-full min-w-0 items-center gap-3">
                <div className={`text-sm font-bold flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${colorClass} bg-background border border-border/30`}>
                    {run.role.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold truncate ${isOpen ? 'text-primary' : 'text-foreground'}`}>
                    {run.role} {run.provider} / {run.model}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase truncate mt-0.5">
                    {formatRunStatus(run.status, t)} · {formatTokenUsage(run)} · {run.latencyMs ?? 0}ms
                  </div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'text-primary rotate-180' : 'text-muted-foreground'}`} />
              </div>
            </button>

            {isOpen ? (
              <div className="p-3 bg-surface-container-lowest/50 text-xs text-on-surface-variant leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto">
                {run.error ? (
                  <div className="text-destructive mb-2 font-bold font-sans">{t("Error")}: {run.error.message}</div>
                ) : null}
                {run.validation.issues.length > 0 ? (
                  <div className="text-status-warning-fg mb-2 font-bold font-sans">
                    {run.validation.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(`\n`)}
                  </div>
                ) : null}
                {run.rawText ?? t("No raw output recorded.")}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SynthesisReportView(props: { mode: "mock" | "real"; report: SynthesisReport }) {
  const { t } = useTranslation();
  const modeNotice = buildModeNotice(props.mode, t);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-border/50 bg-card/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("Synthesis Report")}
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{props.report.summary}</h3>
              </div>
            </div>
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
              {t("Question")}: {props.report.prompt}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getModeBadgeClasses(props.mode)}`}>
              {formatModeLabel(props.mode, t)}
            </span>
            <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getReportStatusClasses(props.report.status)}`}>
              {formatReportStatus(props.report.status, t)}
            </span>
          </div>
        </div>

        <div className={`mt-4 rounded-lg border px-4 py-3 ${modeNotice.classes}`}>
          <div className="text-sm font-semibold">{modeNotice.title}</div>
          <p className="mt-1 text-xs leading-5">{modeNotice.description}</p>
        </div>
      </section>

      {/* Report Sections */}
      <div className="grid gap-3">
        {/* Summary */}
        <section className="rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Summary")}</h4>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{props.report.summary}</p>
        </section>

        {/* Consensus */}
        <section className="rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Consensus")}</h4>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{props.report.consensus.summary}</p>
          {props.report.consensus.items.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {props.report.consensus.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-border/50 bg-background/80 px-4 py-2.5 text-sm leading-6">
                  <div className="font-medium">{item.statement}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {item.kind} · {item.confidence} {t("confidence")} · {item.supportingRunIds.length} {t("supporting runs")}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("No consensus items were extracted for this run.")}</p>
          )}
        </section>

        {/* Conflicts */}
        <section className="rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Conflicts")}</h4>
          </div>
          {props.report.conflicts.length > 0 ? (
            <div className="mt-3 space-y-3">
              {props.report.conflicts.map((conflict) => (
                <div key={conflict.id} className="breathing-critical rounded-lg border border-border/50 bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{conflict.title}</div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {conflict.severity} {t("severity")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{conflict.summary}</p>
                  <div className="mt-2 text-sm font-medium">{conflict.question}</div>
                  <ul className="mt-2 space-y-2">
                    {conflict.positions.map((position) => (
                      <li key={`${conflict.id}-${position.modelRunId}`} className="rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 text-sm leading-6">
                        <div className="font-medium">{position.label}</div>
                        <div className="mt-1">{position.stance}</div>
                        {position.evidence ? (
                          <div className="mt-1 text-muted-foreground">{position.evidence}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("No cross-model conflicts were detected for this run.")}</p>
          )}
        </section>

        {/* Resolution */}
        <section className="rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Resolution")}</h4>
          </div>
          {props.report.resolution ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                <div className="text-sm font-medium">{props.report.resolution.chosenApproach}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.report.resolution.rationale}</p>
              </div>
              {props.report.resolution.openRisks.length > 0 ? (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("Open risks")}</div>
                  <div className="mt-2">{renderList(props.report.resolution.openRisks, t)}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("No final resolution is available because the synthesis did not reach a valid judgeable state.")}</p>
          )}
        </section>

        {/* Next actions */}
        <section className="rounded-lg border border-border/50 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Next actions")}</h4>
          </div>
          <div className="mt-3">{renderList(props.report.nextActions, t)}</div>
        </section>
      </div>

      {/* Model Runs */}
      <section className="rounded-lg border border-border/50 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{t("Model runs")}</h4>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t("Expand an individual run to inspect raw output, token usage, latency, validation, and provider-level errors.")}
        </p>
        <div className="mt-3">
          <ModelRunsAccordion runs={props.report.modelRuns} />
        </div>
      </section>
    </div>
  );
}

/* ─────  Main Component  ───── */

type ProgressiveWorkspaceProps = {
  controller?: WorkspaceController;
};

export function ProgressiveWorkspace(props: ProgressiveWorkspaceProps) {
  const { t } = useTranslation();
  const controller = props.controller ?? useWorkspaceController();
  const {
    promptDraft,
    setPromptDraft,
    inputErrorMessage,
    latestSynthesisReport,
    runtimeErrorMessage,
    bootstrapErrorMessage,
    isBootstrapping,
    isRunning,
    isBusy,
    displayMode,
    selectedPresetId,
    selectedPresetDefinition,
    selectedPresetReadyProviders,
    selectedPresetMissingHostedProviders,
    selectedPresetUnavailableLocalProviders,
    setSelectedPresetId,
    selectedConversation,
    selectedBranch,
    selectedNode,
    selectedNodeIsHead,
    pendingSubmissionMode,
    submitPrompt,
  } = controller;


  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitPrompt();
    }
  };

  return (
    <Card className="flex flex-col h-full w-full border-none shadow-none bg-transparent overflow-hidden relative">
      <div className="flex-1 overflow-y-auto pb-36">
        <CardContent className="space-y-4 pt-4">
          {/* Breadcrumb context bar */}
          <WorkspaceContext
            conversationTitle={selectedConversation?.title ?? null}
            branchName={selectedBranch?.name ?? null}
            nodeTitle={selectedNode?.title ?? null}
            pendingSubmissionMode={pendingSubmissionMode}
            selectedNodeIsHead={selectedNodeIsHead}
          />

          <PresetPicker
            selectedPresetId={selectedPresetId}
            onSelectPresetId={setSelectedPresetId}
            isBusy={isBusy}
          />

          <PresetReadinessNotice
            presetLabel={selectedPresetDefinition.label}
            readyProviders={selectedPresetReadyProviders}
            missingHostedProviders={selectedPresetMissingHostedProviders}
            unavailableLocalProviders={selectedPresetUnavailableLocalProviders}
          />

          {/* Example Prompts */}
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

          {/* Main content area */}
          {isBootstrapping ? (
            <LoadingWorkspaceState />
          ) : latestSynthesisReport ? (
            <SynthesisReportView mode={displayMode} report={latestSynthesisReport} />
          ) : selectedNode ? (
            <HistoricalNodeState mode={displayMode} node={selectedNode} />
          ) : (
            <EmptyWorkspaceState mode={displayMode} />
          )}
        </CardContent>
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-0 w-full left-0 right-0 z-10 px-4 pb-3 pointer-events-none bg-gradient-to-t from-surface via-surface/90 to-transparent pt-10">
        <div className="w-full bg-surface-container-low/95 backdrop-blur-xl border border-border/40 border-b-2 border-b-primary shadow-xl p-3 pointer-events-auto rounded-lg">
          <div className="flex items-end gap-3 w-full">
            <div className="flex-1 flex flex-col gap-1 w-full">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest pl-0.5">
                {pendingSubmissionMode === "fork" ? t("Fork Branch Next Steps") : t("Logic Input Shell")}
              </label>
              <textarea
                aria-label="Question"
                className="bg-transparent border-none w-full p-1 text-sm focus:ring-0 text-foreground placeholder:text-muted-foreground font-mono resize-none outline-none overflow-y-auto"
                placeholder={t("Refine logic or branch out... Use Cmd/Ctrl+Enter to commit") as string}
                rows={1}
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                disabled={isBusy}
              ></textarea>
            </div>

            <div className="flex gap-2 shrink-0 h-[36px]">
              {isBootstrapping ? (
                 <Button disabled className="h-full rounded-lg" aria-label="Restoring">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs font-semibold uppercase tracking-tight">{t("Restoring your history")}</span>
                 </Button>
              ) : isRunning ? (
                 <Button disabled className="h-full rounded-lg" aria-label="Running">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs font-semibold uppercase tracking-tight">{t("Running...")}</span>
                 </Button>
              ) : pendingSubmissionMode === "fork" ? (
                <button
                  disabled={isBusy}
                  onClick={() => void submitPrompt()}
                  className="bg-surface-container-high text-foreground h-full px-4 flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer border border-border/30 rounded-lg disabled:opacity-50"
                >
                  <GitFork className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Branch Fork")}</span>
                </button>
               ) : (
                <button
                  disabled={isBusy}
                  onClick={() => void submitPrompt()}
                  className="bg-primary text-primary-foreground h-full px-4 flex items-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer border-none rounded-lg disabled:opacity-50"
                  aria-label="Analyze question"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Commit Context")}</span>
                </button>
               )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
