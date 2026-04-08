import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Settings2,
} from "lucide-react";

import type { SynthesisReport } from "@/schema";
import { useWorkspaceController } from "@/features/workspace/controller";
import { RecipeEditorSheet } from "@/features/recipe/components/RecipeEditorSheet";

function buildMergedText(report: SynthesisReport, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (report.resolution) {
    return [t(report.resolution.chosenApproach), t(report.resolution.summary)]
      .filter(Boolean)
      .join("\n\n");
  }
  return report.summary.replace(/\{\{\s*topic\s*\}\}/g, report.prompt);
}

export function UserMessageBubble(props: { prompt: string }) {
  return (
    <div className="flex w-full justify-end mb-6">
      <div className="flex max-w-[85%] items-start gap-3">
        <div className="bg-primary/10 text-foreground border border-primary/20 rounded-2xl rounded-tr-sm px-5 py-3.5 text-[15px] leading-relaxed relative">
          <div className="whitespace-pre-wrap">{props.prompt}</div>
        </div>
      </div>
    </div>
  );
}

export function AssistantCompactReply(props: { report: SynthesisReport; isBusy?: boolean; isRunning?: boolean }) {
  const { t } = useTranslation();
  const text = buildMergedText(props.report, t);

  return (
    <div className="flex w-full justify-start mb-6">
      <div className="flex max-w-[90%] items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0 border border-border/50">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-card/60 text-foreground border border-border/50 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 text-[15px] leading-relaxed">
          {props.isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
              <Sparkles className="w-4 h-4" />
              {t("Thinking...")}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{text}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AssistantTurnCard — the ONLY assistant card used in Chat mode for multi-model results.
 * Shows merged answer + optional inline detail expansion (consensus/conflicts/models).
 * Does NOT show massive per-model panels — those belong in Compare mode.
 */
export function AssistantTurnCard(props: {
  report: SynthesisReport;
  isRunning?: boolean;
}) {
  const { t } = useTranslation();
  const controller = useWorkspaceController();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const text = buildMergedText(props.report, t);

  const conflictCount = props.report.conflicts.length;
  const consensusCount = props.report.consensus?.items.length ?? 0;
  const candidateRuns = props.report.modelRuns.filter((r) => r.role !== "judge");
  const candidateCount = candidateRuns.length;
  // Details button is available if we have multiple models, consensus, or conflicts. Single-model no-conflict might also have details now (the underlying model output).
  const hasDetails = candidateCount > 0;

  return (
    <div className="flex w-full justify-start mb-6">
      <div className="flex max-w-[90%] items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-0">
          {/* Synthesis badge strip */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3 w-3" />
              {t("Synthesis")}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {candidateCount} {t("models")}
            </span>
            {props.report.resolution && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {t("Verified")}
              </span>
            )}
            
            <button 
              onClick={() => setRecipeOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors border border-border/30 bg-surface/50 rounded px-2 py-0.5 hover:bg-accent"
            >
              <Settings2 className="h-3 w-3" />
              {t("Recipe")}
            </button>
          </div>

          {/* Main answer bubble */}
          <div className="bg-card/60 text-foreground border border-border/50 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 text-[15px] leading-relaxed">
            {props.isRunning ? (
              <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                <Sparkles className="w-4 h-4" />
                {t("Synthesizing responses...")}
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{text}</div>
            )}
          </div>

          {/* Expandable inline details (consensus + conflicts) — no model panels */}
          {hasDetails && !props.isRunning && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {detailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {detailsOpen ? t("Hide details") : t("View synthesis details")}
              </button>

              {detailsOpen && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Summary */}
                  <div className="rounded-xl border border-border/50 bg-background/70 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                       {t("Synthesis Summary")}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground">{props.report.summary.replace(/\{\{\s*topic\s*\}\}/g, props.report.prompt)}</p>
                  </div>
                  {/* Consensus */}
                  {consensusCount > 0 && (
                    <div className="rounded-xl border border-border/50 bg-background/70 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                          {t("Consensus")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {props.report.consensus!.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-xs leading-5"
                          >
                            <div className="font-medium text-foreground">{t(item.statement)}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {t(item.kind)} · {t(item.confidence)} {t("confidence")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {conflictCount > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                          {t("Conflicts")}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {props.report.conflicts.map((conflict) => (
                          <div
                            key={conflict.id}
                            className="rounded-lg border border-amber-500/20 bg-background/60 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{t(conflict.title)}</span>
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                                {t(conflict.severity)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(conflict.summary)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Underlying Model Outputs */}
                  {candidateCount > 0 && (
                    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                        {t("Underlying Model Outputs")}
                      </div>
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        {candidateRuns.map((run) => (
                          <div key={run.id} className="rounded-lg border border-border/30 bg-background/50 p-3 flex flex-col max-h-[300px]">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/20 shrink-0">
                              <div className="w-2 h-2 rounded-full bg-primary/50" />
                              <span className="text-xs font-medium truncate">{run.provider}/{run.model}</span>
                            </div>
                            <div className="text-[11px] leading-relaxed text-muted-foreground overflow-y-auto pr-1 custom-scrollbar">
                              <div className="whitespace-pre-wrap">{run.parsed?.summary || run.rawText}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {recipeOpen && (
        <RecipeEditorSheet 
          controller={controller} 
          executionPlanSnapshot={props.report.executionPlan ?? undefined} 
          onClose={() => setRecipeOpen(false)} 
        />
      )}
    </div>
  );
}
