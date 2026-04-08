import { useTranslation } from "react-i18next";
import type { ModelRun } from "@/schema";

/**
 * When there are 3+ candidate models, we show a 2-column layout
 * but let the user swap the RIGHT column to any "extra" model.
 *
 * Props:
 *   runs          – all candidate model runs (non-judge)
 *   leftRunId     – the run locked in the left column (always the first by default)
 *   rightRunId    – the run currently shown in the right column
 *   onSelectRight – called when the user switches the right column
 */
export function CompareModelTabs(props: {
  runs: ModelRun[];
  leftRunId: string;
  rightRunId: string;
  onSelectRight: (runId: string) => void;
}) {
  const { t } = useTranslation();

  if (props.runs.length <= 2) {
    // No tabs needed for exactly 2 models
    return null;
  }

  // Chips for models that CAN be shown in the right column
  // (everything except the left-locked run)
  const rightOptions = props.runs.filter((r) => r.id !== props.leftRunId);

  return (
    <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-b border-border/20 bg-background/60">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mr-1">
        {t("Right column")}
      </span>
      {rightOptions.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => props.onSelectRight(run.id)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            run.id === props.rightRunId
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/40 bg-background/70 text-muted-foreground hover:text-foreground hover:border-border/60"
          }`}
        >
          <span className="truncate max-w-[120px]">
            {run.provider}/{run.model}
          </span>
        </button>
      ))}
    </div>
  );
}
