import { useTranslation } from "react-i18next";
import { BrainCircuit, Play, GitFork, X, Settings2, Zap, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import type { WorkspaceController } from "@/features/workspace/controller";
import type { ExecutionPlan } from "@/features/consensus";
import { 
  buildCatalogItemId, 
  getProviderDefinition, 
  type ModelCatalogItem 
} from "@/features/settings";
import { useState } from "react";

function formatModelOptionLabel(model: ModelCatalogItem) {
  return `${getProviderDefinition(model.provider).label} · ${model.label}`;
}

function buildCurrentSlotOption(
  slot: { provider: ModelCatalogItem["provider"]; modelId: string } | null,
  options: ModelCatalogItem[],
) {
  if (!slot) return null;
  const optionId = buildCatalogItemId(slot.provider, slot.modelId);
  const existingOption = options.find((option) => option.id === optionId);
  if (existingOption) return existingOption;

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
  } as ModelCatalogItem;
}

function ModelSelector(props: {
  label: string;
  value: string;
  options: ModelCatalogItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
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
        disabled={props.disabled}
        className="h-9 rounded-lg border border-border/50 bg-card/80 px-3 text-xs text-foreground outline-none transition-colors hover:border-border focus:border-primary disabled:opacity-50"
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

export type RecipeEditorSheetProps = {
  controller: WorkspaceController;
  /** If provided, we are editing a historical snapshot, not the global preset. */
  executionPlanSnapshot?: ExecutionPlan;
  onClose: () => void;
  isCompareMode?: boolean;
};

export function RecipeEditorSheet({ controller, executionPlanSnapshot, onClose, isCompareMode }: RecipeEditorSheetProps) {
  const { t } = useTranslation();
  const { judgeMode, setJudgeMode } = useSettingsStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // If editing a historical snapshot, we decouple the UI from global controller state
  // We'll mock the state updates for the specific snapshot route.
  // In a real app, we'd either fork the executionPlan or dispatch to a new state.
  const isHistorical = !!executionPlanSnapshot;
  const plan = executionPlanSnapshot ?? controller.selectedExecutionPlan;
  
  const candidateSlots = plan.candidateSlots;
  const candidateCount = candidateSlots.length as 1 | 2 | 3;
  const judgeSlot = plan.judgeSlot;
  
  const currentJudgeOption = buildCurrentSlotOption(judgeSlot, controller.availableJudgeModels);
  const judgeOptions = currentJudgeOption
    ? controller.availableJudgeModels.some((option) => option.id === currentJudgeOption.id)
      ? controller.availableJudgeModels
      : [currentJudgeOption, ...controller.availableJudgeModels]
    : controller.availableJudgeModels;

  const handleApplyNextTurn = () => {
    // In a historical context, we'd take this snapshot and apply it globally.
    // For now we just close if we are not deep-copying.
    onClose();
  };
  
  const handleRerun = () => {
    onClose();
    if (isHistorical) {
      // Re-running historically would trigger similar to submitPrompt
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-md border-l border-border/40 bg-surface-container-high/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-6 py-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          {isHistorical ? t("Turn Recipe") : t("Run Configuration")}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic settings layout resembling PopoverPresetPicker */}
        <div className="space-y-4 border-b border-border/20 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("Candidate Models")}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {t("How many parallel models to invoke.")}
              </p>
            </div>
            <div className="flex rounded-lg border border-border/40 bg-surface-container-lowest p-0.5">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={isHistorical} // Historical edits should be mapped to a local state to unlock
                  onClick={() => controller.setCandidateCount(count as 1 | 2 | 3)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    candidateCount === count
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {candidateSlots.map((slot, index) => {
              const currentOption = buildCurrentSlotOption(slot, controller.availableCandidateModels);
              const options = currentOption
                ? controller.availableCandidateModels.some((o) => o.id === currentOption.id)
                  ? controller.availableCandidateModels
                  : [currentOption, ...controller.availableCandidateModels]
                : controller.availableCandidateModels;

              return (
                <ModelSelector
                  key={slot.id}
                  label={index === 0 ? t("Primary candidate") : t("Candidate {{count}}", { count: index + 1 })}
                  value={buildCatalogItemId(slot.provider, slot.modelId)}
                  options={options}
                  disabled={isHistorical}
                  onChange={(value) => controller.setCandidateModelSelection(index, value)}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-4 border-b border-border/20 pb-6">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("Resolution Judge")}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t("Runs when candidate models disagree.")}
            </p>
          </div>

          {candidateCount > 1 && judgeSlot && judgeOptions.length > 0 ? (
            <ModelSelector
              label={t("Judge")}
              value={buildCatalogItemId(judgeSlot.provider, judgeSlot.modelId)}
              options={judgeOptions}
              disabled={isHistorical}
              onChange={(value) => controller.setJudgeModelSelection(value)}
            />
          ) : (
            <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              {t("Single-model mode skips the judge.")}
            </div>
          )}

           <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{t("Conflict Resolution")}</span>
            </div>
            <div className="flex p-0.5 rounded-lg bg-surface-container-lowest border border-border/40">
               <button
                disabled={isHistorical}
                onClick={() => setJudgeMode("auto")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  judgeMode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                }`}
              >
                <Zap className="h-3 w-3" />
                {t("Auto")}
              </button>
              <button
                disabled={isHistorical}
                onClick={() => setJudgeMode("manual")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  judgeMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                }`}
              >
                <BrainCircuit className="h-3 w-3" />
                {t("Manual")}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? "▼" : "▶"} {t("Advanced Settings")}
          </button>
          
          {showAdvanced && (
             <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 pl-4 border-l border-border/20">
                <div className="space-y-2 flex justify-between items-center text-xs text-muted-foreground">
                  <span>{t("Temperature")}</span>
                  <span className="font-mono bg-background/50 px-2 py-1 rounded">0.7</span>
                </div>
                <div className="space-y-2 flex justify-between items-center text-xs text-muted-foreground">
                  <span>{t("Max Tokens")}</span>
                  <span className="font-mono bg-background/50 px-2 py-1 rounded">2048</span>
                </div>
                <div className="space-y-2 flex justify-between items-center text-xs text-muted-foreground">
                  <span>{t("Reasoning Effort")}</span>
                  <span className="font-mono bg-background/50 px-2 py-1 rounded">high</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60">{t("Not editable in this preview.")}</p>
             </div>
          )}
        </div>
      </div>
      
      <div className="shrink-0 border-t border-border/30 bg-surface/50 p-4 flex flex-col gap-2">
         {isHistorical ? (
           <>
              <Button onClick={handleRerun} className="w-full justify-start gap-2 h-9" size="sm">
                <Play className="h-4 w-4" />
                {t("Re-run Turn")}
              </Button>
              <Button onClick={() => onClose()} className="w-full justify-start gap-2 h-9 border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground" variant="outline" size="sm">
                <GitFork className="h-4 w-4" />
                {t("Fork with this Recipe")}
              </Button>
              <Button onClick={handleApplyNextTurn} className="w-full justify-start gap-2 h-9 border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground" variant="outline" size="sm">
                <Save className="h-4 w-4" />
                {t("Apply to Next Turn")}
              </Button>
           </>
         ) : (
           <Button onClick={onClose} className="w-full" size="sm">{t("Close Configuration")}</Button>
         )}
      </div>
    </div>
  );
}
