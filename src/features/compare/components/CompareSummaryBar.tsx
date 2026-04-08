import { AlertTriangle, CheckCircle2, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { SynthesisReport } from "@/schema";
import { useWorkspaceController } from "@/features/workspace/controller";
import { RecipeEditorSheet } from "@/features/recipe/components/RecipeEditorSheet";

/** The crux: pull the most significant conflict question, or fall back to a neutral summary. */
function getPrimaryQuestion(report: SynthesisReport): string {
  // A conflict's `question` is the clearest articulation of the disagreement
  const highSeverityConflict = report.conflicts.find((c) => c.severity === "high");
  const firstConflict = report.conflicts[0];
  const conflict = highSeverityConflict ?? firstConflict;
  if (conflict?.question) return conflict.question;

  // No conflicts — models agreed; show the approach chosen
  if (report.resolution?.chosenApproach) {
    return report.resolution.chosenApproach.replace(/\{\{\s*topic\s*\}\}/g, report.prompt);
  }
  return report.summary.replace(/\{\{\s*topic\s*\}\}/g, report.prompt);
}

export function CompareSummaryBar(props: { report: SynthesisReport }) {
  const { t } = useTranslation();
  const controller = useWorkspaceController();
  const [recipeOpen, setRecipeOpen] = useState(false);
  
  const { report } = props;
  const conflictCount = report.conflicts.length;
  const consensusCount = report.consensus?.items.length ?? 0;
  const question = getPrimaryQuestion(report);
  const hasDisagreement = conflictCount > 0;

  return (
    <div className="shrink-0 border-b border-border/20 bg-background/40 px-6 py-2.5 flex items-center gap-4 min-h-0">
      {/* Disagreement / agreement indicator */}
      <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${
        hasDisagreement ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
      }`}>
        {hasDisagreement
          ? <AlertTriangle className="h-3 w-3" />
          : <CheckCircle2 className="h-3 w-3" />
        }
        {hasDisagreement ? t("Disagree") : t("Agree")}
      </div>

      {/* Divider */}
      <div className="shrink-0 h-3 w-px bg-border/50" />

      {/* The crux — conflict question or chosen approach */}
      <p className="flex-1 min-w-0 text-xs text-foreground/80 truncate leading-5">
        {question}
      </p>

      {/* Compact counts */}
      <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-muted-foreground mr-2">
        {consensusCount > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400">
            {consensusCount} {t("agreed")}
          </span>
        )}
        {conflictCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {conflictCount} {conflictCount === 1 ? t("conflict") : t("conflicts")}
          </span>
        )}
      </div>

      {/* Recipe Editor Button */}
      <div className="shrink-0 h-3 w-px bg-border/50 mr-1" />
      <button
        onClick={() => setRecipeOpen(true)}
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/30"
        title={t("Configure Recipe")}
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      {recipeOpen && (
        <RecipeEditorSheet 
          controller={controller} 
          executionPlanSnapshot={report.executionPlan ?? undefined} 
          onClose={() => setRecipeOpen(false)} 
          isCompareMode
        />
      )}
    </div>
  );
}

