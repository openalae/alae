import { useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  ChevronDown,
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
import { toggleTruthPanel, useTruthPanelState } from "@/features/truth-panel";
import { useWorkspaceController } from "@/features/workspace/controller";
import type { ModelRun, SynthesisReport } from "@/schema";

function formatModeLabel(mode: "mock" | "real") {
  return mode === "real" ? "Real" : "Mock";
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

function getRunStatusClasses(status: ModelRun["status"]) {
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-900";
  }

  if (status === "pending") {
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
      title: "Live provider execution is available.",
      description:
        "All providers required by the current preset are configured, so runs will use real model calls.",
      classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-950",
    };
  }

  return {
    title: "Mock execution is active.",
    description:
      "At least one required provider key is missing. The workspace will fall back to deterministic mock runs until OpenAI, Anthropic, and Google are all configured.",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-950",
  };
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

function EmptyWorkspaceState(props: { mode: "mock" | "real" }) {
  const notice = buildModeNotice(props.mode);

  return (
    <div className="space-y-6 rounded-[2rem] border border-dashed border-border/80 bg-background/55 p-6">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Progressive Workspace
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-balance">
            Run a synthesis and keep the main view high-signal.
          </h3>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            The center column now acts as the Phase 1 workspace: submit a prompt, receive a
            structured synthesis report, then drill into individual model runs only when you
            need source-level detail.
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
            01. Compose
          </div>
          <p className="mt-3 text-sm leading-6">
            Write the next prompt in the composer and submit with the button or
            `Cmd/Ctrl+Enter`.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            02. Review
          </div>
          <p className="mt-3 text-sm leading-6">
            Stay on the synthesis report first: summary, consensus, conflicts, resolution, and
            next actions.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            03. Audit
          </div>
          <p className="mt-3 text-sm leading-6">
            Expand individual model runs only when you need raw text, token usage, latency, or
            validation details.
          </p>
        </div>
      </div>
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
          <section key={run.id} className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/75">
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
              Prompt: {props.report.prompt}
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

export function ProgressiveWorkspace() {
  const {
    promptDraft,
    setPromptDraft,
    inputErrorMessage,
    latestSynthesisReport,
    runtimeErrorMessage,
    isRunning,
    displayMode,
    submitPrompt,
  } = useWorkspaceController();
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
              Center Workspace
            </div>
            <div>
              <CardTitle className="text-3xl tracking-[-0.04em]">Progressive Workspace</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Submit a prompt, run synthesis, and keep the center column focused on a single
                report before drilling into provider-level evidence.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={toggleTruthPanel}>
              {isTruthPanelOpen ? "Hide Truth Panel" : "Open Truth Panel"}
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
        <section className="rounded-[1.75rem] border border-border/70 bg-background/80 p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label htmlFor="workspace-prompt" className="text-sm font-medium">
                  Prompt
                </label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Use `Cmd/Ctrl+Enter` to submit the current prompt.
                </p>
              </div>
              <Button
                type="button"
                disabled={isRunning}
                onClick={() => void submitPrompt()}
                className="min-w-[160px]"
              >
                {isRunning ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  "Run synthesis"
                )}
              </Button>
            </div>

            <textarea
              id="workspace-prompt"
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              disabled={isRunning}
              spellCheck={false}
              rows={6}
              placeholder="Ask Alae to compare approaches, extract consensus, and surface the important conflicts."
              className="min-h-[160px] w-full rounded-[1.5rem] border border-border/80 bg-card/85 px-4 py-4 text-sm leading-7 shadow-sm shadow-black/5 outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </section>

        {inputErrorMessage ? (
          <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-950">
            {inputErrorMessage}
          </div>
        ) : null}

        {runtimeErrorMessage ? (
          <div className="rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-950">
            {runtimeErrorMessage}
          </div>
        ) : null}

        {latestSynthesisReport ? (
          <SynthesisReportView mode={displayMode} report={latestSynthesisReport} />
        ) : (
          <EmptyWorkspaceState mode={displayMode} />
        )}
      </CardContent>
    </Card>
  );
}
