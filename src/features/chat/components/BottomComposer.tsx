import { type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Activity, GitFork, LoaderCircle, Play, Settings2, Bot, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkspaceController } from "@/features/workspace/controller";
import { useRuntimeDrawerState } from "@/features/runtime/controller";
import type { SynthesisPresetId } from "@/features/consensus";
import { useSettingsStore } from "@/store/settings";

/* ─────────────────────────────────────────
 *  Compact Route Selector
 *
 *  Maps user-friendly labels to the underlying SynthesisPresetId:
 *   Fast       → "single"             (1 model)
 *   Balanced   → "freeDefault"         (2 free-tier models)
 *   Precise    → "dual"               (2 same-vendor models)
 *   Deep       → "crossVendorDefault" (cross-vendor multi-model)
 *
 *  When controller.selectedPresetId is null the plan is custom.
 * ───────────────────────────────────────── */

const presetOptions: { id: SynthesisPresetId; label: string }[] = [
  { id: "single", label: "Fast" },
  { id: "freeDefault", label: "Balanced" },
  { id: "dual", label: "Precise" },
  { id: "crossVendorDefault", label: "Deep" },
];

function CompactRouteSelector({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const customPresets = useSettingsStore((s) => s.customPresets);

  const selectedId = controller.selectedPresetId;
  const isCustom = selectedId === null;
  const plan = controller.selectedExecutionPlan;
  const candidateCount = plan.candidateSlots.length;

  const activeLabel = isCustom
    ? "Custom"
    : presetOptions.find((p) => p.id === selectedId)?.label ?? customPresets.find((p) => p.id === selectedId)?.label ?? "Custom";

  return (
    <div className="group relative flex items-center gap-2 cursor-default">
      <div className="relative flex items-center">
        <select
          value={isCustom ? "__custom__" : selectedId}
          onChange={(e) => {
            const value = e.target.value;
            if (value !== "__custom__") {
              controller.setSelectedPresetId(value as SynthesisPresetId);
            }
          }}
          className="h-6 appearance-none rounded-md border border-border/40 bg-surface pl-2 pr-6 text-[10px] font-medium text-foreground outline-none transition-all hover:border-primary/50 hover:bg-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          disabled={controller.isBusy}
        >
          <optgroup label={t("Presets")}>
            {presetOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{t(opt.label)}</option>
            ))}
          </optgroup>
          {customPresets.length > 0 && (
            <optgroup label={t("Custom")}>
              {customPresets.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </optgroup>
          )}
          {isCustom && <option value="__custom__">{t("Custom")}</option>}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-accent/50 transition-colors">
        <Network className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-[10px] font-mono text-muted-foreground/80 tracking-tight">
          {t(activeLabel)} · {candidateCount} {candidateCount === 1 ? t("model") : t("models")}
        </span>
      </div>

      {/* Popover Tooltip for active execution plan models */}
      <div className="absolute bottom-full mb-2 left-0 hidden group-hover:flex flex-col w-[260px] bg-background/95 backdrop-blur-xl rounded-xl border border-border/50 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
        <div className="text-[11px] font-semibold text-foreground/90 mb-2 flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span>{t("Active Engine Routing")}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {plan.candidateSlots.map((slot, i) => (
            <div key={slot.id} className="flex flex-col bg-surface-container-low rounded-md py-1.5 px-2.5 border border-border/30">
              <span className="text-muted-foreground/60 font-mono uppercase tracking-widest text-[8px] mb-0.5">{t("Candidate")} {i + 1}</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[10px] text-foreground truncate" title={slot.modelId}>{slot.modelId}</span>
                <span className="text-muted-foreground/80 text-[9px] bg-accent/40 px-1.5 rounded truncate flex-shrink-0">{slot.provider}</span>
              </div>
            </div>
          ))}
          {plan.synthesisSlot && (
            <div className="flex flex-col bg-primary/5 rounded-md py-1.5 px-2.5 border border-primary/20 mt-1">
              <span className="text-primary/70 font-mono uppercase tracking-widest text-[8px] mb-0.5">{t("Synthesis")}</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[10px] text-primary/90 truncate" title={plan.synthesisSlot.modelId}>{plan.synthesisSlot.modelId}</span>
                <span className="text-primary/70 text-[9px] bg-primary/10 px-1.5 rounded truncate flex-shrink-0">{plan.synthesisSlot.provider}</span>
              </div>
            </div>
          )}
        </div>
      </div>
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
