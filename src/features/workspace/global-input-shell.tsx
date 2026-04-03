import { type KeyboardEvent, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Activity, GitFork, LoaderCircle, Play, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkspaceController } from "@/features/workspace/controller";
import { synthesisPresetDefinitions } from "@/features/consensus";
import {
  useTruthPanelState,
} from "@/features/truth-panel/controller";

function PopoverPresetPicker({ controller, onClose }: { controller: WorkspaceController, onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="absolute bottom-full mb-2 left-0 w-[400px] bg-surface-container-high/95 backdrop-blur-xl border border-border/40 shadow-2xl rounded-xl p-4 flex flex-col gap-3 pointer-events-auto origin-bottom-left animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-semibold text-sm">{t("Model Presets")}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">{t("Done")}</button>
      </div>
      <div className="grid gap-2">
        {synthesisPresetDefinitions.map((preset) => {
          const isSelected = preset.id === controller.selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={controller.isBusy}
              aria-pressed={isSelected}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-card/60 hover:bg-accent"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => controller.setSelectedPresetId(preset.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{t(preset.label)}</div>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {preset.providerSummary}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
 *  Run Status Indicator (compact, near input)
 * ───────────────────────────────────────── */
function RunStatusIndicator() {
  const { t } = useTranslation();
  const { truthPanelSnapshot } = useTruthPanelState();

  if (!truthPanelSnapshot) return null;

  const { totalRuns, completedRuns, failedRuns } = truthPanelSnapshot.runSummary;

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0">
      <Activity className="h-3 w-3 text-primary" />
      <span className="text-foreground/70">{completedRuns ?? 0}/{totalRuns ?? 0}</span>
      {failedRuns && failedRuns > 0 ? (
        <span className="text-destructive">{failedRuns} {t("Failed").toLowerCase()}</span>
      ) : null}
    </div>
  );
}

export function GlobalInputShell({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const [showPresets, setShowPresets] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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
      setShowPresets(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPresets(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="absolute bottom-0 w-full left-0 right-0 z-50 px-4 pb-3 pointer-events-none bg-gradient-to-t from-surface via-surface/90 to-transparent pt-10">
      <div className="w-full mx-auto md:max-w-[calc(100%-4rem)] bg-surface-container-low/95 backdrop-blur-xl border border-border/40 border-b-2 border-b-primary shadow-xl p-3 pointer-events-auto rounded-lg relative" ref={popoverRef}>
        
        {showPresets && <PopoverPresetPicker controller={controller} onClose={() => setShowPresets(false)} />}

        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 flex flex-col gap-1 w-full relative">
            <div className="flex items-center gap-2 pl-0.5">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {pendingSubmissionMode === "fork" ? t("Fork Branch Next Steps") : t("Logic Input Shell")}
              </label>
              <button 
                onClick={() => setShowPresets(!showPresets)}
                className="text-[10px] text-primary flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Settings2 className="h-3 w-3" />
                {t(synthesisPresetDefinitions.find(p => p.id === controller.selectedPresetId)?.label || "Preset")}
              </button>
              {/* Run Status Indicator — compact, near the input */}
              <div className="ml-auto">
                <RunStatusIndicator />
              </div>
            </div>
            <textarea
              aria-label="Question"
              className="bg-transparent border-none w-full p-1 text-sm focus:ring-0 text-foreground placeholder:text-muted-foreground font-mono resize-none outline-none overflow-y-auto"
              placeholder={t("Refine logic or branch out... Use Cmd/Ctrl+Enter to commit") as string}
              rows={1}
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              disabled={isBusy}
            ></textarea>
          </div>

          <div className="flex gap-2 shrink-0 h-[36px]">
            {isBootstrapping ? (
              <Button disabled className="h-full rounded-lg" aria-label="Restoring">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Restoring your history")}</span>
              </Button>
            ) : isRunning ? (
              <Button disabled className="h-full rounded-lg" aria-label="Running">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Running...")}</span>
              </Button>
            ) : pendingSubmissionMode === "fork" ? (
              <button
                disabled={isBusy}
                onClick={() => { void submitPrompt(); setShowPresets(false); }}
                className="bg-surface-container-high text-foreground h-full px-4 flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer border border-border/30 rounded-lg disabled:opacity-50"
              >
                <GitFork className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Branch Fork")}</span>
              </button>
             ) : (
              <button
                disabled={isBusy}
                onClick={() => { void submitPrompt(); setShowPresets(false); }}
                className="bg-primary text-primary-foreground h-full px-4 flex items-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer rounded-lg disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Commit")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
