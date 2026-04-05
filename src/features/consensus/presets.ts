import type {
  ExecutionPlan,
  JudgeMode,
  SynthesisModelSlot,
  SynthesisPreset,
  SynthesisPresetId,
} from "@/features/consensus/types";
import type {
  ModelCatalogItem,
  ModelCatalogRecord,
  SupportedProviderId,
} from "@/features/settings/providers";

export type SynthesisPresetDefinition = {
  id: SynthesisPresetId;
  label: string;
  description: string;
  providerSummary: string;
};

export type ModelSelectionState = {
  candidateModelIds: string[];
  judgeModelId: string | null;
};

const candidateSlotOrder = ["strong", "fast-1", "fast-2"] as const;

function getAllCatalogModels(modelCatalog: ModelCatalogRecord): ModelCatalogItem[] {
  return Object.values(modelCatalog).flat();
}

function findModelById(
  modelCatalog: ModelCatalogRecord,
  modelId: string | null | undefined,
): ModelCatalogItem | null {
  if (!modelId) {
    return null;
  }

  return getAllCatalogModels(modelCatalog).find((model) => model.id === modelId) ?? null;
}

function findPreferredModelForProvider(input: {
  modelCatalog: ModelCatalogRecord;
  provider: SupportedProviderId;
  preferredModelId?: string;
  excludeModelIds?: ReadonlySet<string>;
  supports: "supportsCandidate" | "supportsJudge";
}) {
  const providerModels = input.modelCatalog[input.provider] ?? [];
  const excludedIds = input.excludeModelIds ?? new Set<string>();
  const preferredMatch = input.preferredModelId
    ? providerModels.find(
        (model) =>
          model.modelId === input.preferredModelId &&
          model[input.supports] &&
          !excludedIds.has(model.id),
      ) ?? null
    : null;

  if (preferredMatch) {
    return preferredMatch;
  }

  return (
    providerModels.find((model) => model[input.supports] && !excludedIds.has(model.id)) ?? null
  );
}

function getFallbackCandidateModel(
  modelCatalog: ModelCatalogRecord,
  excludeModelIds: ReadonlySet<string>,
) {
  return (
    getAllCatalogModels(modelCatalog).find(
      (model) => model.supportsCandidate && !excludeModelIds.has(model.id),
    ) ?? null
  );
}

function getFallbackJudgeModel(
  modelCatalog: ModelCatalogRecord,
  candidateModelIds: readonly string[],
  preferredJudgeId: string | null,
) {
  const preferredJudge = findModelById(modelCatalog, preferredJudgeId);

  if (preferredJudge?.supportsJudge) {
    return preferredJudge.id;
  }

  const candidateJudge = candidateModelIds
    .map((candidateId) => findModelById(modelCatalog, candidateId))
    .find((model) => model?.supportsJudge);

  if (candidateJudge) {
    return candidateJudge.id;
  }

  return getAllCatalogModels(modelCatalog).find((model) => model.supportsJudge)?.id ?? null;
}

function buildCandidateSlots(candidateModels: readonly ModelCatalogItem[]): SynthesisModelSlot[] {
  return candidateModels.slice(0, candidateSlotOrder.length).map((model, index) => ({
    id: candidateSlotOrder[index],
    provider: model.provider,
    modelId: model.modelId,
    role: index === 0 ? "strong" : "fast",
    outputType: "candidate",
  }));
}

export const crossVendorDefaultPreset: SynthesisPreset = {
  id: "crossVendorDefault",
  slots: [
    {
      id: "strong",
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      role: "strong",
      outputType: "candidate",
    },
    {
      id: "fast-1",
      provider: "openai",
      modelId: "gpt-5-mini",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "fast-2",
      provider: "google",
      modelId: "gemini-2.5-flash",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "judge",
      provider: "openai",
      modelId: "gpt-5.2",
      role: "judge",
      outputType: "judge",
    },
  ],
};

export const freeDefaultPreset: SynthesisPreset = {
  id: "freeDefault",
  slots: [
    {
      id: "strong",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "strong",
      outputType: "candidate",
    },
    {
      id: "fast-1",
      provider: "ollama",
      modelId: "qwen3:8b",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "fast-2",
      provider: "ollama",
      modelId: "gemma3:4b",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "judge",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "judge",
      outputType: "judge",
    },
  ],
};

/** Single-model preset: no comparison, direct answer. */
export const singlePreset: SynthesisPreset = {
  id: "single",
  slots: [
    {
      id: "strong",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "strong",
      outputType: "candidate",
    },
    // Judge slot is structurally required but skipped at runtime in single mode
    {
      id: "judge",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "judge",
      outputType: "judge",
    },
  ],
};

/** Dual-model preset: two candidates, conflict resolution via auto or manual judge. */
export const dualPreset: SynthesisPreset = {
  id: "dual",
  slots: [
    {
      id: "strong",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "strong",
      outputType: "candidate",
    },
    {
      id: "fast-1",
      provider: "ollama",
      modelId: "qwen3:8b",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "judge",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "judge",
      outputType: "judge",
    },
  ],
};

export const synthesisPresetDefinitions: SynthesisPresetDefinition[] = [
  {
    id: "single",
    label: "Single",
    description: "One model answers directly. No comparison, no conflict detection.",
    providerSummary: "1 model",
  },
  {
    id: "dual",
    label: "Dual",
    description:
      "Two models run in parallel. Conflicts are shown and can be resolved automatically or manually.",
    providerSummary: "2 models",
  },
  {
    id: "freeDefault",
    label: "Free-first",
    description:
      "Use OpenRouter's free router with local Ollama candidates for the lowest-cost path.",
    providerSummary: "OpenRouter + Ollama",
  },
  {
    id: "crossVendorDefault",
    label: "Cross-vendor",
    description:
      "Use OpenAI, Anthropic, and Google together for stronger disagreement detection.",
    providerSummary: "Anthropic + OpenAI + Google",
  },
];

export const synthesisPresets: Record<SynthesisPresetId, SynthesisPreset> = {
  single: singlePreset,
  dual: dualPreset,
  crossVendorDefault: crossVendorDefaultPreset,
  freeDefault: freeDefaultPreset,
};

const synthesisPresetDefinitionMap = Object.fromEntries(
  synthesisPresetDefinitions.map((preset) => [preset.id, preset]),
) as Record<SynthesisPresetId, SynthesisPresetDefinition>;

export function getSynthesisPreset(
  presetId: SynthesisPresetId = "freeDefault",
): SynthesisPreset {
  return synthesisPresets[presetId];
}

export function buildExecutionPlanFromPreset(
  presetId: SynthesisPresetId = "freeDefault",
  conflictMode: JudgeMode = "auto",
): ExecutionPlan {
  const preset = getSynthesisPreset(presetId);
  const candidateSlots = preset.slots.filter((slot) => slot.outputType === "candidate");
  const judgeSlot =
    candidateSlots.length > 1
      ? preset.slots.find((slot) => slot.outputType === "judge") ?? null
      : null;

  return {
    version: 1,
    candidateSlots: candidateSlots.map((slot) => ({ ...slot })),
    judgeSlot: judgeSlot ? { ...judgeSlot } : null,
    conflictMode,
    source: {
      kind: "preset",
      presetId,
    },
  };
}

export function resolveModelSelectionFromPreset(
  presetId: SynthesisPresetId,
  modelCatalog: ModelCatalogRecord,
): ModelSelectionState {
  const preset = getSynthesisPreset(presetId);
  const selectedCandidateIds: string[] = [];
  const usedCandidateIds = new Set<string>();

  for (const slot of preset.slots.filter((candidateSlot) => candidateSlot.outputType === "candidate")) {
    const match = findPreferredModelForProvider({
      modelCatalog,
      provider: slot.provider,
      preferredModelId: slot.modelId,
      excludeModelIds: usedCandidateIds,
      supports: "supportsCandidate",
    });

    if (!match) {
      continue;
    }

    selectedCandidateIds.push(match.id);
    usedCandidateIds.add(match.id);
  }

  if (selectedCandidateIds.length === 0) {
    const fallbackCandidate = getFallbackCandidateModel(modelCatalog, usedCandidateIds);

    if (fallbackCandidate) {
      selectedCandidateIds.push(fallbackCandidate.id);
      usedCandidateIds.add(fallbackCandidate.id);
    }
  }

  const judgeSlot = preset.slots.find((slot) => slot.outputType === "judge");
  const judgeMatch = judgeSlot
    ? findPreferredModelForProvider({
        modelCatalog,
        provider: judgeSlot.provider,
        preferredModelId: judgeSlot.modelId,
        supports: "supportsJudge",
      })
    : null;

  return {
    candidateModelIds: selectedCandidateIds.slice(0, candidateSlotOrder.length),
    judgeModelId:
      selectedCandidateIds.length > 1
        ? getFallbackJudgeModel(modelCatalog, selectedCandidateIds, judgeMatch?.id ?? null)
        : null,
  };
}

export function normalizeModelSelection(input: {
  modelCatalog: ModelCatalogRecord;
  selection: ModelSelectionState;
  fallbackPresetId: SynthesisPresetId;
}): ModelSelectionState {
  const normalizedCandidateIds = input.selection.candidateModelIds
    .map((candidateId) => findModelById(input.modelCatalog, candidateId))
    .filter((model): model is ModelCatalogItem => model !== null && model.supportsCandidate)
    .filter((model, index, models) => models.findIndex((candidate) => candidate.id === model.id) === index)
    .slice(0, candidateSlotOrder.length)
    .map((model) => model.id);

  if (normalizedCandidateIds.length === 0) {
    return resolveModelSelectionFromPreset(input.fallbackPresetId, input.modelCatalog);
  }

  return {
    candidateModelIds: normalizedCandidateIds,
    judgeModelId:
      normalizedCandidateIds.length > 1
        ? getFallbackJudgeModel(
            input.modelCatalog,
            normalizedCandidateIds,
            input.selection.judgeModelId,
          )
        : null,
  };
}

export function buildExecutionPlanFromModelSelection(input: {
  modelCatalog: ModelCatalogRecord;
  selection: ModelSelectionState;
  conflictMode?: JudgeMode;
  label?: string | null;
}): ExecutionPlan {
  const candidateModels = input.selection.candidateModelIds
    .map((candidateId) => findModelById(input.modelCatalog, candidateId))
    .filter((model): model is ModelCatalogItem => model !== null && model.supportsCandidate)
    .slice(0, candidateSlotOrder.length);

  if (candidateModels.length === 0) {
    throw new Error("Execution plans require at least one candidate model.");
  }

  const judgeModel =
    candidateModels.length > 1
      ? findModelById(input.modelCatalog, input.selection.judgeModelId)
      : null;
  const candidateSlots = buildCandidateSlots(candidateModels);

  return {
    version: 1,
    candidateSlots,
    judgeSlot:
      candidateSlots.length > 1 && judgeModel?.supportsJudge
        ? {
            id: "judge",
            provider: judgeModel.provider,
            modelId: judgeModel.modelId,
            role: "judge",
            outputType: "judge",
          }
        : null,
    conflictMode: input.conflictMode ?? "auto",
    source: {
      kind: "custom",
      label: input.label ?? null,
    },
  };
}

export function areModelSelectionsEqual(
  left: ModelSelectionState,
  right: ModelSelectionState,
) {
  return (
    left.judgeModelId === right.judgeModelId &&
    left.candidateModelIds.length === right.candidateModelIds.length &&
    left.candidateModelIds.every((candidateId, index) => candidateId === right.candidateModelIds[index])
  );
}

export function getSynthesisPresetDefinition(
  presetId: SynthesisPresetId = "freeDefault",
): SynthesisPresetDefinition {
  return synthesisPresetDefinitionMap[presetId];
}

/** Returns the number of candidate slots in a preset. */
export function getPresetCandidateCount(presetId: SynthesisPresetId): number {
  return synthesisPresets[presetId].slots.filter((s) => s.outputType === "candidate").length;
}
