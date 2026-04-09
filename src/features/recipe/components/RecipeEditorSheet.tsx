import { useTranslation } from "react-i18next";
import { BrainCircuit, X, Settings2, Zap, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkspaceController } from "@/features/workspace/controller";
import type { ExecutionPlan, SynthesisModelSlot, JudgeMode } from "@/features/consensus";
import {
  buildCatalogItemId,
  getProviderDefinition,
  type ModelCatalogItem,
} from "@/features/settings";
import { useState, useMemo, useCallback } from "react";

/* ────────────────────────────────────────────
 *  Helpers — shared with the old PopoverPresetPicker
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

function buildJudgeSlot(model: Pick<ModelCatalogItem, "provider" | "modelId">): SynthesisModelSlot {
  return {
    id: "judge",
    provider: model.provider,
    modelId: model.modelId,
    role: "judge",
    outputType: "judge",
  } as SynthesisModelSlot;
}

function buildCustomPlan(input: {
  candidateSlots: readonly SynthesisModelSlot[];
  judgeSlot: SynthesisModelSlot | null;
  conflictMode: JudgeMode;
}): ExecutionPlan {
  return {
    version: 1,
    candidateSlots: input.candidateSlots,
    judgeSlot: input.candidateSlots.length > 1 ? input.judgeSlot : null,
    conflictMode: input.conflictMode,
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
  const [localJudgeSlot, setLocalJudgeSlot] = useState<SynthesisModelSlot | null>(
    () => seedPlan.judgeSlot,
  );
  const [localConflictMode, setLocalConflictMode] = useState<JudgeMode>(
    () => seedPlan.conflictMode,
  );

  const candidateCount = localCandidateSlots.length as 1 | 2 | 3;

  // Judge model options
  const currentJudgeOption = buildCurrentSlotOption(localJudgeSlot, controller.availableJudgeModels);
  const judgeOptions = useMemo(() => {
    if (!currentJudgeOption) return controller.availableJudgeModels;
    return controller.availableJudgeModels.some((o) => o.id === currentJudgeOption.id)
      ? controller.availableJudgeModels
      : [currentJudgeOption, ...controller.availableJudgeModels];
  }, [currentJudgeOption, controller.availableJudgeModels]);

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

    // Ensure judge slot if going multi
    if (count > 1 && !localJudgeSlot && controller.availableJudgeModels[0]) {
      setLocalJudgeSlot(buildJudgeSlot(controller.availableJudgeModels[0]));
    }
    if (count === 1) {
      setLocalJudgeSlot(null);
    }
  }, [controller.availableCandidateModels, controller.availableJudgeModels, localJudgeSlot]);

  const handleSetCandidateModel = useCallback((index: number, optionId: string) => {
    const model = controller.availableCandidateModels.find((m) => m.id === optionId);
    if (!model) return;

    setLocalCandidateSlots((prev) => {
      const next = [...prev];
      next[index] = buildCandidateSlot(index, model);
      return next;
    });
  }, [controller.availableCandidateModels]);

  const handleSetJudgeModel = useCallback((optionId: string) => {
    const model = controller.availableJudgeModels.find((m) => m.id === optionId);
    if (!model) return;
    setLocalJudgeSlot(buildJudgeSlot(model));
  }, [controller.availableJudgeModels]);

  // ── Apply local edits to the global controller ──
  const handleApply = () => {
    const plan = buildCustomPlan({
      candidateSlots: localCandidateSlots,
      judgeSlot: localJudgeSlot,
      conflictMode: localConflictMode,
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
    if (localConflictMode !== seed.conflictMode) return true;
    if (localJudgeSlot?.modelId !== seed.judgeSlot?.modelId) return true;
    if (localJudgeSlot?.provider !== seed.judgeSlot?.provider) return true;
    return false;
  }, [localCandidateSlots, localJudgeSlot, localConflictMode, executionPlanSnapshot, controller.selectedExecutionPlan]);

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

        {/* ── Resolution Judge ── */}
        <div className="space-y-4 border-b border-border/20 pb-6">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("Resolution Judge")}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t("Runs when candidate models disagree.")}
            </p>
          </div>

          {candidateCount > 1 && localJudgeSlot && judgeOptions.length > 0 ? (
            <ModelSelector
              label={t("Judge")}
              value={buildCatalogItemId(localJudgeSlot.provider, localJudgeSlot.modelId)}
              options={judgeOptions}
              onChange={handleSetJudgeModel}
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
                onClick={() => setLocalConflictMode("auto")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  localConflictMode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3 w-3" />
                {t("Auto")}
              </button>
              <button
                onClick={() => setLocalConflictMode("manual")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  localConflictMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BrainCircuit className="h-3 w-3" />
                {t("Manual")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Advanced Settings (read-only preview for now) ── */}
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
      <div className="shrink-0 border-t border-border/30 bg-surface/50 p-4 flex items-center gap-2">
        <Button onClick={onClose} variant="outline" size="sm" className="flex-1 h-9 border-border/40">
          {t("Cancel")}
        </Button>
        <Button onClick={handleApply} size="sm" className="flex-1 h-9 gap-2" disabled={!isDirty}>
          <Save className="h-3.5 w-3.5" />
          {t("Apply to Next Turn")}
        </Button>
      </div>
    </div>
  );
}
