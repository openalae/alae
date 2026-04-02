import { useTranslation } from "react-i18next";
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
  toggleTruthPanel,
  useTruthPanelAutoOpen,
  useTruthPanelState,
} from "@/features/truth-panel/controller";
import type { ModelRun, TraceEvent, ValidationIssue } from "@/schema";

function formatTimestamp(value: string | null) {
  if (!value) return "n/a";
  return value.replace("T", " · ").replace(".000Z", "Z");
}

function formatNullableMetric(value: number | null, suffix = "") {
  if (value === null) return "n/a";
  return `${value}${suffix}`;
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

function getEventLevelClasses(level: TraceEvent["level"]) {
  if (level === "info") return "badge-info";
  if (level === "warning") return "badge-warning";
  return "badge-error";
}

function formatTokenUsage(run: ModelRun) {
  return [
    `In ${formatNullableMetric(run.usage.inputTokens)}`,
    `Out ${formatNullableMetric(run.usage.outputTokens)}`,
    `Σ ${formatNullableMetric(run.usage.totalTokens)}`,
  ].join(" · ");
}

function PanelMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-xs font-medium">{props.value}</div>
    </div>
  );
}

function EmptySection(props: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-background/70 px-3 py-3 text-xs leading-5 text-muted-foreground italic">
      {props.message}
    </div>
  );
}

function TruthPanelSummary() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return <EmptySection message={t("Run an analysis to see model calls, errors, and validation details.")} />;
  }

  return (
    <div className="grid gap-2 grid-cols-2">
      <PanelMetric label={t("Total runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.totalRuns)} />
      <PanelMetric label={t("Completed runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.completedRuns)} />
      <PanelMetric label={t("Failed runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.failedRuns)} />
      <PanelMetric label={t("Aggregate input")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateInputTokens)} />
      <PanelMetric label={t("Aggregate output")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateOutputTokens)} />
      <PanelMetric label={t("Aggregate total")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateTotalTokens)} />
      <PanelMetric label={t("Aggregate latency")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateLatencyMs, " ms")} />
      <PanelMetric label={t("Max latency")} value={formatNullableMetric(truthPanelSnapshot.runSummary.maxLatencyMs, " ms")} />
      <PanelMetric label={t("Pending runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.pendingRuns)} />
      <PanelMetric label={t("Running runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.runningRuns)} />
    </div>
  );
}

function CollapsedTruthPanelSummary() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return <EmptySection message={t("Run an analysis to see model calls, errors, and validation details.")} />;
  }

  return (
    <div className="grid gap-2 grid-cols-3">
      <PanelMetric label={t("Total runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.totalRuns)} />
      <PanelMetric label={t("Failed runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.failedRuns)} />
      <PanelMetric label={t("Aggregate total")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateTotalTokens)} />
    </div>
  );
}

function TruthPanelRunList() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) {
    return <EmptySection message={t("No model-call details are available yet.")} />;
  }

  return (
    <div className="space-y-2">
      {truthPanelSnapshot.runs.map((run) => (
        <section key={run.id} className="rounded-lg border border-border/50 bg-background/80 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold capitalize">{run.role}</span>
                <span className="text-xs text-muted-foreground">{run.provider} / {run.model}</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {formatTokenUsage(run)}
              </div>
            </div>
            <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getRunStatusClasses(run.status)}`}>
              {formatRunStatus(run.status, t)}
            </span>
          </div>
          <div className="mt-2 grid gap-2">
            <PanelMetric label={t("Latency")} value={formatNullableMetric(run.latencyMs, " ms")} />
            <PanelMetric label={t("Validation")} value={run.validation.status} />
          </div>
          {run.error ? (
            <div className="mt-2 rounded-lg border px-3 py-2 text-xs badge-error">
              <div className="font-semibold">{t("Error")}</div>
              <p className="mt-1 leading-5">{run.error.message}</p>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function ValidationIssueList() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot || truthPanelSnapshot.validationIssues.length === 0) {
    return <EmptySection message={t("No validation issues were recorded for the latest result.")} />;
  }

  return (
    <div className="space-y-2">
      {truthPanelSnapshot.validationIssues.map((issue: ValidationIssue) => (
        <div
          key={`${issue.runId}-${issue.path.join(".")}-${issue.message}`}
          className="rounded-lg border px-3 py-2 text-xs badge-warning"
        >
          <div className="font-semibold">{t("Run")} {issue.runId}</div>
          <div className="mt-1 leading-5">{issue.path.join(".")}: {issue.message}</div>
        </div>
      ))}
    </div>
  );
}

function TraceEventList() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot || truthPanelSnapshot.events.length === 0) {
    return <EmptySection message={t("No activity was recorded for the latest result.")} />;
  }

  return (
    <div className="space-y-2">
      {truthPanelSnapshot.events.map((event) => (
        <div key={event.id} className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getEventLevelClasses(event.level)}`}>
              {event.level}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{event.scope}</span>
          </div>
          <p className="mt-2 text-xs leading-5">{event.message}</p>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {formatTimestamp(event.occurredAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TruthPanel() {
  useTruthPanelAutoOpen();
  const { t } = useTranslation();

  const {
    isTruthPanelOpen,
    truthPanelSnapshot,
    latestSynthesisReport,
    runtimeErrorMessage,
  } = useTruthPanelState();

  const reportStatus = latestSynthesisReport?.status ?? "idle";
  const reportStatusLabel =
    reportStatus === "idle" ? t("Waiting for analysis") : `${t("Latest result")} ${reportStatus}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-border/30">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" />
            {t("Model status")}
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("See which model calls ran, whether any failed, and the latest validation details.")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleTruthPanel}>
          {isTruthPanelOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span className="text-xs">{t("Hide details")}</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span className="text-xs">{t("Show details")}</span>
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider badge-neutral">
            {reportStatusLabel}
          </span>
          {truthPanelSnapshot ? (
            <span className="inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider badge-neutral">
              {t("Snapshot")} {formatTimestamp(truthPanelSnapshot.generatedAt)}
            </span>
          ) : null}
        </div>

        {runtimeErrorMessage ? (
          <div className="rounded-lg border px-3 py-2 text-xs badge-error">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t("Runtime failure")}
            </div>
            <p className="mt-1 leading-5">{runtimeErrorMessage}</p>
          </div>
        ) : null}

        {!isTruthPanelOpen ? (
          <CollapsedTruthPanelSummary />
        ) : (
          <div className="space-y-4">
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Waypoints className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("Overview")}</h3>
              </div>
              <TruthPanelSummary />
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("Model calls")}</h3>
              </div>
              <TruthPanelRunList />
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("Output issues")}</h3>
              </div>
              <ValidationIssueList />
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("Activity log")}</h3>
              </div>
              <TraceEventList />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
