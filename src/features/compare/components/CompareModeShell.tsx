import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { WorkspaceController } from "@/features/workspace/controller";
import { BottomComposer } from "@/features/chat/components/BottomComposer";
import { CompareEmptyState } from "./CompareEmptyState";
import { CompareSummaryBar } from "./CompareSummaryBar";
import { CompareModelTabs } from "./CompareModelTabs";
import { CompareColumn } from "./CompareColumn";

export function CompareModeShell({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();

  // Pull candidate runs from the currently selected node's synthesis report.
  // Judge runs are excluded — they're an internal routing detail.
  const report =
    controller.selectedNode?.synthesisReport ??
    controller.latestSynthesisReport;

  const candidateRuns = report
    ? report.modelRuns.filter((r) => r.role !== "judge")
    : [];

  // Default: left = first, right = second
  const [rightRunId, setRightRunId] = useState<string | null>(null);

  // If we have no multi-model outputs, show empty state
  if (candidateRuns.length < 2) {
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

  const leftRun = candidateRuns[0]!;
  // Determine effective right run
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
      {report && <CompareSummaryBar report={report} />}

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
