import type {
  ExecutionPlan,
  PresetSlotTemplate,
  SynthesisModelSlot,
  SynthesisPreset,
  SynthesisPresetId,
  SynthesisToggle,
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
  synthesisModelId: string | null;
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

function findBestModelForTemplate(input: {
  template: PresetSlotTemplate;
  modelCatalog: ModelCatalogRecord;
  usedProviders: ReadonlySet<SupportedProviderId>;
  usedModelIds: ReadonlySet<string>;
}): ModelCatalogItem | null {
  const isCandidate = input.template.outputType === "candidate";
  const allModels = getAllCatalogModels(input.modelCatalog).filter(
    (m) =>
      !input.usedModelIds.has(m.id) &&
      (isCandidate ? m.supportsCandidate : m.supportsJudge)
  );

  if (input.template.provider && input.template.modelId) {
    const specificMatch = allModels.find(
      (m) => m.provider === input.template.provider && m.modelId === input.template.modelId
    );
    if (specificMatch) {
      return specificMatch;
    }
  }

  let scoredCandidates = allModels
    .map((model) => {
      let score = 0;
      if (model.availability === "ready") score += 1000;

      if (input.template.requireTags && input.template.requireTags.length > 0) {
        if (!input.template.requireTags.every((tag) => model.tags.includes(tag))) {
          return { model, score: -1 };
        }
        score += 100;
      }

      if (input.template.excludeTags && input.template.excludeTags.length > 0) {
        if (input.template.excludeTags.some((tag) => model.tags.includes(tag))) {
          return { model, score: -1 };
        }
      }

      if (input.template.avoidUsedProviders && input.usedProviders.has(model.provider)) {
        score -= 50;
      } else if (input.template.avoidUsedProviders && !input.usedProviders.has(model.provider)) {
        score += 50;
      }

      return { model, score };
    })
    .filter((c) => c.score >= 0);

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0]?.model ?? null;
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

function getFallbackSynthesisModel(
  modelCatalog: ModelCatalogRecord,
  candidateModelIds: readonly string[],
  preferredSynthesisId: string | null,
) {
  const preferredModel = findModelById(modelCatalog, preferredSynthesisId);

  if (preferredModel?.supportsJudge) {
    return preferredModel.id;
  }

  const candidateMatch = candidateModelIds
    .map((candidateId) => findModelById(modelCatalog, candidateId))
    .find((model) => model?.supportsJudge);

  if (candidateMatch) {
    return candidateMatch.id;
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
      role: "strong",
      outputType: "candidate",
      requireTags: ["tier:smart"],
    },
    {
      id: "fast-1",
      role: "fast",
      outputType: "candidate",
      requireTags: ["tier:fast"],
      avoidUsedProviders: true,
    },
    {
      id: "fast-2",
      role: "fast",
      outputType: "candidate",
      requireTags: ["tier:fast"],
      avoidUsedProviders: true,
    },
    {
      id: "synthesis",
      role: "synthesis",
      outputType: "synthesis",
      requireTags: ["tier:smart"],
      avoidUsedProviders: true,
    },
  ],
};

export const freeDefaultPreset: SynthesisPreset = {
  id: "freeDefault",
  slots: [
    {
      id: "strong",
      role: "strong",
      outputType: "candidate",
      requireTags: ["free"],
    },
    {
      id: "fast-1",
      role: "fast",
      outputType: "candidate",
      requireTags: ["local"],
    },
    {
      id: "fast-2",
      role: "fast",
      outputType: "candidate",
      requireTags: ["local"],
    },
    {
      id: "synthesis",
      role: "synthesis",
      outputType: "synthesis",
      requireTags: ["free"],
    },
  ],
};

/** Single-model preset: no comparison, direct answer. */
export const singlePreset: SynthesisPreset = {
  id: "single",
  slots: [
    {
      id: "strong",
      role: "strong",
      outputType: "candidate",
      requireTags: ["tier:fast"],
    },
  ],
};

/** Dual-model preset: two candidates with optional synthesis. */
export const dualPreset: SynthesisPreset = {
  id: "dual",
  slots: [
    {
      id: "strong",
      role: "strong",
      outputType: "candidate",
      requireTags: ["tier:smart"],
    },
    {
      id: "fast-1",
      role: "fast",
      outputType: "candidate",
      requireTags: ["tier:fast"],
      avoidUsedProviders: true,
    },
    {
      id: "synthesis",
      role: "synthesis",
      outputType: "synthesis",
      requireTags: ["tier:smart"],
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
      "Two models run in parallel. Differences are highlighted and optionally synthesized.",
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



export function resolveModelSelectionFromPreset(
  presetId: SynthesisPresetId,
  modelCatalog: ModelCatalogRecord,
): ModelSelectionState {
  const preset = getSynthesisPreset(presetId);
  const selectedCandidateIds: string[] = [];
  const usedCandidateIds = new Set<string>();
  const usedProviders = new Set<SupportedProviderId>();

  for (const slot of preset.slots.filter((s) => s.outputType === "candidate")) {
    const match = findBestModelForTemplate({
      template: slot,
      modelCatalog,
      usedProviders,
      usedModelIds: usedCandidateIds,
    });

    if (match) {
      selectedCandidateIds.push(match.id);
      usedCandidateIds.add(match.id);
      usedProviders.add(match.provider);
    }
  }

  if (selectedCandidateIds.length === 0) {
    const fallbackCandidate = getFallbackCandidateModel(modelCatalog, usedCandidateIds);

    if (fallbackCandidate) {
      selectedCandidateIds.push(fallbackCandidate.id);
      usedCandidateIds.add(fallbackCandidate.id);
    }
  }

  const synthesisSlot = preset.slots.find((slot) => slot.outputType === "synthesis");
  const synthesisMatch = synthesisSlot
    ? findBestModelForTemplate({
        template: synthesisSlot,
        modelCatalog,
        usedProviders,
        usedModelIds: usedCandidateIds,
      })
    : null;

  return {
    candidateModelIds: selectedCandidateIds.slice(0, candidateSlotOrder.length),
    synthesisModelId:
      selectedCandidateIds.length > 1
        ? (synthesisMatch?.id ?? getFallbackSynthesisModel(modelCatalog, selectedCandidateIds, null))
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
    synthesisModelId:
      normalizedCandidateIds.length > 1
        ? getFallbackSynthesisModel(
            input.modelCatalog,
            normalizedCandidateIds,
            input.selection.synthesisModelId,
          )
        : null,
  };
}

export function buildExecutionPlanFromModelSelection(input: {
  modelCatalog: ModelCatalogRecord;
  selection: ModelSelectionState;
  synthesisMode?: SynthesisToggle;
  label?: string | null;
}): ExecutionPlan {
  const candidateModels = input.selection.candidateModelIds
    .map((candidateId) => findModelById(input.modelCatalog, candidateId))
    .filter((model): model is ModelCatalogItem => model !== null && model.supportsCandidate)
    .slice(0, candidateSlotOrder.length);

  if (candidateModels.length === 0) {
    throw new Error("Execution plans require at least one candidate model.");
  }

  const synthesisModel = findModelById(input.modelCatalog, input.selection.synthesisModelId);
  const candidateSlots = buildCandidateSlots(candidateModels);

  return {
    version: 1,
    candidateSlots,
    synthesisSlot:
      synthesisModel?.supportsJudge
        ? {
            id: "synthesis",
            provider: synthesisModel.provider,
            modelId: synthesisModel.modelId,
            role: "synthesis",
            outputType: "synthesis",
          }
        : null,
    synthesisMode: input.synthesisMode ?? "auto",
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
    left.synthesisModelId === right.synthesisModelId &&
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
