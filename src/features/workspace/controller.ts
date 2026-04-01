import { useEffect, useRef, useState } from "react";

import {
  createDefaultMockRegistry,
  getSynthesisPreset,
  runSynthesis,
  type MockRegistry,
  type SynthesisExecutionResult,
  type SynthesisMode,
  type SynthesisPreset,
  type SynthesisPresetId,
} from "@/features/consensus";
import {
  createReasoningTreeRepository,
  type ReasoningTreeRepository,
} from "@/features/reasoning-tree";
import {
  selectLatestSynthesisReport,
  useAppStore,
  type ApiKeyStatus,
} from "@/store";
import { appStore } from "@/store/app-store";
import type {
  Conversation,
  ConversationBranch,
  ConversationNode,
  ConversationSummary,
  LoadedConversation,
} from "@/schema";

export const defaultWorkspacePresetId: SynthesisPresetId = "crossVendorDefault";

type ApiKeyStatuses = Record<string, ApiKeyStatus>;
type WorkspaceBootstrapStatus = "loading" | "ready" | "error";
type PendingSubmissionMode = "append" | "fork";
type WorkspaceHydrationOptions = {
  branchId?: string | null;
  nodeId?: string | null;
  preserveExistingResult?: boolean;
};

type RunWorkspaceSynthesisOptions = {
  apiKeyStatuses?: ApiKeyStatuses;
  presetId?: SynthesisPresetId;
  runSynthesisImpl?: typeof runSynthesis;
  createMockRegistry?: (presetId: SynthesisPresetId) => MockRegistry;
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
  effectiveMode: SynthesisMode;
};

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

export function resolveWorkspaceRunMode(
  apiKeyStatuses: ApiKeyStatuses,
  preset: SynthesisPreset = getSynthesisPreset(defaultWorkspacePresetId),
): SynthesisMode {
  const requiredProviders = new Set(preset.slots.map((slot) => slot.provider));

  for (const provider of requiredProviders) {
    if (!apiKeyStatuses[provider]?.configured) {
      return "mock";
    }
  }

  return "real";
}

export async function runWorkspaceSynthesis(
  prompt: string,
  options: RunWorkspaceSynthesisOptions = {},
): Promise<WorkspaceRunResult> {
  const presetId = options.presetId ?? defaultWorkspacePresetId;
  const preset = getSynthesisPreset(presetId);
  const apiKeyStatuses = options.apiKeyStatuses ?? appStore.getState().apiKeyStatuses;
  const effectiveMode = resolveWorkspaceRunMode(apiKeyStatuses, preset);
  const runSynthesisImpl = options.runSynthesisImpl ?? runSynthesis;
  const mockRegistryFactory = options.createMockRegistry ?? createDefaultMockRegistry;

  const result =
    effectiveMode === "mock"
      ? await runSynthesisImpl(
          {
            prompt,
            mode: "mock",
            presetId,
          },
          {
            mockRegistry: mockRegistryFactory(presetId),
          },
        )
      : await runSynthesisImpl({
          prompt,
          mode: "real",
          presetId,
        });

  return {
    effectiveMode,
    report: result.report,
    truthPanelSnapshot: result.truthPanelSnapshot,
  };
}

export function useWorkspaceController() {
  const currentBranchId = useAppStore((state) => state.currentBranchId);
  const currentNodeId = useAppStore((state) => state.currentNodeId);
  const apiKeyStatuses = useAppStore((state) => state.apiKeyStatuses);
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const runStatus = useAppStore((state) => state.runStatus);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);
  const repositoryRef = useRef<ReasoningTreeRepository | null>(null);

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
  const [lastExecutionMode, setLastExecutionMode] = useState<SynthesisMode | null>(null);
  const effectiveMode = resolveWorkspaceRunMode(apiKeyStatuses);
  const displayMode = latestSynthesisReport ? (lastExecutionMode ?? effectiveMode) : effectiveMode;
  const isRunning = runStatus === "running";
  const isBootstrapping = bootstrapStatus === "loading";
  const isBusy = isRunning || isBootstrapping;
  const selectedConversation: Conversation | null = loadedConversation?.conversation ?? null;
  const selectedBranch =
    loadedConversation === null ? null : getBranchById(loadedConversation, currentBranchId);
  const selectedNode =
    loadedConversation === null ? null : getNodeById(loadedConversation, currentNodeId);
  const selectedNodeIsHead =
    selectedBranch !== null &&
    selectedNode !== null &&
    selectedBranch.headNodeId === selectedNode.id;
  const pendingSubmissionMode = getPendingSubmissionMode(selectedBranch, selectedNode);

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

  const submitPrompt = async () => {
    const trimmedPrompt = promptDraft.trim();

    if (isBusy) {
      return;
    }

    if (!trimmedPrompt) {
      setInputErrorMessage("Prompt is required before running synthesis.");
      return;
    }

    const state = appStore.getState();
    const submissionTimestamp = getTimestamp();
    let target: SubmissionTarget | null = null;

    setInputErrorMessage(null);
    setBootstrapErrorMessage(null);
    state.beginRun();

    try {
      target = await ensureSubmissionTarget(trimmedPrompt, submissionTimestamp);

      const result = await runWorkspaceSynthesis(trimmedPrompt, {
        apiKeyStatuses,
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

  const updatePromptDraft = (value: string) => {
    setPromptDraft(value);

    if (inputErrorMessage) {
      setInputErrorMessage(null);
    }
  };

  return {
    promptDraft,
    setPromptDraft: updatePromptDraft,
    inputErrorMessage,
    latestSynthesisReport,
    runStatus,
    runtimeErrorMessage,
    bootstrapStatus,
    bootstrapErrorMessage,
    isBootstrapping,
    isRunning,
    isBusy,
    effectiveMode,
    displayMode,
    conversationSummaries,
    loadedConversation,
    selectedConversation,
    selectedBranch,
    selectedNode,
    selectedBranchId: currentBranchId,
    selectedNodeId: currentNodeId,
    selectedNodeIsHead,
    pendingSubmissionMode,
    submitPrompt,
    selectConversation,
    selectBranch,
    selectNode,
    forkSelectedNode,
    refreshExplorer,
  };
}
