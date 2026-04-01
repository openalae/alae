import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ShieldAlert,
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
import {
  toggleTruthPanel,
  useTruthPanelAutoOpen,
  useTruthPanelState,
} from "@/features/truth-panel/controller";
import type { ModelRun, TraceEvent, ValidationIssue } from "@/schema";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " · ").replace(".000Z", "Z");
}

function formatNullableMetric(value: number | null, suffix = "") {
  if (value === null) {
    return "n/a";
  }

  return `${value}${suffix}`;
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

function getEventLevelClasses(level: TraceEvent["level"]) {
  if (level === "info") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-900";
  }

  if (level === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-900";
}

function formatTokenUsage(run: ModelRun) {
  return [
    `Input ${formatNullableMetric(run.usage.inputTokens)}`,
    `Output ${formatNullableMetric(run.usage.outputTokens)}`,
    `Total ${formatNullableMetric(run.usage.totalTokens)}`,
  ].join(" · ");
}

function PanelMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-2 text-sm font-medium">{props.value}</div>
    </div>
  );
}

function EmptySection(props: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 px-4 py-4 text-sm leading-6 text-muted-foreground">
      {props.message}
    </div>
  );
}

function TruthPanelSummary() {
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return <EmptySection message="Run an analysis to see model calls, errors, and validation details." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PanelMetric
        label="Total runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.totalRuns)}
      />
      <PanelMetric
        label="Completed runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.completedRuns)}
      />
      <PanelMetric
        label="Failed runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.failedRuns)}
      />
      <PanelMetric
        label="Aggregate input"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateInputTokens)}
      />
      <PanelMetric
        label="Aggregate output"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateOutputTokens)}
      />
      <PanelMetric
        label="Aggregate total"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateTotalTokens)}
      />
      <PanelMetric
        label="Aggregate latency"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateLatencyMs, " ms")}
      />
      <PanelMetric
        label="Max latency"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.maxLatencyMs, " ms")}
      />
      <PanelMetric
        label="Pending runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.pendingRuns)}
      />
      <PanelMetric
        label="Running runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.runningRuns)}
      />
      <PanelMetric
        label="Updated"
        value={formatTimestamp(truthPanelSnapshot.generatedAt)}
      />
      <PanelMetric label="Report ID" value={truthPanelSnapshot.reportId ?? "n/a"} />
    </div>
  );
}

function CollapsedTruthPanelSummary() {
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return (
      <EmptySection message="Run an analysis to see model calls, errors, and validation details." />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <PanelMetric
        label="Total runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.totalRuns)}
      />
      <PanelMetric
        label="Failed runs"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.failedRuns)}
      />
      <PanelMetric
        label="Aggregate total"
        value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateTotalTokens)}
      />
    </div>
  );
}

function TruthPanelRunList() {
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return <EmptySection message="No model-call details are available yet." />;
  }

  return (
    <div className="space-y-3">
      {truthPanelSnapshot.runs.map((run) => (
        <section
          key={run.id}
          className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold capitalize">{run.role}</span>
                <span className="text-sm text-muted-foreground">
                  {run.provider} / {run.model}
                </span>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {formatTokenUsage(run)}
              </div>
            </div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getRunStatusClasses(run.status)}`}
            >
              {formatRunStatus(run.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <PanelMetric label="Latency" value={formatNullableMetric(run.latencyMs, " ms")} />
            <PanelMetric label="Validation" value={run.validation.status} />
            <PanelMetric label="Completed" value={formatTimestamp(run.completedAt)} />
          </div>

          {run.error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-950">
              <div className="font-semibold">Error</div>
              <p className="mt-2 leading-6">{run.error.message}</p>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function ValidationIssueList() {
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot || truthPanelSnapshot.validationIssues.length === 0) {
    return <EmptySection message="No validation issues were recorded for the latest result." />;
  }

  return (
    <div className="space-y-3">
      {truthPanelSnapshot.validationIssues.map((issue: ValidationIssue) => (
        <div
          key={`${issue.runId}-${issue.path.join(".")}-${issue.message}`}
          className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950"
        >
          <div className="font-semibold">Run {issue.runId}</div>
          <div className="mt-2 leading-6">
            {issue.path.join(".")}: {issue.message}
          </div>
        </div>
      ))}
    </div>
  );
}

function TraceEventList() {
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot || truthPanelSnapshot.events.length === 0) {
    return <EmptySection message="No activity was recorded for the latest result." />;
  }

  return (
    <div className="space-y-3">
      {truthPanelSnapshot.events.map((event) => (
        <div
          key={event.id}
          className="rounded-[1.5rem] border border-border/70 bg-background/80 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getEventLevelClasses(event.level)}`}
            >
              {event.level}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {event.scope}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6">{event.message}</p>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {formatTimestamp(event.occurredAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TruthPanel() {
  useTruthPanelAutoOpen();

  const {
    isTruthPanelOpen,
    truthPanelSnapshot,
    latestSynthesisReport,
    runtimeErrorMessage,
  } = useTruthPanelState();

  const reportStatus = latestSynthesisReport?.status ?? "idle";
  const reportStatusLabel =
    reportStatus === "idle" ? "Waiting for analysis" : `Latest result ${reportStatus}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              Model status
            </CardTitle>
            <CardDescription>
              See which model calls ran, whether any failed, and the latest validation details.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTruthPanel}>
            {isTruthPanelOpen ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show details
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {reportStatusLabel}
          </span>
          {truthPanelSnapshot ? (
            <span className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Snapshot {formatTimestamp(truthPanelSnapshot.generatedAt)}
            </span>
          ) : null}
        </div>

        {runtimeErrorMessage ? (
          <div className="rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-950">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Runtime failure
            </div>
            <p className="mt-2 leading-6">{runtimeErrorMessage}</p>
          </div>
        ) : null}

        {!isTruthPanelOpen ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4">
            <CollapsedTruthPanelSummary />
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Waypoints className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Overview
                </h3>
              </div>
              <TruthPanelSummary />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Model calls
                </h3>
              </div>
              <TruthPanelRunList />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Output issues
                </h3>
              </div>
              <ValidationIssueList />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Activity log
                </h3>
              </div>
              <TraceEventList />
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
