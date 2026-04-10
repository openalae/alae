import { useTranslation } from "react-i18next";
import { BrainCircuit, X, Settings2, Zap, Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkspaceController } from "@/features/workspace/controller";
import type { ExecutionPlan, SynthesisModelSlot, SynthesisToggle, SynthesisPreset, PresetSlotTemplate } from "@/features/consensus";
import { useSettingsStore } from "@/store/settings";
import {
  buildCatalogItemId,
  getProviderDefinition,
  type ModelCatalogItem,
} from "@/features/settings";
import { useState, useMemo, useCallback } from "react";

/* ────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────── */

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

const candidateSlotIds = ["strong", "fast-1", "fast-2"] as const;

function buildCandidateSlot(
  index: number,
  model: Pick<ModelCatalogItem, "provider" | "modelId">,
): SynthesisModelSlot {
  return {
    id: candidateSlotIds[index],
    provider: model.provider,
    modelId: model.modelId,
    role: index === 0 ? "strong" : "fast",
    outputType: "candidate",
  } as SynthesisModelSlot;
}

function buildSynthesisSlot(model: Pick<ModelCatalogItem, "provider" | "modelId">): SynthesisModelSlot {
  return {
    id: "synthesis",
    provider: model.provider,
    modelId: model.modelId,
    role: "synthesis",
    outputType: "synthesis",
  } as SynthesisModelSlot;
}

function buildCustomPlan(input: {
  candidateSlots: readonly SynthesisModelSlot[];
  synthesisSlot: SynthesisModelSlot | null;
  synthesisMode: SynthesisToggle;
}): ExecutionPlan {
  return {
    version: 1,
    candidateSlots: input.candidateSlots,
    synthesisSlot: input.candidateSlots.length > 1 ? input.synthesisSlot : null,
    synthesisMode: input.synthesisMode,
    source: { kind: "custom", label: null },
  };
}

/* ────────────────────────────────────────────
 *  ModelSelector — reusable select for a model slot
 * ──────────────────────────────────────────── */

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

/* ────────────────────────────────────────────
 *  RecipeEditorSheet
 *
 *  Pure parameter editor.
 *  - Edits are local until the user confirms.
 *  - "Apply to Next Turn" pushes the local plan into the controller.
 *  - No re-run / fork — those are conversation-level operations.
 * ──────────────────────────────────────────── */

export type RecipeEditorSheetProps = {
  controller: WorkspaceController;
  /** If provided, we seed the editor with this historical snapshot instead of the global plan. */
  executionPlanSnapshot?: ExecutionPlan;
  onClose: () => void;
  isCompareMode?: boolean;
};

export function RecipeEditorSheet({ controller, executionPlanSnapshot, onClose, isCompareMode }: RecipeEditorSheetProps) {
  const { t } = useTranslation();

  // ── Local editable state, seeded from snapshot or global plan ──
  const seedPlan = executionPlanSnapshot ?? controller.selectedExecutionPlan;
  const [localCandidateSlots, setLocalCandidateSlots] = useState<readonly SynthesisModelSlot[]>(
    () => [...seedPlan.candidateSlots],
  );
  const [localSynthesisSlot, setLocalSynthesisSlot] = useState<SynthesisModelSlot | null>(
    () => seedPlan.synthesisSlot ?? null,
  );
  const [localSynthesisMode, setLocalSynthesisMode] = useState<SynthesisToggle>(
    () => seedPlan.synthesisMode ?? "auto",
  );

  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");

  const candidateCount = localCandidateSlots.length as 1 | 2 | 3;

  // Synthesis model options
  const currentSynthesisOption = buildCurrentSlotOption(localSynthesisSlot, controller.availableSynthesisModels);
  const synthesisOptions = useMemo(() => {
    if (!currentSynthesisOption) return controller.availableSynthesisModels;
    return controller.availableSynthesisModels.some((o) => o.id === currentSynthesisOption.id)
      ? controller.availableSynthesisModels
      : [currentSynthesisOption, ...controller.availableSynthesisModels];
  }, [currentSynthesisOption, controller.availableSynthesisModels]);

  const isCustomPresetActive = Boolean(controller.selectedPresetId?.startsWith("custom_"));

  const buildPresetFromState = (): SynthesisPreset => {
    return {
      id: "temp",
      slots: [
        ...localCandidateSlots.map((s, i) => ({
          id: candidateSlotIds[i],
          role: s.role,
          outputType: "candidate",
          provider: s.provider,
          modelId: s.modelId,
        } as PresetSlotTemplate)),
        ...(localSynthesisSlot ? [{
          id: "synthesis",
          role: "synthesis",
          outputType: "synthesis",
          provider: localSynthesisSlot.provider,
          modelId: localSynthesisSlot.modelId,
        } as PresetSlotTemplate] : [])
      ]
    };
  };

  const handleSaveAsNewStart = () => {
    setIsNamingPreset(true);
    setPresetNameInput(t("Custom Recipe"));
  };

  const handleSaveAsNewConfirm = () => {
    const name = presetNameInput.trim();
    if (!name) return;
    
    const preset = buildPresetFromState();
    useSettingsStore.getState().saveCustomPreset(name, preset);
    
    const newPresets = useSettingsStore.getState().customPresets;
    const addedPreset = newPresets[newPresets.length - 1];
    
    const plan = buildCustomPlan({
      candidateSlots: localCandidateSlots,
      synthesisSlot: localSynthesisSlot,
      synthesisMode: localSynthesisMode,
    });
    
    controller.setSelectedPresetId(addedPreset.id);
    controller.applyExecutionPlan(plan);
    onClose();
  };

  const handleUpdateCurrent = () => {
    if (!controller.selectedPresetId) return;
    
    const preset = buildPresetFromState();
    useSettingsStore.getState().updateCustomPreset(controller.selectedPresetId, preset);
    
    const plan = buildCustomPlan({
      candidateSlots: localCandidateSlots,
      synthesisSlot: localSynthesisSlot,
      synthesisMode: localSynthesisMode,
    });
    
    controller.applyExecutionPlan(plan);
    onClose();
  };

  // ── Local mutation helpers ──

  const handleSetCandidateCount = useCallback((count: 1 | 2 | 3) => {
    setLocalCandidateSlots((prev) => {
      const next = [...prev];
      while (next.length > count) next.pop();
      while (next.length < count) {
        const usedIds = new Set(next.map((s) => buildCatalogItemId(s.provider, s.modelId)));
        const fallback = controller.availableCandidateModels.find((m) => !usedIds.has(m.id));
        if (fallback) {
          next.push(buildCandidateSlot(next.length, fallback));
        } else if (controller.availableCandidateModels[0]) {
          next.push(buildCandidateSlot(next.length, controller.availableCandidateModels[0]));
        }
      }
      return next;
    });

    // Auto-assign synthesis slot when going multi-model
    if (count > 1 && !localSynthesisSlot && controller.availableSynthesisModels[0]) {
      setLocalSynthesisSlot(buildSynthesisSlot(controller.availableSynthesisModels[0]));
    }
    if (count === 1) {
      setLocalSynthesisSlot(null);
    }
  }, [controller.availableCandidateModels, controller.availableSynthesisModels, localSynthesisSlot]);

  const handleSetCandidateModel = useCallback((index: number, optionId: string) => {
    const model = controller.availableCandidateModels.find((m) => m.id === optionId);
    if (!model) return;

    setLocalCandidateSlots((prev) => {
      const next = [...prev];
      next[index] = buildCandidateSlot(index, model);
      return next;
    });
  }, [controller.availableCandidateModels]);

  const handleSetSynthesisModel = useCallback((optionId: string) => {
    const model = controller.availableSynthesisModels.find((m) => m.id === optionId);
    if (!model) return;
    setLocalSynthesisSlot(buildSynthesisSlot(model));
  }, [controller.availableSynthesisModels]);

  // ── Apply local edits to the global controller ──
  const handleApply = () => {
    const plan = buildCustomPlan({
      candidateSlots: localCandidateSlots,
      synthesisSlot: localSynthesisSlot,
      synthesisMode: localSynthesisMode,
    });
    controller.applyExecutionPlan(plan);
    onClose();
  };

  // Has the user changed anything?
  const isDirty = useMemo(() => {
    const seed = executionPlanSnapshot ?? controller.selectedExecutionPlan;
    if (localCandidateSlots.length !== seed.candidateSlots.length) return true;
    for (let i = 0; i < localCandidateSlots.length; i++) {
      const a = localCandidateSlots[i];
      const b = seed.candidateSlots[i];
      if (a.provider !== b.provider || a.modelId !== b.modelId) return true;
    }
    if (localSynthesisMode !== (seed.synthesisMode ?? "auto")) return true;
    if (localSynthesisSlot?.modelId !== (seed.synthesisSlot?.modelId)) return true;
    if (localSynthesisSlot?.provider !== (seed.synthesisSlot?.provider)) return true;
    return false;
  }, [localCandidateSlots, localSynthesisSlot, localSynthesisMode, executionPlanSnapshot, controller.selectedExecutionPlan]);

  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-md border-l border-border/40 bg-surface-container-high/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-6 py-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          {executionPlanSnapshot ? t("Turn Recipe") : t("Run Configuration")}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Candidate Models ── */}
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
                  onClick={() => handleSetCandidateCount(count as 1 | 2 | 3)}
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

          <div className="grid gap-3">
            {localCandidateSlots.map((slot, index) => {
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
                  onChange={(value) => handleSetCandidateModel(index, value)}
                />
              );
            })}
          </div>
        </div>

        {/* ── Synthesis Model ── */}
        <div className="space-y-4 border-b border-border/20 pb-6">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary/70" />
              {t("Synthesis Model")}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t("Summarizes candidate outputs and highlights agreements and differences.")}
            </p>
          </div>

          {candidateCount > 1 && localSynthesisSlot && synthesisOptions.length > 0 ? (
            <ModelSelector
              label={t("Synthesis")}
              value={buildCatalogItemId(localSynthesisSlot.provider, localSynthesisSlot.modelId)}
              options={synthesisOptions}
              onChange={handleSetSynthesisModel}
            />
          ) : (
            <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              {candidateCount === 1
                ? t("Single-model mode — synthesis is optional.")
                : t("No synthesis model configured.")}
            </div>
          )}

          {/* Synthesis mode: Auto / Manual */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{t("Synthesis Trigger")}</span>
            </div>
            <div className="flex p-0.5 rounded-lg bg-surface-container-lowest border border-border/40">
              <button
                onClick={() => setLocalSynthesisMode("auto")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  localSynthesisMode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3 w-3" />
                {t("Auto")}
              </button>
              <button
                onClick={() => setLocalSynthesisMode("manual")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  localSynthesisMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BrainCircuit className="h-3 w-3" />
                {t("Manual")}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            {localSynthesisMode === "auto"
              ? t("Synthesis runs automatically after all candidates complete.")
              : t("Candidates show first — click 'Run Synthesis' to combine them.")}
          </p>
        </div>

        {/* ── Advanced Settings (read-only preview) ── */}
        <div className="space-y-4">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("Advanced Settings")}
          </div>
          <div className="space-y-3 pl-1">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{t("Temperature")}</span>
              <span className="font-mono bg-background/50 px-2 py-1 rounded border border-border/30 text-foreground/80">0.7</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{t("Max Tokens")}</span>
              <span className="font-mono bg-background/50 px-2 py-1 rounded border border-border/30 text-foreground/80">2048</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{t("Reasoning Effort")}</span>
              <span className="font-mono bg-background/50 px-2 py-1 rounded border border-border/30 text-foreground/80">high</span>
            </div>
            <p className="text-[10px] text-muted-foreground/50 italic">{t("Editing these values requires schema support — coming soon.")}</p>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-border/30 bg-surface/50 p-4">
        {isNamingPreset ? (
          <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            <input
              type="text"
              autoFocus
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              className="flex-1 h-9 rounded-md border border-primary/50 bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
              placeholder={t("Preset Name...")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsNewConfirm();
                if (e.key === "Escape") setIsNamingPreset(false);
              }}
            />
            <Button onClick={() => setIsNamingPreset(false)} variant="outline" size="sm" className="h-9 px-3">
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveAsNewConfirm} size="sm" className="h-9 px-4 disabled:opacity-50" disabled={!presetNameInput.trim()}>
              {t("Save")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 truncate">
              <Button onClick={handleSaveAsNewStart} variant="outline" size="sm" className="h-9 gap-1.5 border-border/40 text-xs whitespace-nowrap">
                <Save className="h-3.5 w-3.5" />
                {t("Save as New")}
              </Button>
              {!executionPlanSnapshot && isCustomPresetActive && (
            <Button onClick={handleUpdateCurrent} variant="outline" size="sm" className="h-9 gap-1.5 border-primary/50 text-xs text-primary hover:text-primary whitespace-nowrap">
              <Save className="h-3.5 w-3.5" />
              {t("Update Preset")}
            </Button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
            <Button onClick={onClose} variant="ghost" size="sm" className="h-9 px-3">
              {t("Cancel")}
            </Button>
            <Button onClick={handleApply} size="sm" className="h-9 gap-2" disabled={!isDirty}>
              <Zap className="h-3.5 w-3.5" />
              {t("Apply to Next Turn")}
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
