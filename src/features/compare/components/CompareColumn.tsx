import { useTranslation } from "react-i18next";
import type { ModelRun, SynthesisReport } from "@/schema";

function formatLatency(ms: number | null) {
  if (ms === null) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/** One-line position/stance from the parsed candidate output */
function getStance(run: ModelRun): string {
  if (run.parsed?.outputType === "candidate") {
    return run.parsed.summary.replace(/\{\{\s*topic\s*\}\}/g, "");
  }
  const raw = run.rawText ?? "";
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.summary === "string") return parsed.summary;
    } catch { /* not JSON */ }
  }
  // Truncate to a sentence-length if no structured output
  const firstSentence = raw.split(/[.!?\n]/)[0]?.trim() ?? raw;
  return firstSentence.length > 200 ? firstSentence.slice(0, 180).trimEnd() + "…" : firstSentence;
}

/** Key reasoning: recommended actions as bullets, or fall back to full summary */
function getKeyReasoning(run: ModelRun): string[] {
  if (run.parsed?.outputType === "candidate" && run.parsed.recommendedActions.length > 0) {
    return run.parsed.recommendedActions.map((a) => a.replace(/\{\{\s*topic\s*\}\}/g, ""));
  }
  const text = run.parsed?.outputType === "candidate" ? run.parsed.summary : (run.rawText ?? "");
  return text.length > 0 ? [text] : [];
}

/** Extract how this run positioned itself on each conflict from the report */
function getConflictStances(run: ModelRun, report: SynthesisReport) {
  return report.conflicts
    .map((conflict) => {
      const position = conflict.positions.find((p) => p.modelRunId === run.id);
      if (!position) return null;
      return { title: conflict.title, stance: position.stance };
    })
    .filter((s): s is { title: string; stance: string } => s !== null);
}

function StatusDot(props: { status: ModelRun["status"] }) {
  const colors: Record<ModelRun["status"], string> = {
    completed: "bg-emerald-500",
    running: "bg-blue-400 animate-pulse",
    pending: "bg-muted-foreground/30",
    failed: "bg-red-500",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors[props.status]}`} />;
}

export function CompareColumn(props: {
  run: ModelRun;
  report: SynthesisReport;
  index: number;
}) {
  const { t } = useTranslation();
  const { run, report } = props;
  const latency = formatLatency(run.latencyMs);
  const stance = getStance(run);
  const keyReasoning = getKeyReasoning(run);
  const conflictStances = getConflictStances(run, report);
  const hasStructuredOutput = run.parsed?.outputType === "candidate";

  return (
    <div className="flex flex-col h-full min-w-0 rounded-xl border border-border/40 bg-card/50 overflow-hidden">

      {/* Column header — model identity only */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/25 bg-background/40 shrink-0">
        <StatusDot status={run.status} />
        <span className="flex-1 min-w-0 text-[11px] font-semibold text-foreground/90 truncate">
          {run.provider} / {run.model}
        </span>
        <div className="flex items-center gap-2.5 shrink-0 text-[10px] font-mono text-muted-foreground/50">
          {latency && <span>{latency}</span>}
          {run.usage.totalTokens !== null && <span>{run.usage.totalTokens}T</span>}
        </div>
      </div>

      {/* Body — scrollable, structured sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {run.status === "running" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            {t("Generating...")}
          </div>
        )}

        {run.status === "failed" && (
          <div className="text-sm text-red-500/80 leading-5">
            {run.error?.message ?? t("Model failed to produce output.")}
          </div>
        )}

        {run.status === "completed" && (
          <>
            {/* Section 1: Stance — one-line model position */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 mb-1.5">
                {t("Stance")}
              </div>
              <p className="text-[13px] font-medium text-foreground leading-5">
                {stance}
              </p>
            </div>

            {/* Section 2: Key Reasoning */}
            {hasStructuredOutput && keyReasoning.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55 mb-1.5">
                  {t("Key Reasoning")}
                </div>
                {keyReasoning.length === 1 ? (
                  <p className="text-xs leading-5 text-foreground/75 whitespace-pre-wrap">
                    {keyReasoning[0]}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {keyReasoning.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-5 text-foreground/75">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/40 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Section 3: On the Disagreements — this model's conflict stances (diff highlight) */}
            {conflictStances.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-600/75 dark:text-amber-400/75 mb-1.5">
                  {t("On the Disagreements")}
                </div>
                <div className="space-y-2">
                  {conflictStances.map((cs) => (
                    <div
                      key={cs.title}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                    >
                      <div className="text-[10px] font-semibold text-amber-700/75 dark:text-amber-300/75 mb-0.5 truncate">
                        {cs.title}
                      </div>
                      <p className="text-xs leading-5 text-foreground/70">
                        {cs.stance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw text fallback — only when no structured data available */}
            {!hasStructuredOutput && (
              <p className="text-xs leading-6 text-foreground/65 whitespace-pre-wrap">
                {run.rawText ?? ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
