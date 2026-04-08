import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Database, PanelRight, Radio } from "lucide-react";

import { useAppStore } from "@/store";
import { toggleRuntimeDrawer } from "@/features/runtime/controller";
import type { WorkspaceController } from "@/features/workspace/controller";

function formatRunPhaseLabel(
  phase: WorkspaceController["runPhase"],
  t: (key: string) => string,
) {
  if (phase === "preflight") return t("Preflight");
  if (phase === "candidate_running") return t("Candidates running");
  if (phase === "conflicts_pending") return t("Conflicts pending");
  if (phase === "judge_running") return t("Judge running");
  if (phase === "completed") return t("Completed");
  if (phase === "failed") return t("Failed");
  return t("Idle");
}

export function BottomStatusBar() {
  const { t } = useTranslation();
  const runPhase = useAppStore((state) => state.runPhase);
  const isTruthPanelOpen = useAppStore((state) => state.isTruthPanelOpen);
  const truthPanelSnapshot = useAppStore((state) => state.truthPanelSnapshot);
  const modelCatalog = useAppStore((state) => state.modelCatalog);
  const readyModelCount = Object.values(modelCatalog)
    .flat()
    .filter((model) => model.availability === "ready").length;
  const traceCount = truthPanelSnapshot?.events.length ?? 0;
  const runCount = truthPanelSnapshot?.runSummary.totalRuns ?? 0;

  return (
    <div className="flex h-8 w-full shrink-0 items-center justify-between border-t border-border/30 bg-surface-container-lowest px-4 font-mono text-[10px] uppercase tracking-widest">
      <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3 w-3" />
          <span>{t("PGLite")}</span>
        </div>

        <button
          type="button"
          onClick={toggleRuntimeDrawer}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/70 px-2 py-1 text-primary transition-colors hover:bg-accent"
          aria-expanded={isTruthPanelOpen}
        >
          <Radio className="h-3 w-3" />
          <span>{readyModelCount > 0 ? t("Tokens Ready") : t("API Pending")}</span>
          <span className="text-muted-foreground">{readyModelCount} {t("models")}</span>
          {isTruthPanelOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <PanelRight className="h-3 w-3" />
          <span>{t("Phase")}: {formatRunPhaseLabel(runPhase, t)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleRuntimeDrawer}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/70 px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0"
      >
        <span>{t("Logs")}</span>
        <span className="font-bold">{traceCount}</span>
        <span className="text-border mx-1">|</span>
        <span>{t("Runs")}</span>
        <span className="font-bold">{runCount}</span>
      </button>
    </div>
  );
}
