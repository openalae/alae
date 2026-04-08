import { type KeyboardEvent, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Activity, BrainCircuit, GitFork, LoaderCircle, Play, Settings2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildCatalogItemId,
  getProviderDefinition,
  type ModelCatalogItem,
} from "@/features/settings";
import type { WorkspaceController } from "@/features/workspace/controller";
import { synthesisPresetDefinitions } from "@/features/consensus";
import { useRuntimeDrawerState } from "@/features/runtime/controller";
import { useSettingsStore } from "@/store/settings";
import { getPresetCandidateCount } from "@/features/consensus/presets";

function CompactRouteSelector({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  
  // Custom presets mapped to the underlying options
  const presetOptions = [
    { id: "single", label: "Fast" },
    { id: "dual", label: "Balanced" },
    { id: "crossVendorDefault", label: "Deep" },
    { id: "custom", label: "Custom" },
  ];

  const value = controller.selectedPresetId ?? "custom";
  const presetDefinition = controller.selectedPresetDefinition;
  
  const candidateCount = controller.selectedExecutionPlan.candidateSlots.length;
  const toolsStatus = "tools on"; // Mocked tools status for now

  // Add the compact status label next to it: e.g. "Balanced · 2 models · tools on"
  const activeLabel = presetOptions.find(p => p.id === value)?.label ?? "Custom";

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value !== "custom") {
              controller.setSelectedPresetId(e.target.value as any);
            }
          }}
          className="h-6 appearance-none rounded border border-border/50 bg-card/80 pl-2 pr-6 text-[10px] font-medium text-foreground outline-none transition-colors hover:border-border focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={controller.isBusy}
        >
          {presetOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{t(opt.label)}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-muted-foreground">
          <Settings2 className="h-3 w-3" />
        </div>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/60 tracking-tight">
        {t("{{label}} · {{count}} models · {{tools}}", { 
          label: t(activeLabel),
          count: candidateCount,
          tools: t(toolsStatus)
        })}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────
 *  Run Strip (compact status, near input)
 * ───────────────────────────────────────── */
function RunStrip() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useRuntimeDrawerState();

  if (!truthPanelSnapshot) return null;

  const { totalRuns, completedRuns, failedRuns } = truthPanelSnapshot.runSummary;

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0 bg-background/50 px-2 py-0.5 rounded-full border border-border/40">
      <Activity className="h-3 w-3 text-primary" />
      <span className="text-foreground/70">{completedRuns ?? 0}/{totalRuns ?? 0}</span>
      {failedRuns && failedRuns > 0 ? (
        <span className="text-destructive font-bold">{failedRuns} {t("Failed").toLowerCase()}</span>
      ) : null}
    </div>
  );
}

export function BottomComposer({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  
  const {
    promptDraft,
    setPromptDraft,
    isBootstrapping,
    isRunning,
    isBusy,
    pendingSubmissionMode,
    submitPrompt,
  } = controller;

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitPrompt();
    }
  };

  return (
    <div className="w-full shrink-0 z-40 bg-surface/80 backdrop-blur-sm px-4 py-2 border-t border-border/15">
      <div className="w-full mx-auto md:max-w-[calc(100%-4rem)] bg-surface-container-low/80 border border-border/30 shadow-sm p-2 relative rounded-lg">
        
        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 flex flex-col gap-1 w-full relative">
            <div className="flex items-center gap-2 pl-0.5 mb-1">
              <label className="text-[9px] font-mono text-muted-foreground/70 uppercase tracking-widest">
                {pendingSubmissionMode === "fork" ? t("Fork Branch") : t("Message")}
              </label>
              
              <CompactRouteSelector controller={controller} />
              
              <div className="ml-auto">
                <RunStrip />
              </div>
            </div>
            <textarea
              aria-label="Question"
              className="bg-transparent border-none w-full p-1.5 text-sm focus:ring-0 text-foreground placeholder:text-muted-foreground/60 font-mono resize-none outline-none overflow-y-auto rounded-md hover:bg-accent/10 focus:bg-accent/15 min-h-[38px] max-h-[120px] transition-colors"
              placeholder={t("Refine logic or branch out... Use Cmd/Ctrl+Enter to commit") as string}
              rows={promptDraft.split("\n").length > 1 ? Math.min(promptDraft.split("\n").length, 6) : 1}
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              disabled={isBusy}
            ></textarea>
          </div>

          <div className="flex gap-2 shrink-0 h-[38px]">
            {isBootstrapping ? (
              <Button disabled className="h-full rounded-lg" aria-label="Restoring">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              </Button>
            ) : isRunning ? (
              <Button disabled className="h-full rounded-lg" aria-label="Running">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              </Button>
            ) : pendingSubmissionMode === "fork" ? (
              <button
                disabled={isBusy}
                onClick={() => { void submitPrompt(); }}
                className="bg-surface-container-high text-foreground h-full px-5 flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer border border-border/30 rounded-lg disabled:opacity-50"
              >
                <GitFork className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Fork")}</span>
              </button>
             ) : (
              <button
                disabled={isBusy}
                onClick={() => { void submitPrompt(); }}
                className="bg-primary text-primary-foreground h-full px-5 flex items-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer rounded-lg disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Send")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
