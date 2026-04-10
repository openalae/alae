import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GitCompare, Plus, Settings2 } from "lucide-react";

import type { WorkspaceController } from "@/features/workspace/controller";
import { BottomComposer } from "@/features/chat/components/BottomComposer";
import { CompareEmptyState } from "./CompareEmptyState";
import { CompareSummaryBar } from "./CompareSummaryBar";
import { CompareModelTabs } from "./CompareModelTabs";
import { CompareColumn } from "./CompareColumn";
import { RecipeEditorSheet } from "@/features/recipe/components/RecipeEditorSheet";

function SingleModelGuidance(props: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const [recipeOpen, setRecipeOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5">
          <Plus className="w-6 h-6 text-primary/60" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-2">
          {t("Add a second model")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground mb-4">
          {t(
            "Compare mode shows side-by-side outputs from different models. Open Recipe settings to add a second candidate model.",
          )}
        </p>
        <button
          type="button"
          onClick={() => setRecipeOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Settings2 className="h-4 w-4" />
          {t("Open Recipe Settings")}
        </button>
      </div>

      {recipeOpen && (
        <RecipeEditorSheet
          controller={props.controller}
          onClose={() => setRecipeOpen(false)}
          isCompareMode
        />
      )}
    </div>
  );
}

export function CompareModeShell({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();

  // Pull candidate runs from the currently selected node's synthesis report.
  // Judge and synthesis runs are excluded — they should not appear as comparison columns.
  const report =
    controller.selectedNode?.synthesisReport ??
    controller.latestSynthesisReport;

  const candidateRuns = report
    ? report.modelRuns.filter((r) => r.role !== "judge" && r.role !== "synthesis")
    : [];

  // Default: left = first, right = second
  const [rightRunId, setRightRunId] = useState<string | null>(null);

  // No report at all — show empty state
  if (!report || candidateRuns.length === 0) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="shrink-0 flex items-center gap-2 border-b border-border/30 px-6 py-3 bg-surface">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("Compare")}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CompareEmptyState />
        </div>
        <BottomComposer controller={controller} />
      </div>
    );
  }

  // Single model — left column shows output, right column guides adding a second model
  if (candidateRuns.length === 1) {
    return (
      <div className="flex h-full flex-col bg-surface overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 border-b border-border/30 px-6 py-3 bg-surface">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("Compare")}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            1 {t("model")}
          </span>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden p-4">
          <CompareColumn run={candidateRuns[0]!} report={report} index={0} />
          <SingleModelGuidance controller={controller} />
        </div>

        <BottomComposer controller={controller} />
      </div>
    );
  }

  // Multi-model comparison
  const leftRun = candidateRuns[0]!;
  const effectiveRightRunId = rightRunId ?? candidateRuns[1]!.id;
  const rightRun =
    candidateRuns.find((r) => r.id === effectiveRightRunId) ??
    candidateRuns[1]!;

  return (
    <div className="flex h-full flex-col bg-surface overflow-hidden">
      {/* Compare header */}
      <div className="shrink-0 flex items-center gap-2 border-b border-border/30 px-6 py-3 bg-surface">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("Compare")}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/60">
          {candidateRuns.length} {t("models")}
        </span>
      </div>

      {/* Compact synthesis summary — NOT a competing main card */}
      {report && <CompareSummaryBar report={report} controller={controller} />}

      {/* Model switcher chips — only when 3+ candidates */}
      <CompareModelTabs
        runs={candidateRuns}
        leftRunId={leftRun.id}
        rightRunId={effectiveRightRunId}
        onSelectRight={setRightRunId}
      />

      {/* Two-column diffing area */}
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden p-4">
        <CompareColumn run={leftRun} report={report!} index={0} />
        <CompareColumn run={rightRun} report={report!} index={1} />
      </div>

      {/* Composer — shared with Chat, so users can run new queries from Compare */}
      <BottomComposer controller={controller} />
    </div>
  );
}
