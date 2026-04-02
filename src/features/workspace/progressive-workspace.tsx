import { useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  ChevronDown,
  History,
  LoaderCircle,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { synthesisPresetDefinitions } from "@/features/consensus";
import { toggleTruthPanel, useTruthPanelState } from "@/features/truth-panel";
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

function formatModeLabel(mode: "mock" | "real") {
  return mode === "real" ? "Live" : "Demo";
}

function formatReportStatus(status: SynthesisReport["status"]) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "partial") {
    return "Partial";
  }

  return "Failed";
}

function formatRunStatus(status: ModelRun["status"]) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "pending") {
    return "Pending";
  }

  return "Failed";
}

function formatNodeStatus(status: ConversationNode["status"]) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Idle";
}

function getModeBadgeClasses(mode: "mock" | "real") {
  return mode === "real"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
    : "border-amber-500/30 bg-amber-500/10 text-amber-900";
}

function getReportStatusClasses(status: SynthesisReport["status"]) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900";
  }

  if (status === "partial") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-900";
}

function getRunStatusClasses(status: ModelRun["status"] | ConversationNode["status"]) {
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-900";
  }

  if (status === "pending" || status === "idle") {
    return "border-border/80 bg-background/80 text-muted-foreground";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-900";
}

function formatTokenUsage(run: ModelRun) {
  const { inputTokens, outputTokens, totalTokens } = run.usage;

  return [
    `Input ${inputTokens ?? "n/a"}`,
    `Output ${outputTokens ?? "n/a"}`,
    `Total ${totalTokens ?? "n/a"}`,
  ].join(" · ");
}

function buildModeNotice(mode: "mock" | "real") {
  if (mode === "real") {
    return {
      title: "Live model mode is ready.",
      description:
        "This run will call real models because the required hosted providers are configured. Local providers such as Ollama do not need keys.",
      classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-950",
    };
  }

  return {
    title: "Demo mode is on.",
    description:
      "This run will use built-in sample responses until you configure the hosted providers required by the active preset. The default free preset uses OpenRouter plus optional local Ollama models.",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-950",
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
          `Optional local runtime unavailable: ${unavailableLocalLabels}.`
        : null,
        localErrorDetails.length > 0 ? `Last local check: ${localErrorDetails.join(" · ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      classes: "border-amber-500/25 bg-amber-500/10 text-amber-950",
    };
  }

  if (props.unavailableLocalProviders.length > 0) {
    return {
      title: `${props.presetLabel} can run live with reduced local coverage.`,
      description: [
        readyLabels ? `Hosted access is ready for ${readyLabels}.` : "Hosted access is ready.",
        `Optional local runtime unavailable: ${unavailableLocalLabels}. Live runs can continue, but those local slots may fail and the report may be partial.`,
        localErrorDetails.length > 0 ? `Last local check: ${localErrorDetails.join(" · ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      classes: "border-sky-500/25 bg-sky-500/10 text-sky-950",
    };
  }

  return {
    title: `${props.presetLabel} is ready for live runs.`,
    description:
      readyLabels.length > 0 ?
        `Available providers for the next run: ${readyLabels}.`
      : "All required providers are configured for the next run.",
    classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-950",
  };
}

function focusProviderAccess(providerId?: SupportedProviderId) {
  if (typeof document === "undefined") {
    return;
  }

  const targetId = providerId ? getProviderAccessSectionId(providerId) : providerAccessCardId;
  const target = document.getElementById(targetId);

  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  target.focus();
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">No items yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm leading-6"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function PresetPicker(props: {
  selectedPresetId: WorkspaceController["selectedPresetId"];
  onSelectPresetId: WorkspaceController["setSelectedPresetId"];
  isBusy: boolean;
}) {
  return (
    <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-5">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Run preset</div>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose the model mix for the next analysis run.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {synthesisPresetDefinitions.map((preset) => {
          const isSelected = preset.id === props.selectedPresetId;

          return (
            <button
              key={preset.id}
              type="button"
              disabled={props.isBusy}
              aria-pressed={isSelected}
              className={`rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/75 hover:bg-card"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => props.onSelectPresetId(preset.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{preset.label}</div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {preset.providerSummary}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{preset.description}</p>
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
  const notice = buildPresetReadinessNotice(props);
  const firstMissingHostedProvider = props.missingHostedProviders[0] ?? null;
  const firstUnavailableLocalProvider = props.unavailableLocalProviders[0] ?? null;
  const localSetupHint =
    firstUnavailableLocalProvider ?
      getProviderDefinition(firstUnavailableLocalProvider.id).connectionHint ?? null
    : null;

  return (
    <section className={`rounded-[1.75rem] border px-5 py-4 ${notice.classes}`}>
      <div className="text-xs uppercase tracking-[0.18em]">Next run status</div>
      <div className="mt-2 text-sm font-semibold">{notice.title}</div>
      <p className="mt-2 text-sm leading-6">{notice.description}</p>

      {localSetupHint ? (
        <div className="mt-4 rounded-2xl border border-current/15 bg-background/50 px-4 py-3 text-sm leading-6">
          {localSetupHint}
        </div>
      ) : null}

      {firstMissingHostedProvider || firstUnavailableLocalProvider ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {firstMissingHostedProvider ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => focusProviderAccess(firstMissingHostedProvider.id)}
            >
              Open provider access
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
  const notice = buildModeNotice(props.mode);

  return (
    <div className="space-y-6 rounded-[2rem] border border-dashed border-border/80 bg-background/55 p-6">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Start here
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-balance">
            Ask a question and get a combined answer.
          </h3>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            Start with one question. Alae compares several model responses, highlights agreements
            and disagreements, and keeps each step in a saved local history.
          </p>
        </div>
      </div>

      <div className={`rounded-[1.5rem] border px-5 py-4 ${notice.classes}`}>
        <div className="text-sm font-semibold">{notice.title}</div>
        <p className="mt-2 text-sm leading-6">{notice.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            01. Ask
          </div>
          <p className="mt-3 text-sm leading-6">
            Type a question in the center box and submit with the button or `Cmd/Ctrl+Enter`.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            02. Compare
          </div>
          <p className="mt-3 text-sm leading-6">
            Read the combined answer first, then scan agreements, disagreements, and recommended
            next steps.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            03. Inspect
          </div>
          <p className="mt-3 text-sm leading-6">
            Open model status only when you want raw output, token usage, latency, or validation
            details.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingWorkspaceState() {
  return (
    <div className="space-y-6 rounded-[2rem] border border-border/80 bg-background/65 p-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
        Restoring your history
      </div>

      <div className="space-y-3">
        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-balance">
          Loading your latest saved analysis.
        </h3>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          Alae is reopening your last saved step before enabling new questions.
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-card/75 px-5 py-4 text-sm leading-6 text-muted-foreground">
        New questions are temporarily disabled until the latest local state finishes loading.
      </div>
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
  const submissionHint =
    props.pendingSubmissionMode === "fork"
      ? "Your next question will start a new branch from the selected saved step."
      : props.selectedNodeIsHead
        ? "Your next question will continue from the current path."
        : "Your next question will continue from the selected path.";

  return (
    <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Current context
        </span>
        <span className="inline-flex rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {props.pendingSubmissionMode === "fork" ? "Branch next run" : "Continue current path"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Analysis
          </div>
          <div className="mt-2 text-sm font-medium">
            {props.conversationTitle ?? "No saved analysis selected"}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Path
          </div>
          <div className="mt-2 text-sm font-medium">{props.branchName ?? "No path selected"}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Step
          </div>
          <div className="mt-2 text-sm font-medium">{props.nodeTitle ?? "No step selected"}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{submissionHint}</p>
    </section>
  );
}

function HistoricalNodeState(props: { mode: "mock" | "real"; node: ConversationNode }) {
  const modeNotice = buildModeNotice(props.mode);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <History className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Saved step
                </div>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-balance">
                  {props.node.title}
                </h3>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              This saved step does not have a stored combined answer, but you can still branch
              from it and continue the analysis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getModeBadgeClasses(props.mode)}`}
            >
              {formatModeLabel(props.mode)}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getRunStatusClasses(props.node.status)}`}
            >
              {formatNodeStatus(props.node.status)}
            </span>
          </div>
        </div>

        <div className={`mt-6 rounded-[1.5rem] border px-5 py-4 ${modeNotice.classes}`}>
          <div className="text-sm font-semibold">{modeNotice.title}</div>
          <p className="mt-2 text-sm leading-6">{modeNotice.description}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-3">
          <Waypoints className="h-5 w-5 text-primary" />
          <h4 className="text-lg font-semibold">Checkpoint details</h4>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </div>
            <div className="mt-2 text-sm font-medium">{formatNodeStatus(props.node.status)}</div>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Created
            </div>
            <div className="mt-2 text-sm font-medium">{props.node.createdAt}</div>
          </div>
        </div>
        <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Question</div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {props.node.prompt}
          </p>
        </div>
      </section>
    </div>
  );
}

function ModelRunsAccordion(props: { runs: ModelRun[] }) {
  const [openRunId, setOpenRunId] = useState<string | null>(props.runs[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {props.runs.map((run) => {
        const isOpen = openRunId === run.id;

        return (
          <section
            key={run.id}
            className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/75"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpenRunId((current) => (current === run.id ? null : run.id))}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{run.role}</span>
                  <span className="text-sm text-muted-foreground">
                    {run.provider} / {run.model}
                  </span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatTokenUsage(run)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getRunStatusClasses(run.status)}`}
                >
                  {formatRunStatus(run.status)}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isOpen ? (
              <div className="border-t border-border/70 px-5 py-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Latency
                    </div>
                    <div className="mt-2 font-medium">{run.latencyMs ?? "n/a"} ms</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Validation
                    </div>
                    <div className="mt-2 font-medium capitalize">{run.validation.status}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Completed
                    </div>
                    <div className="mt-2 font-medium">{run.completedAt ?? "n/a"}</div>
                  </div>
                </div>

                {run.error ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-950">
                    <div className="font-semibold">Run error</div>
                    <p className="mt-2 leading-6">{run.error.message}</p>
                  </div>
                ) : null}

                {run.validation.issues.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
                    <div className="font-semibold">Validation issues</div>
                    <ul className="mt-2 space-y-2">
                      {run.validation.issues.map((issue) => (
                        <li key={`${issue.runId}-${issue.path.join(".")}`} className="leading-6">
                          {issue.path.join(".")}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/90 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Raw output
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                    {run.rawText ?? "No raw output recorded for this run."}
                  </pre>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function SynthesisReportView(props: { mode: "mock" | "real"; report: SynthesisReport }) {
  const modeNotice = buildModeNotice(props.mode);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Synthesis Report
                </div>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-balance">
                  {props.report.summary}
                </h3>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              Question: {props.report.prompt}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getModeBadgeClasses(props.mode)}`}
            >
              {formatModeLabel(props.mode)}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getReportStatusClasses(props.report.status)}`}
            >
              {formatReportStatus(props.report.status)}
            </span>
          </div>
        </div>

        <div className={`mt-6 rounded-[1.5rem] border px-5 py-4 ${modeNotice.classes}`}>
          <div className="text-sm font-semibold">{modeNotice.title}</div>
          <p className="mt-2 text-sm leading-6">{modeNotice.description}</p>
        </div>
      </section>

      <div className="grid gap-4">
        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">Summary</h4>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{props.report.summary}</p>
        </section>

        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-3">
            <Waypoints className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">Consensus</h4>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {props.report.consensus.summary}
          </p>
          {props.report.consensus.items.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {props.report.consensus.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm leading-6"
                >
                  <div className="font-medium">{item.statement}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {item.kind} · {item.confidence} confidence · {item.supportingRunIds.length} supporting
                    runs
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No consensus items were extracted for this run.
            </p>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">Conflicts</h4>
          </div>
          {props.report.conflicts.length > 0 ? (
            <div className="mt-4 space-y-4">
              {props.report.conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{conflict.title}</div>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {conflict.severity} severity
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {conflict.summary}
                  </p>
                  <div className="mt-3 text-sm font-medium">{conflict.question}</div>
                  <ul className="mt-3 space-y-3">
                    {conflict.positions.map((position) => (
                      <li
                        key={`${conflict.id}-${position.modelRunId}`}
                        className="rounded-2xl border border-border/70 bg-card/75 px-4 py-3 text-sm leading-6"
                      >
                        <div className="font-medium">{position.label}</div>
                        <div className="mt-2">{position.stance}</div>
                        {position.evidence ? (
                          <div className="mt-2 text-muted-foreground">{position.evidence}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No cross-model conflicts were detected for this run.
            </p>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">Resolution</h4>
          </div>
          {props.report.resolution ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-sm font-medium">{props.report.resolution.chosenApproach}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {props.report.resolution.rationale}
                </p>
              </div>
              {props.report.resolution.openRisks.length > 0 ? (
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Open risks
                  </div>
                  <div className="mt-3">{renderList(props.report.resolution.openRisks)}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No final resolution is available because the synthesis did not reach a valid
              judgeable state.
            </p>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h4 className="text-lg font-semibold">Next actions</h4>
          </div>
          <div className="mt-4">{renderList(props.report.nextActions)}</div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h4 className="text-lg font-semibold">Model runs</h4>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Expand an individual run to inspect raw output, token usage, latency, validation, and
          provider-level errors.
        </p>
        <div className="mt-5">
          <ModelRunsAccordion runs={props.report.modelRuns} />
        </div>
      </section>
    </div>
  );
}

type ProgressiveWorkspaceProps = {
  controller?: WorkspaceController;
};

export function ProgressiveWorkspace(props: ProgressiveWorkspaceProps) {
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
  const { isTruthPanelOpen } = useTruthPanelState();

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitPrompt();
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-card/85">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ask and analyze
            </div>
            <div>
              <CardTitle className="text-3xl tracking-[-0.04em]">Ask and Analyze</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Ask one question, read the combined answer first, and open detailed model evidence
                only when you need it.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Next run: {selectedPresetDefinition.label}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={toggleTruthPanel}>
              {isTruthPanelOpen ? "Hide Model Status" : "Show Model Status"}
            </Button>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getModeBadgeClasses(displayMode)}`}
            >
              {formatModeLabel(displayMode)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
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

        <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label htmlFor="workspace-prompt" className="text-sm font-medium">
                  Question
                </label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ask what you want compared or reviewed. Use `Cmd/Ctrl+Enter` to submit.
                </p>
              </div>
              <Button
                type="button"
                disabled={isBusy}
                onClick={() => void submitPrompt()}
                className="min-w-[190px]"
              >
                {isBootstrapping ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : isRunning ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : pendingSubmissionMode === "fork" ? (
                  "Branch and analyze"
                ) : (
                  "Analyze question"
                )}
              </Button>
            </div>

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
                  {example.label}
                </Button>
              ))}
            </div>

            <textarea
              id="workspace-prompt"
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              disabled={isBusy}
              spellCheck={false}
              rows={6}
              placeholder="Example: Compare Zustand vs Redux Toolkit for this desktop app and recommend which one fits better."
              className="min-h-[160px] w-full rounded-[1.5rem] border border-border/80 bg-card/85 px-4 py-4 text-sm leading-7 shadow-sm shadow-black/5 outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </section>

        {inputErrorMessage ? (
          <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-950">
            {inputErrorMessage}
          </div>
        ) : null}

        {bootstrapErrorMessage ? (
          <div className="rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-950">
            {bootstrapErrorMessage}
          </div>
        ) : null}

        {runtimeErrorMessage ? (
          <div className="rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-950">
            {runtimeErrorMessage}
          </div>
        ) : null}

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
    </Card>
  );
}
