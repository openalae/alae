import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ShieldAlert,
  Waypoints,
} from "lucide-react";

import {
  toggleTruthPanel,
  useTruthPanelAutoOpen,
  useTruthPanelState,
} from "@/features/truth-panel/controller";
import type { ModelRun, TraceEvent, ValidationIssue } from "@/schema";

type TruthPanelTab = "overview" | "runs" | "issues" | "logs";

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
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      <PanelMetric label={t("Total runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.totalRuns)} />
      <PanelMetric label={t("Completed runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.completedRuns)} />
      <PanelMetric label={t("Failed runs")} value={formatNullableMetric(truthPanelSnapshot.runSummary.failedRuns)} />
      <PanelMetric label={t("Aggregate total")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateTotalTokens)} />
      <PanelMetric label={t("Aggregate latency")} value={formatNullableMetric(truthPanelSnapshot.runSummary.aggregateLatencyMs, " ms")} />
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
    <div className="grid gap-3 lg:grid-cols-2">
      {truthPanelSnapshot.runs.map((run) => (
        <section key={run.id} className="rounded-lg border border-border/50 bg-background/80 p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-tight shrink-0">{t(run.role)}</span>
                <span className="text-[10px] text-muted-foreground truncate">{run.provider} / {run.model}</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                {formatTokenUsage(run)}
              </div>
            </div>
            <div className="shrink-0">
              <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getRunStatusClasses(run.status)}`}>
                {formatRunStatus(run.status, t)}
              </span>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
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
          <p className="mt-2 text-xs leading-5">{t(event.message)}</p>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {formatTimestamp(event.occurredAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TruthPanelBody(props: { tab: TruthPanelTab }) {
  if (props.tab === "overview") return <TruthPanelSummary />;
  if (props.tab === "runs") return <TruthPanelRunList />;
  if (props.tab === "issues") return <ValidationIssueList />;
  return <TraceEventList />;
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

  const hasValidationIssues = (truthPanelSnapshot?.validationIssues.length ?? 0) > 0;
  const hasLogs = (truthPanelSnapshot?.events.length ?? 0) > 0;
  const defaultTab = useMemo<TruthPanelTab>(() => {
    if (runtimeErrorMessage || hasValidationIssues) return "issues";
    if (hasLogs) return "logs";
    return "runs";
  }, [hasLogs, hasValidationIssues, runtimeErrorMessage]);
  const [activeTab, setActiveTab] = useState<TruthPanelTab>(defaultTab);

  const reportStatus = latestSynthesisReport?.status ?? "idle";
  const reportStatusLabel =
    reportStatus === "idle" ? t("Waiting for analysis") : `${t("Latest result")} [${t(reportStatus).toUpperCase()}]`;

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, truthPanelSnapshot?.generatedAt]);

  if (!isTruthPanelOpen) {
    return null;
  }

  const tabs: Array<{
    id: TruthPanelTab;
    label: string;
    icon: typeof Waypoints;
    disabled?: boolean;
  }> = [
    { id: "overview", label: t("Overview"), icon: Waypoints },
    { id: "runs", label: t("Model calls"), icon: Clock3, disabled: !truthPanelSnapshot || truthPanelSnapshot.runs.length === 0 },
    { id: "issues", label: t("Output issues"), icon: AlertTriangle, disabled: !truthPanelSnapshot || truthPanelSnapshot.validationIssues.length === 0 },
    { id: "logs", label: t("Activity log"), icon: CheckCircle2, disabled: !truthPanelSnapshot || truthPanelSnapshot.events.length === 0 },
  ];

  return (
    <section className="border-t border-border/40 bg-surface-container-lowest/95 backdrop-blur">
      <div className="flex h-[280px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t("Model status")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("See which model calls ran, whether any failed, and the latest validation details.")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTruthPanel}
            className="inline-flex items-center gap-2 rounded-md border border-border/40 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {t("Hide details")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-2">
          <span className="inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider badge-neutral">
            {reportStatusLabel}
          </span>
          {truthPanelSnapshot ? (
            <span className="inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider badge-neutral">
              {t("Snapshot")} {formatTimestamp(truthPanelSnapshot.generatedAt)}
            </span>
          ) : null}
          {runtimeErrorMessage ? (
            <span className="inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider badge-error">
              {t("Runtime failure")}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-background/70 text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {runtimeErrorMessage ? (
            <div className="mb-3 rounded-lg border px-3 py-2 text-xs badge-error">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" />
                {t("Runtime failure")}
              </div>
              <p className="mt-1 leading-5">{runtimeErrorMessage}</p>
            </div>
          ) : null}

          <TruthPanelBody tab={activeTab} />
        </div>
      </div>
    </section>
  );
}
