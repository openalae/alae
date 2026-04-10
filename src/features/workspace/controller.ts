import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  areModelSelectionsEqual,
  buildExecutionPlanFromModelSelection,
  getSynthesisPresetDefinition,
  createDefaultMockRegistryForExecutionPlan,
  resolveModelSelectionFromPreset,
  runSynthesis,
  runSynthesisOnly,
  type ExecutionPlan,
  type MockRegistry,
  type SynthesisModelSlot,
  type SynthesisExecutionResult,
  type SynthesisRunMode,
  type SynthesisPresetId,
  type SynthesisToggle,
} from "@/features/consensus";
import {
  createReasoningTreeRepository,
  type ReasoningTreeRepository,
} from "@/features/reasoning-tree";
import {
  clearStoredWorkspaceExecutionPlan,
  clearStoredWorkspacePresetId,
  readStoredWorkspaceExecutionPlan,
  readStoredWorkspacePresetId,
  writeStoredWorkspaceExecutionPlan,
  writeStoredWorkspacePresetId,
} from "@/features/workspace/preset-preferences";
import {
  selectLatestSynthesisReport,
  useAppStore,
  type ApiKeyStatus,
} from "@/store";
import { appStore } from "@/store/app-store";
import { useSettingsStore } from "@/store/settings";
import {
  buildCatalogItemId,
  getProviderDefinition,
  providerRequiresApiKey,
  type ModelCatalogItem,
  type SupportedProviderId,
} from "@/features/settings";
import type {
  Conversation,
  ConversationBranch,
  ConversationNode,
  ConversationSummary,
  LoadedConversation,
} from "@/schema";

export const defaultWorkspacePresetId: SynthesisPresetId = "freeDefault";
const candidateSlotIds = ["strong", "fast-1", "fast-2"] as const;

type ApiKeyStatuses = Record<string, ApiKeyStatus>;
type WorkspaceBootstrapStatus = "loading" | "ready" | "error";
type PendingSubmissionMode = "append" | "fork";
type WorkspaceHydrationOptions = {
  branchId?: string | null;
  nodeId?: string | null;
  preserveExistingResult?: boolean;
};

type WorkspacePresetProviderStatus = {
  id: SupportedProviderId;
  label: string;
  error: string | null;
};

type WorkspacePresetReadiness = {
  readyProviders: WorkspacePresetProviderStatus[];
  missingHostedProviders: WorkspacePresetProviderStatus[];
  unavailableLocalProviders: WorkspacePresetProviderStatus[];
};

type RunWorkspaceSynthesisOptions = {
  apiKeyStatuses?: ApiKeyStatuses;
  presetId?: SynthesisPresetId;
  executionPlan?: ExecutionPlan;
  synthesisMode?: SynthesisToggle;
  runSynthesisImpl?: typeof runSynthesis;
  createMockRegistry?: (executionPlan: ExecutionPlan) => MockRegistry;
};

type PersistWorkspaceNodeInput = {
  repository: ReasoningTreeRepository;
  prompt: string;
  conversationId: string;
  branchId: string;
  status: "completed" | "failed";
  createdAt: string;
  synthesisReport?: WorkspaceRunResult["report"] | null;
  truthPanelSnapshot?: WorkspaceRunResult["truthPanelSnapshot"] | null;
};

type SubmissionTarget = {
  conversationId: string;
  branchId: string;
};

export type WorkspaceRunResult = SynthesisExecutionResult & {
  effectiveMode: SynthesisRunMode;
};

type WorkspaceModelOption = ModelCatalogItem;

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;

function getTimestamp() {
  return new Date().toISOString();
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function formatForkBranchName(value: string) {
  const date = new Date(value);

  return [
    "fork-",
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
    "-",
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
    padNumber(date.getSeconds()),
  ].join("");
}

function deriveWorkspaceTitle(prompt: string) {
  const firstNonEmptyLine =
    prompt
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "Untitled run";

  if (firstNonEmptyLine.length <= 72) {
    return firstNonEmptyLine;
  }

  return `${firstNonEmptyLine.slice(0, 69).trimEnd()}...`;
}

function sortBranches(branches: ConversationBranch[]) {
  return [...branches].sort((left, right) => {
    if (left.name === "main" && right.name !== "main") {
      return -1;
    }

    if (right.name === "main" && left.name !== "main") {
      return 1;
    }

    const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);

    if (updatedAtOrder !== 0) {
      return updatedAtOrder;
    }

    return right.id.localeCompare(left.id);
  });
}

function getPreferredBranch(loadedConversation: LoadedConversation) {
  return sortBranches(loadedConversation.branches)[0] ?? null;
}

function getBranchById(loadedConversation: LoadedConversation, branchId: string | null | undefined) {
  if (!branchId) {
    return null;
  }

  return loadedConversation.branches.find((branch) => branch.id === branchId) ?? null;
}

function getNodeById(loadedConversation: LoadedConversation, nodeId: string | null | undefined) {
  if (!nodeId) {
    return null;
  }

  return loadedConversation.nodes.find((node) => node.id === nodeId) ?? null;
}

function getHeadNode(
  loadedConversation: LoadedConversation,
  branch: ConversationBranch | null,
) {
  if (!branch?.headNodeId) {
    return null;
  }

  return getNodeById(loadedConversation, branch.headNodeId);
}

function getPendingSubmissionMode(
  branch: ConversationBranch | null,
  node: ConversationNode | null,
): PendingSubmissionMode {
  if (!branch || branch.headNodeId === null || !node) {
    return "append";
  }

  return node.id === branch.headNodeId ? "append" : "fork";
}

function getBranchNodes(
  loadedConversation: LoadedConversation,
  branch: ConversationBranch | null,
) {
  if (!branch) {
    return [];
  }

  return loadedConversation.nodes
    .filter((node) => node.branchId === branch.id)
    .sort((left, right) => {
      const createdAtOrder = left.createdAt.localeCompare(right.createdAt);

      if (createdAtOrder !== 0) {
        return createdAtOrder;
      }

      return left.id.localeCompare(right.id);
    });
}

function clearWorkspaceResults() {
  const state = appStore.getState();
  state.resetWorkspace();
  state.clearTruthPanelSnapshot();
}

function hydrateWorkspaceStateFromConversation(
  loadedConversation: LoadedConversation,
  options: WorkspaceHydrationOptions = {},
) {
  const { branchId = null, nodeId = null, preserveExistingResult = false } = options;
  const state = appStore.getState();
  const branch =
    getBranchById(loadedConversation, branchId) ?? getPreferredBranch(loadedConversation);
  const node =
    getNodeById(loadedConversation, nodeId) ??
    getHeadNode(loadedConversation, branch);

  state.setActivePath({
    currentConversationId: loadedConversation.conversation.id,
    currentBranchId: branch?.id ?? null,
    currentNodeId: node?.id ?? null,
  });

  if (node?.synthesisReport) {
    state.setLatestSynthesisReport(node.synthesisReport);
  } else if (!preserveExistingResult) {
    state.clearLatestSynthesisReport();
  }

  if (node?.truthPanelSnapshot) {
    state.setTruthPanelSnapshot(node.truthPanelSnapshot);
  } else if (!preserveExistingResult) {
    state.clearTruthPanelSnapshot();
  }

  return {
    branch,
    node,
  };
}

async function persistWorkspaceNode(input: PersistWorkspaceNodeInput) {
  await input.repository.appendNode({
    conversationId: input.conversationId,
    branchId: input.branchId,
    title: deriveWorkspaceTitle(input.prompt),
    prompt: input.prompt,
    status: input.status,
    synthesisReport: input.synthesisReport ?? null,
    truthPanelSnapshot: input.truthPanelSnapshot ?? null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });

  const loadedConversation = await input.repository.loadConversation(input.conversationId);

  if (loadedConversation === null) {
    throw new Error(
      `Conversation ${input.conversationId} could not be reloaded after persistence.`,
    );
  }

  return loadedConversation;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Workspace synthesis failed unexpectedly.";
}

function flattenModelCatalog(modelCatalog: Record<SupportedProviderId, ModelCatalogItem[]>) {
  return Object.values(modelCatalog).flat();
}

function getSlotSelectionId(slot: Pick<SynthesisModelSlot, "provider" | "modelId">) {
  return buildCatalogItemId(slot.provider, slot.modelId);
}

function buildCandidateSlot(
  index: number,
  model: Pick<ModelCatalogItem, "provider" | "modelId">,
) {
  return {
    id: candidateSlotIds[index],
    provider: model.provider,
    modelId: model.modelId,
    role: index === 0 ? "strong" : "fast",
    outputType: "candidate",
  } satisfies SynthesisModelSlot;
}

function buildSynthesisSlot(model: Pick<ModelCatalogItem, "provider" | "modelId">) {
  return {
    id: "synthesis",
    provider: model.provider,
    modelId: model.modelId,
    role: "synthesis",
    outputType: "synthesis",
  } satisfies SynthesisModelSlot;
}

function buildCustomExecutionPlan(input: {
  candidateSlots: readonly SynthesisModelSlot[];
  synthesisSlot: SynthesisModelSlot | null;
  synthesisMode: SynthesisToggle;
}): ExecutionPlan {
  return {
    version: 1,
    candidateSlots: input.candidateSlots,
    synthesisSlot: input.synthesisSlot,
    synthesisMode: input.synthesisMode,
    source: {
      kind: "custom",
      label: null,
    },
  };
}

function findModelOptionById(
  options: readonly WorkspaceModelOption[],
  optionId: string,
) {
  return options.find((option) => option.id === optionId) ?? null;
}

function ensureOptionForSlot(
  options: readonly WorkspaceModelOption[],
  slot: SynthesisModelSlot | null,
) {
  if (!slot) {
    return null;
  }

  return (
    findModelOptionById(options, getSlotSelectionId(slot)) ?? {
      id: getSlotSelectionId(slot),
      provider: slot.provider,
      modelId: slot.modelId,
      label: slot.modelId,
      sizeBytes: null,
      modifiedAt: null,
      source: "local",
      availability: "unavailable",
      supportsCandidate: slot.outputType === "candidate",
      supportsJudge: slot.outputType === "synthesis" || slot.outputType === "judge",
    }
  );
}

function buildTemplateExecutionPlan(
  presetId: SynthesisPresetId,
  modelCatalog: Record<SupportedProviderId, ModelCatalogItem[]>,
  synthesisMode: SynthesisToggle,
) {
  if (presetId.startsWith("custom_")) {
    const customPresets = useSettingsStore.getState().customPresets;
    const customPresetDef = customPresets.find((p) => p.id === presetId);
    if (customPresetDef) {
      const selection = resolveModelSelectionFromPreset(customPresetDef.preset, modelCatalog);
      return buildExecutionPlanFromModelSelection({
        modelCatalog,
        selection,
        synthesisMode,
        label: customPresetDef.label,
      });
    }
  }

  const selection = resolveModelSelectionFromPreset(presetId, modelCatalog);
  return buildExecutionPlanFromModelSelection({
    modelCatalog,
    selection,
    synthesisMode,
    label: getSynthesisPresetDefinition(presetId).label,
  });
}

export function resolveWorkspaceRunMode(
  apiKeyStatuses: ApiKeyStatuses,
  executionPlan: ExecutionPlan,
): SynthesisRunMode {
  const requiredProviders = new Set([
    ...executionPlan.candidateSlots.map((slot) => slot.provider),
    ...(executionPlan.synthesisSlot ? [executionPlan.synthesisSlot.provider] : []),
  ]);

  for (const provider of requiredProviders) {
    if (providerRequiresApiKey(provider) && !apiKeyStatuses[provider]?.configured) {
      return "mock";
    }
  }

  return "real";
}

function getWorkspacePresetReadiness(
  apiKeyStatuses: ApiKeyStatuses,
  executionPlan: ExecutionPlan,
): WorkspacePresetReadiness {
  const providerIds = [
    ...new Set([
      ...executionPlan.candidateSlots.map((slot) => slot.provider),
      ...(executionPlan.synthesisSlot ? [executionPlan.synthesisSlot.provider] : []),
    ]),
  ];

  return providerIds.reduce<WorkspacePresetReadiness>(
    (readiness, providerId) => {
      const definition = getProviderDefinition(providerId);
      const providerStatus = apiKeyStatuses[providerId];
      const descriptor = {
        id: providerId,
        label: definition.label,
        error: providerStatus?.error ?? null,
      } satisfies WorkspacePresetProviderStatus;

      if (providerStatus?.configured) {
        readiness.readyProviders.push(descriptor);
      } else if (providerRequiresApiKey(providerId)) {
        readiness.missingHostedProviders.push(descriptor);
      } else {
        readiness.unavailableLocalProviders.push(descriptor);
      }

      return readiness;
    },
    {
      readyProviders: [],
      missingHostedProviders: [],
      unavailableLocalProviders: [],
    },
  );
}

export async function runWorkspaceSynthesis(
  prompt: string,
  options: RunWorkspaceSynthesisOptions & { language?: string } = {},
): Promise<WorkspaceRunResult> {
  const presetId = options.presetId ?? defaultWorkspacePresetId;
  const executionPlan =
    options.executionPlan ?? buildTemplateExecutionPlan(presetId, appStore.getState().modelCatalog, options.synthesisMode ?? "auto");
  const sourcePresetId =
    executionPlan.source.kind === "preset"
      ? (executionPlan.source.presetId as SynthesisPresetId)
      : presetId;
  const apiKeyStatuses = options.apiKeyStatuses ?? appStore.getState().apiKeyStatuses;
  const effectiveMode = resolveWorkspaceRunMode(apiKeyStatuses, executionPlan);
  const runSynthesisImpl = options.runSynthesisImpl ?? runSynthesis;
  const mockRegistryFactory =
    options.createMockRegistry ?? createDefaultMockRegistryForExecutionPlan;

  const result =
    effectiveMode === "mock"
      ? await runSynthesisImpl(
          {
            prompt,
            mode: "mock",
            presetId: sourcePresetId,
            executionPlan,
            synthesisMode: options.synthesisMode,
            language: options.language,
          },
          {
            mockRegistry: mockRegistryFactory(executionPlan),
          },
        )
      : await runSynthesisImpl({
          prompt,
          mode: "real",
          presetId: sourcePresetId,
          executionPlan,
          synthesisMode: options.synthesisMode,
          language: options.language,
        });

  return {
    effectiveMode,
    report: result.report,
    truthPanelSnapshot: result.truthPanelSnapshot,
  };
}

export function useWorkspaceController() {
  const { t, i18n } = useTranslation();
  const currentBranchId = useAppStore((state) => state.currentBranchId);
  const currentNodeId = useAppStore((state) => state.currentNodeId);
  const apiKeyStatuses = useAppStore((state) => state.apiKeyStatuses);
  const modelCatalog = useAppStore((state) => state.modelCatalog);
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const runStatus = useAppStore((state) => state.runStatus);
  const runPhase = useAppStore((state) => state.runPhase);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);
  const repositoryRef = useRef<ReasoningTreeRepository | null>(null);
  const { synthesisMode, defaultPresetId } = useSettingsStore();

  if (repositoryRef.current === null) {
    repositoryRef.current = createReasoningTreeRepository();
  }

  const repository = repositoryRef.current;
  const [loadedConversation, setLoadedConversation] = useState<LoadedConversation | null>(null);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);
  const [promptDraft, setPromptDraft] = useState("");
  const [inputErrorMessage, setInputErrorMessage] = useState<string | null>(null);
  const [bootstrapErrorMessage, setBootstrapErrorMessage] = useState<string | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<WorkspaceBootstrapStatus>("loading");
  const [lastExecutionMode, setLastExecutionMode] = useState<SynthesisRunMode | null>(null);
  const storedExecutionPlan = readStoredWorkspaceExecutionPlan();
  const initialPresetId = readStoredWorkspacePresetId() ?? defaultPresetId ?? defaultWorkspacePresetId;
  const [selectedPresetId, setSelectedPresetId] = useState<SynthesisPresetId | null>(
    storedExecutionPlan ? null : initialPresetId,
  );
  const [selectedExecutionPlan, setSelectedExecutionPlan] = useState<ExecutionPlan>(() =>
    storedExecutionPlan ?? buildTemplateExecutionPlan(initialPresetId, modelCatalog, synthesisMode),
  );
  const selectedPresetDefinition = selectedPresetId
    ? getSynthesisPresetDefinition(selectedPresetId)
    : null;
  const selectedPresetReadiness = getWorkspacePresetReadiness(apiKeyStatuses, selectedExecutionPlan);
  const effectiveMode = resolveWorkspaceRunMode(apiKeyStatuses, selectedExecutionPlan);
  const displayMode = latestSynthesisReport ? (lastExecutionMode ?? effectiveMode) : effectiveMode;
  const isRunning = runStatus === "running";
  const isBootstrapping = bootstrapStatus === "loading";
  const isBusy = isRunning || isBootstrapping;
  const selectedConversation: Conversation | null = loadedConversation?.conversation ?? null;
  const selectedBranch =
    loadedConversation === null ? null : getBranchById(loadedConversation, currentBranchId);
  const selectedNode =
    loadedConversation === null ? null : getNodeById(loadedConversation, currentNodeId);
  const outlineNodes =
    loadedConversation === null ? [] : getBranchNodes(loadedConversation, selectedBranch);
  const selectedNodeIsHead =
    selectedBranch !== null &&
    selectedNode !== null &&
    selectedBranch.headNodeId === selectedNode.id;
  const pendingSubmissionMode = getPendingSubmissionMode(selectedBranch, selectedNode);
  const availableCandidateModels = flattenModelCatalog(modelCatalog).filter(
    (model) => model.supportsCandidate,
  );
  const availableSynthesisModels = flattenModelCatalog(modelCatalog).filter(
    (model) => model.supportsJudge,
  );

  const applyPresetTemplate = (presetId: SynthesisPresetId) => {
    setSelectedPresetId(presetId);
    setSelectedExecutionPlan(buildTemplateExecutionPlan(presetId, modelCatalog, synthesisMode));
  };

  const setCandidateCount = (count: 1 | 2 | 3) => {
    const fallbackPlan = buildTemplateExecutionPlan(defaultWorkspacePresetId, modelCatalog, synthesisMode);

    setSelectedPresetId(null);
    setSelectedExecutionPlan((currentPlan) => {
      const nextCandidateSlots = [...currentPlan.candidateSlots];

      while (nextCandidateSlots.length > count) {
        nextCandidateSlots.pop();
      }

      while (nextCandidateSlots.length < count) {
        const nextIndex = nextCandidateSlots.length;
        const usedIds = new Set(nextCandidateSlots.map((slot) => getSlotSelectionId(slot)));
        const candidateModel =
          availableCandidateModels.find((model) => !usedIds.has(model.id)) ?? null;

        nextCandidateSlots.push(
          candidateModel
            ? buildCandidateSlot(nextIndex, candidateModel)
            : (fallbackPlan.candidateSlots[nextIndex] ?? fallbackPlan.candidateSlots[0])!,
        );
      }

      // When adding >1 candidates and no synthesis slot, auto-assign one
      const synthOption =
        ensureOptionForSlot(availableSynthesisModels, currentPlan.synthesisSlot) ??
        availableSynthesisModels[0] ??
        ensureOptionForSlot(availableSynthesisModels, fallbackPlan.synthesisSlot);

      return buildCustomExecutionPlan({
        candidateSlots: nextCandidateSlots,
        synthesisSlot: count > 1 && synthOption ? buildSynthesisSlot(synthOption) : null,
        synthesisMode,
      });
    });
  };

  const setCandidateModelSelection = (index: number, optionId: string) => {
    const nextModel = findModelOptionById(availableCandidateModels, optionId);

    if (!nextModel) {
      return;
    }

    setSelectedPresetId(null);
    setSelectedExecutionPlan((currentPlan) => {
      const nextCandidateSlots = [...currentPlan.candidateSlots];
      const duplicateIndex = nextCandidateSlots.findIndex(
        (slot, slotIndex) => slotIndex !== index && getSlotSelectionId(slot) === optionId,
      );

      if (duplicateIndex >= 0) {
        const previousSlot = nextCandidateSlots[index];

        if (!previousSlot) {
          return currentPlan;
        }

        nextCandidateSlots[index] = nextCandidateSlots[duplicateIndex];
        nextCandidateSlots[duplicateIndex] = previousSlot;
      } else {
        nextCandidateSlots[index] = buildCandidateSlot(index, nextModel);
      }

      // When >1 candidates, auto-assign synthesis if missing
      const synthOption =
        ensureOptionForSlot(availableSynthesisModels, currentPlan.synthesisSlot) ??
        availableSynthesisModels[0];

      return buildCustomExecutionPlan({
        candidateSlots: nextCandidateSlots,
        synthesisSlot:
          nextCandidateSlots.length > 1
            ? currentPlan.synthesisSlot ??
              (synthOption ? buildSynthesisSlot(synthOption) : null)
            : null,
        synthesisMode,
      });
    });
  };

  const setSynthesisModelSelection = (optionId: string) => {
    const nextModel = findModelOptionById(availableSynthesisModels, optionId);

    if (!nextModel) {
      return;
    }

    setSelectedPresetId(null);
    setSelectedExecutionPlan((currentPlan) =>
      buildCustomExecutionPlan({
        candidateSlots: currentPlan.candidateSlots,
        synthesisSlot: buildSynthesisSlot(nextModel),
        synthesisMode,
      }),
    );
  };

  const refreshExplorer = async () => {
    const summaries = await repository.listConversations();
    setConversationSummaries(summaries);
  };

  const reloadConversation = async (
    conversationId: string,
    options: WorkspaceHydrationOptions = {},
  ) => {
    const nextConversation = await repository.loadConversation(conversationId);

    if (nextConversation === null) {
      throw new Error(`Conversation ${conversationId} could not be loaded.`);
    }

    setLoadedConversation(nextConversation);
    const selection = hydrateWorkspaceStateFromConversation(nextConversation, options);
    appStore.getState().resetRuntime();

    return {
      conversation: nextConversation,
      ...selection,
    };
  };

  const ensureSubmissionTarget = async (
    prompt: string,
    timestamp: string,
  ): Promise<SubmissionTarget> => {
    let conversation = loadedConversation;

    if (conversation === null) {
      conversation = await repository.createConversation({
        title: deriveWorkspaceTitle(prompt),
        createdAt: timestamp,
      });
    }

    const conversationId = conversation.conversation.id;
    const branch = getBranchById(conversation, currentBranchId) ?? getPreferredBranch(conversation);

    if (!branch) {
      throw new Error("The selected conversation does not have a branch available for submission.");
    }

    if (branch.headNodeId === null || currentNodeId === null || currentNodeId === branch.headNodeId) {
      return {
        conversationId,
        branchId: branch.id,
      };
    }

    const forkBranch = await repository.forkNode({
      conversationId,
      sourceNodeId: currentNodeId,
      name: formatForkBranchName(timestamp),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      conversationId,
      branchId: forkBranch.id,
    };
  };

  const selectConversation = async (conversationId: string) => {
    try {
      setBootstrapErrorMessage(null);
      setLastExecutionMode(null);
      await reloadConversation(conversationId);
    } catch (error) {
      setBootstrapErrorMessage(`Unable to load conversation. ${getErrorMessage(error)}`);
    }
  };

  const startNewConversation = () => {
    setLoadedConversation(null);
    setPromptDraft("");
    setLastExecutionMode(null);
    setInputErrorMessage(null);
    setBootstrapErrorMessage(null);
    clearWorkspaceResults();
    appStore.getState().resetRuntime();
    appStore.getState().setActivePath({
      currentConversationId: null,
      currentBranchId: null,
      currentNodeId: null,
    });
  };

  const selectBranch = async (branchId: string) => {
    if (!loadedConversation) {
      return;
    }

    setBootstrapErrorMessage(null);
    setLastExecutionMode(null);
    hydrateWorkspaceStateFromConversation(loadedConversation, { branchId });
    appStore.getState().resetRuntime();
  };

  const selectNode = async (nodeId: string) => {
    if (!loadedConversation) {
      return;
    }

    const node = getNodeById(loadedConversation, nodeId);

    if (!node) {
      return;
    }

    setBootstrapErrorMessage(null);
    setLastExecutionMode(null);
    hydrateWorkspaceStateFromConversation(loadedConversation, {
      branchId: node.branchId,
      nodeId,
    });
    appStore.getState().resetRuntime();
  };

  const forkSelectedNode = async () => {
    if (!loadedConversation || !selectedNode) {
      return;
    }

    const timestamp = getTimestamp();

    try {
      setBootstrapErrorMessage(null);
      setLastExecutionMode(null);

      const forkBranch = await repository.forkNode({
        conversationId: loadedConversation.conversation.id,
        sourceNodeId: selectedNode.id,
        name: formatForkBranchName(timestamp),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      await reloadConversation(loadedConversation.conversation.id, {
        branchId: forkBranch.id,
        nodeId: forkBranch.headNodeId,
      });
      await refreshExplorer();
    } catch (error) {
      setBootstrapErrorMessage(`Unable to fork from the selected node. ${getErrorMessage(error)}`);
    }
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [summaries, latestConversation] = await Promise.all([
          repository.listConversations(),
          repository.loadLatestConversation(),
        ]);

        if (!active) {
          return;
        }

        setConversationSummaries(summaries);

        if (latestConversation === null) {
          setLoadedConversation(null);
          clearWorkspaceResults();
        } else {
          setLoadedConversation(latestConversation);
          hydrateWorkspaceStateFromConversation(latestConversation);
        }

        appStore.getState().resetRuntime();
        setBootstrapErrorMessage(null);
        setBootstrapStatus("ready");
        setLastExecutionMode(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadedConversation(null);
        appStore.getState().resetRuntime();
        setBootstrapErrorMessage(
          `Unable to restore the latest local conversation. ${getErrorMessage(error)}`,
        );
        setBootstrapStatus("error");
      }
    })();

    return () => {
      active = false;
      void repository.close().catch(() => undefined);
    };
  }, [repository]);

  useEffect(() => {
    if (selectedPresetId) {
      writeStoredWorkspacePresetId(selectedPresetId);
      clearStoredWorkspaceExecutionPlan();
      return;
    }

    clearStoredWorkspacePresetId();
    writeStoredWorkspaceExecutionPlan(selectedExecutionPlan);
  }, [selectedExecutionPlan, selectedPresetId]);

  useEffect(() => {
    if (selectedPresetId) {
      setSelectedExecutionPlan(buildTemplateExecutionPlan(selectedPresetId, modelCatalog, synthesisMode));
      return;
    }

    setSelectedExecutionPlan((currentPlan) => ({
      ...currentPlan,
      synthesisMode,
    }));
  }, [synthesisMode, modelCatalog, selectedPresetId]);

  const submitPrompt = async () => {
    const trimmedPrompt = promptDraft.trim();

    if (isBusy) {
      return;
    }

    if (!trimmedPrompt) {
      setInputErrorMessage(t("Enter a question before starting analysis."));
      return;
    }

    const state = appStore.getState();
    const submissionTimestamp = getTimestamp();
    let target: SubmissionTarget | null = null;

    setInputErrorMessage(null);
    setBootstrapErrorMessage(null);
    state.beginRun("preflight");

    try {
      target = await ensureSubmissionTarget(trimmedPrompt, submissionTimestamp);
      state.setRunPhase("candidate_running");

      const result = await runWorkspaceSynthesis(trimmedPrompt, {
        apiKeyStatuses,
        presetId: selectedPresetId ?? defaultWorkspacePresetId,
        executionPlan: selectedExecutionPlan,
        synthesisMode,
        language: i18n.language,
      });

      const persistedConversation = await persistWorkspaceNode({
        repository,
        prompt: trimmedPrompt,
        conversationId: target.conversationId,
        branchId: target.branchId,
        status: "completed",
        synthesisReport: result.report,
        truthPanelSnapshot: result.truthPanelSnapshot,
        createdAt: result.report.createdAt,
      });

      setLoadedConversation(persistedConversation);
      hydrateWorkspaceStateFromConversation(persistedConversation, {
        branchId: target.branchId,
      });
      state.completeRun(result.report);
      setLastExecutionMode(result.effectiveMode);
      await refreshExplorer();
    } catch (error) {
      let failureMessage = getErrorMessage(error);

      if (target !== null) {
        try {
          const failedConversation = await persistWorkspaceNode({
            repository,
            prompt: trimmedPrompt,
            conversationId: target.conversationId,
            branchId: target.branchId,
            status: "failed",
            createdAt: getTimestamp(),
          });

          setLoadedConversation(failedConversation);
          hydrateWorkspaceStateFromConversation(failedConversation, {
            branchId: target.branchId,
            preserveExistingResult: true,
          });
          await refreshExplorer();
        } catch (persistenceError) {
          failureMessage = `${failureMessage} Local persistence also failed: ${getErrorMessage(persistenceError)}`;
        }
      }

      state.failRun(failureMessage);
    }
  };

  /** Manual synthesis trigger: re-run only the synthesis step on existing candidate runs. */
  const runManualSynthesis = async () => {
    if (isBusy || !latestSynthesisReport || latestSynthesisReport.reportStage !== "awaiting_synthesis") {
      return;
    }

    const candidateRuns = latestSynthesisReport.modelRuns.filter(
      (r) => r.role !== "judge" && r.role !== "synthesis",
    );
    if (candidateRuns.length === 0) return;

    const state = appStore.getState();
    state.beginRun("synthesis_running" as never);

    try {
      const executionPlan =
        (latestSynthesisReport.executionPlan as ExecutionPlan | null) ??
        selectedExecutionPlan;
      const planPresetId =
        executionPlan.source.kind === "preset"
          ? (executionPlan.source.presetId as SynthesisPresetId)
          : selectedPresetId ?? defaultWorkspacePresetId;
      const apiKeyStatusesCurrent = appStore.getState().apiKeyStatuses;
      const mode = resolveWorkspaceRunMode(apiKeyStatusesCurrent, executionPlan);

      const result = await runSynthesisOnly(
        {
          prompt: latestSynthesisReport.prompt,
          mode,
          candidateRuns,
          presetId: planPresetId,
          executionPlan,
          language: i18n.language,
        },
        mode === "mock"
          ? { mockRegistry: createDefaultMockRegistryForExecutionPlan(executionPlan) }
          : {},
      );

      state.completeRun(result.report);
      state.setTruthPanelSnapshot(result.truthPanelSnapshot);

      const { currentNodeId, currentConversationId, currentBranchId } = state;

      if (currentNodeId && currentConversationId && currentBranchId) {
        await repository.updateNode({
          id: currentNodeId,
          status: result.report.status === "failed" ? "failed" : "completed",
          synthesisReport: result.report,
          truthPanelSnapshot: result.truthPanelSnapshot,
        });

        const fresh = await repository.loadConversation(currentConversationId);
        if (fresh) {
          setLoadedConversation(fresh);
          hydrateWorkspaceStateFromConversation(fresh, {
            branchId: currentBranchId,
            nodeId: currentNodeId,
            preserveExistingResult: true,
          });
        }
      }
    } catch (error) {
      state.failRun(getErrorMessage(error));
    }
  };

  const updatePromptDraft = (value: string) => {
    setPromptDraft(value);

    if (inputErrorMessage) {
      setInputErrorMessage(null);
    }
  };

  /** Accept a complete ExecutionPlan from an external source (e.g. RecipeEditorSheet). */
  const applyExecutionPlan = (plan: ExecutionPlan) => {
    setSelectedPresetId(null);
    setSelectedExecutionPlan(plan);
  };

  return {
    promptDraft,
    setPromptDraft: updatePromptDraft,
    inputErrorMessage,
    latestSynthesisReport,
    runStatus,
    runPhase,
    runtimeErrorMessage,
    bootstrapStatus,
    bootstrapErrorMessage,
    isBootstrapping,
    isRunning,
    isBusy,
    effectiveMode,
    displayMode,
    synthesisMode,
    selectedPresetId,
    selectedExecutionPlan,
    selectedPresetDefinition,
    selectedPresetReadyProviders: selectedPresetReadiness.readyProviders,
    selectedPresetMissingHostedProviders: selectedPresetReadiness.missingHostedProviders,
    selectedPresetUnavailableLocalProviders: selectedPresetReadiness.unavailableLocalProviders,
    availableCandidateModels,
    availableSynthesisModels,
    setSelectedPresetId: applyPresetTemplate,
    setCandidateCount,
    setCandidateModelSelection,
    setSynthesisModelSelection,
    applyExecutionPlan,
    conversationSummaries,
    loadedConversation,
    selectedConversation,
    selectedBranch,
    selectedNode,
    outlineNodes,
    siblingBranches: selectedBranch ? (loadedConversation?.branches.filter(b => b.sourceNodeId === selectedBranch.sourceNodeId) ?? []) : [],
    selectedBranchId: currentBranchId,
    selectedNodeId: currentNodeId,
    selectedNodeIsHead,
    pendingSubmissionMode,
    submitPrompt,
    runManualSynthesis,
    selectConversation,
    startNewConversation,
    selectBranch,
    selectNode,
    forkSelectedNode,
    refreshExplorer,
  };
}
