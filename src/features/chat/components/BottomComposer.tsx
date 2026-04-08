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

function formatModelOptionLabel(model: ModelCatalogItem) {
  return `${getProviderDefinition(model.provider).label} · ${model.label}`;
}

function buildCurrentSlotOption(
  slot: { provider: ModelCatalogItem["provider"]; modelId: string } | null,
  options: ModelCatalogItem[],
) {
  if (!slot) {
    return null;
  }

  const optionId = buildCatalogItemId(slot.provider, slot.modelId);
  const existingOption = options.find((option) => option.id === optionId);

  if (existingOption) {
    return existingOption;
  }

  return {
    id: optionId,
    provider: slot.provider,
    modelId: slot.modelId,
    label: `${slot.modelId} (not in catalog)`,
    sizeBytes: null,
    modifiedAt: null,
    source: "local",
    availability: "unavailable",
    supportsCandidate: true,
    supportsJudge: true,
  } satisfies ModelCatalogItem;
}

function ModelSelector(props: {
  label: string;
  value: string;
  options: ModelCatalogItem[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-9 rounded-lg border border-border/50 bg-card/80 px-3 text-xs text-foreground outline-none transition-colors hover:border-border focus:border-primary"
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {formatModelOptionLabel(option)}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-muted-foreground">
        {t("{{provider}} · {{source}}", {
          provider: getProviderDefinition(
            props.options.find((option) => option.id === props.value)?.provider ?? props.options[0]?.provider ?? "openrouter",
          ).label,
          source: props.options.find((option) => option.id === props.value)?.source ?? "local",
        })}
      </span>
    </label>
  );
}

function PopoverPresetPicker({ controller, onClose }: { controller: WorkspaceController, onClose: () => void }) {
  const { t } = useTranslation();
  const { judgeMode, setJudgeMode } = useSettingsStore();
  const candidateSlots = controller.selectedExecutionPlan.candidateSlots;
  const candidateCount = candidateSlots.length as 1 | 2 | 3;
  const judgeSlot = controller.selectedExecutionPlan.judgeSlot;
  const currentJudgeOption = buildCurrentSlotOption(judgeSlot, controller.availableJudgeModels);
  const judgeOptions = currentJudgeOption
    ? controller.availableJudgeModels.some((option) => option.id === currentJudgeOption.id)
      ? controller.availableJudgeModels
      : [currentJudgeOption, ...controller.availableJudgeModels]
    : controller.availableJudgeModels;

  return (
    <div className="absolute bottom-full mb-2 left-0 w-[min(540px,calc(100vw-2rem))] bg-surface-container-high/95 backdrop-blur-xl border border-border/40 shadow-2xl rounded-xl p-4 flex flex-col gap-4 pointer-events-auto origin-bottom-left animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-semibold text-sm">{t("Run Setup")}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">{t("Done")}</button>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("Templates")}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t("Use a template to prefill the model setup, then tweak it directly below.")}
            </p>
          </div>
        </div>

        {synthesisPresetDefinitions.map((preset) => {
          const isSelected = preset.id === controller.selectedPresetId;
          const n = getPresetCandidateCount(preset.id);
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                   <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {n}
                  </div>
                  <div className="text-sm font-semibold">{t(preset.label)}</div>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {preset.providerSummary}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-border/30 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("Candidate Models")}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t("Choose how many candidate answers run in parallel and which models fill each slot.")}
            </p>
          </div>
          <div className="flex rounded-lg border border-border/40 bg-surface-container-lowest p-0.5">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => controller.setCandidateCount(count as 1 | 2 | 3)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                  candidateCount === count
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {candidateSlots.map((slot, index) => {
            const currentOption = buildCurrentSlotOption(slot, controller.availableCandidateModels);
            const options = currentOption
              ? controller.availableCandidateModels.some((option) => option.id === currentOption.id)
                ? controller.availableCandidateModels
                : [currentOption, ...controller.availableCandidateModels]
              : controller.availableCandidateModels;

            return (
              <ModelSelector
                key={slot.id}
                label={index === 0 ? t("Primary candidate") : t("Candidate {{count}}", { count: index + 1 })}
                value={buildCatalogItemId(slot.provider, slot.modelId)}
                options={options}
                onChange={(value) => controller.setCandidateModelSelection(index, value)}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 border-t border-border/30 pt-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("Judge Model")}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {t("The judge only runs when there are at least two candidate models and a disagreement needs resolution.")}
          </p>
        </div>

        {candidateCount > 1 && judgeSlot && judgeOptions.length > 0 ? (
          <ModelSelector
            label={t("Judge")}
            value={buildCatalogItemId(judgeSlot.provider, judgeSlot.modelId)}
            options={judgeOptions}
            onChange={(value) => controller.setJudgeModelSelection(value)}
          />
        ) : (
          <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
            {t("Single-model mode skips the judge step.")}
          </div>
        )}
      </div>

      <div className="mt-1 pt-3 border-t border-border/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground">{t("Conflict Resolution")}</span>
          </div>
          <div className="flex p-0.5 rounded-lg bg-surface-container-lowest border border-border/40">
             <button
              onClick={() => setJudgeMode("auto")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                judgeMode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-3 w-3" />
              {t("Auto")}
            </button>
            <button
              onClick={() => setJudgeMode("manual")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                judgeMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BrainCircuit className="h-3 w-3" />
              {t("Manual")}
            </button>
          </div>
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
  const [showPresets, setShowPresets] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const currentTemplateLabel = controller.selectedPresetDefinition?.label ?? "Custom setup";

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
    <div className="w-full shrink-0 z-40 bg-surface/80 backdrop-blur-sm px-4 py-2 border-t border-border/15">
      <div className="w-full mx-auto md:max-w-[calc(100%-4rem)] bg-surface-container-low/80 border border-border/30 shadow-sm p-2 relative rounded-lg" ref={popoverRef}>
        
        {showPresets && <PopoverPresetPicker controller={controller} onClose={() => setShowPresets(false)} />}

        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 flex flex-col gap-1 w-full relative">
            <div className="flex items-center gap-2 pl-0.5 mb-1">
              <label className="text-[9px] font-mono text-muted-foreground/70 uppercase tracking-widest">
                {pendingSubmissionMode === "fork" ? t("Fork Branch") : t("Message")}
              </label>
              <button 
                onClick={() => setShowPresets(!showPresets)}
                className="text-[10px] text-primary flex items-center gap-1 hover:underline cursor-pointer ml-1"
              >
                <Settings2 className="h-3 w-3" />
                {t(currentTemplateLabel)}
              </button>
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
                onClick={() => { void submitPrompt(); setShowPresets(false); }}
                className="bg-surface-container-high text-foreground h-full px-5 flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer border border-border/30 rounded-lg disabled:opacity-50"
              >
                <GitFork className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-tight hidden sm:inline">{t("Fork")}</span>
              </button>
             ) : (
              <button
                disabled={isBusy}
                onClick={() => { void submitPrompt(); setShowPresets(false); }}
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
