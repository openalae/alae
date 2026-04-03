import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
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
      {truthPanelSnapshot.events.map((event) => {
        let content = t(event.message);
        if (event.message.includes("{{label}}")) {
          // Attempt to find the model info from the event scope or runs
          const runId = event.scope.includes(":") ? event.scope.split(":")[1] : null;
          const run = truthPanelSnapshot.runs.find(r => r.id.includes(runId || "none"));
          const label = run ? `${t(run.role)} (${run.provider}/${run.model})` : (runId || "Unknown");
          const provider = run?.provider || "Unknown";
          content = t(event.message, { label, provider, id: runId, message: "" });
        } else if (event.message.includes("{{provider}}")) {
          const provider = event.scope.includes(":") ? event.scope.split(":")[1] : "Unknown";
          const runId = event.scope.includes(":") ? event.scope.split(":")[1] : "Unknown";
          content = t(event.message, { provider, id: runId });
        }

        return (
          <div key={event.id} className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getEventLevelClasses(event.level)}`}>
                {event.level}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{event.scope}</span>
            </div>
            <p className="mt-2 text-xs leading-5">{content}</p>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatTimestamp(event.occurredAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SidebarAccordionSection({
  icon: Icon,
  title,
  defaultOpen = false,
  forceOpen = false,
  children,
  isEmpty = false,
}: {
  icon: any;
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen || forceOpen);
  const effectiveOpen = forceOpen || (isOpen && !isEmpty);

  return (
    <section className="space-y-2">
      <button
        onClick={() => !isEmpty && setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
          isEmpty ? "cursor-default opacity-50" : "hover:bg-accent/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
        </div>
        {!isEmpty && (
          <div className="text-muted-foreground">
            {effectiveOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </div>
        )}
      </button>
      {effectiveOpen && <div className="animate-in slide-in-from-top-1 fade-in duration-200">{children}</div>}
    </section>
  );
}

export function TruthPanel() {
  useTruthPanelAutoOpen();
  const { t } = useTranslation();
  const { developerMode } = useSettingsStore();

  const {
    isTruthPanelOpen,
    truthPanelSnapshot,
    latestSynthesisReport,
    runtimeErrorMessage,
  } = useTruthPanelState();

  const reportStatus = latestSynthesisReport?.status ?? "idle";
  const reportStatusLabel =
    reportStatus === "idle" ? t("Waiting for analysis") : `${t("Latest result")} [${t(reportStatus).toUpperCase()}]`;

  const hasValidationIssues = (truthPanelSnapshot?.validationIssues.length ?? 0) > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div 
        role="button"
        tabIndex={0}
        onClick={toggleTruthPanel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleTruthPanel();
            e.preventDefault();
          }
        }}
        className="group flex cursor-pointer items-start justify-between gap-3 rounded-t-xl border-b border-border/30 p-4 transition-colors hover:bg-accent/30"
        aria-label={isTruthPanelOpen ? t("Hide details") as string : t("Show details") as string}
        title={isTruthPanelOpen ? t("Hide details") as string : t("Show details") as string}
      >
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" />
            {t("Model status")}
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("See which model calls ran, whether any failed, and the latest validation details.")}
          </p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground">
          {isTruthPanelOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
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
            <SidebarAccordionSection
              icon={Waypoints}
              title={t("Overview")}
              defaultOpen={true}
              isEmpty={!truthPanelSnapshot}
            >
              <TruthPanelSummary />
            </SidebarAccordionSection>

            <SidebarAccordionSection
              icon={Clock3}
              title={t("Model calls")}
              defaultOpen={false}
              isEmpty={!truthPanelSnapshot || truthPanelSnapshot.runs.length === 0}
            >
              <TruthPanelRunList />
            </SidebarAccordionSection>

            <SidebarAccordionSection
              icon={AlertTriangle}
              title={t("Output issues")}
              defaultOpen={hasValidationIssues}
              forceOpen={hasValidationIssues}
              isEmpty={!truthPanelSnapshot || truthPanelSnapshot.validationIssues.length === 0}
            >
              <ValidationIssueList />
            </SidebarAccordionSection>

            {developerMode && (
              <SidebarAccordionSection
                icon={CheckCircle2}
                title={t("Activity log")}
                defaultOpen={false}
                isEmpty={!truthPanelSnapshot || truthPanelSnapshot.events.length === 0}
              >
                <TraceEventList />
              </SidebarAccordionSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
