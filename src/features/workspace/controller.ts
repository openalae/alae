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
import type { ConversationBranch, ConversationNode, LoadedConversation } from "@/schema";

export const defaultWorkspacePresetId: SynthesisPresetId = "crossVendorDefault";

type ApiKeyStatuses = Record<string, ApiKeyStatus>;
type WorkspaceBootstrapStatus = "loading" | "ready" | "error";
type WorkspaceHydrationOptions = {
  preserveExistingResult?: boolean;
};

type RunWorkspaceSynthesisOptions = {
  apiKeyStatuses?: ApiKeyStatuses;
  presetId?: SynthesisPresetId;
  runSynthesisImpl?: typeof runSynthesis;
  createMockRegistry?: (presetId: SynthesisPresetId) => MockRegistry;
};

type WorkspacePersistenceInput = {
  repository: ReasoningTreeRepository;
  prompt: string;
  currentConversationId: string | null;
  currentBranchId: string | null;
  status: "completed" | "failed";
  createdAt: string;
  synthesisReport?: WorkspaceRunResult["report"] | null;
  truthPanelSnapshot?: WorkspaceRunResult["truthPanelSnapshot"] | null;
};

export type WorkspaceRunResult = SynthesisExecutionResult & {
  effectiveMode: SynthesisMode;
};

function getTimestamp() {
  return new Date().toISOString();
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

function getPreferredBranch(loadedConversation: LoadedConversation): ConversationBranch | null {
  const mainBranch =
    loadedConversation.branches.find((branch) => branch.name === "main") ?? null;

  if (mainBranch) {
    return mainBranch;
  }

  return (
    [...loadedConversation.branches].sort((left, right) => {
      const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);

      if (updatedAtOrder !== 0) {
        return updatedAtOrder;
      }

      return right.id.localeCompare(left.id);
    })[0] ?? null
  );
}

function getHeadNode(
  loadedConversation: LoadedConversation,
  branch: ConversationBranch | null,
): ConversationNode | null {
  if (!branch?.headNodeId) {
    return null;
  }

  return loadedConversation.nodes.find((node) => node.id === branch.headNodeId) ?? null;
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
  const { preserveExistingResult = false } = options;
  const state = appStore.getState();
  const branch = getPreferredBranch(loadedConversation);
  const node = getHeadNode(loadedConversation, branch);

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

async function ensureConversationTarget(
  repository: ReasoningTreeRepository,
  prompt: string,
  currentConversationId: string | null,
  currentBranchId: string | null,
  createdAt: string,
) {
  if (currentConversationId) {
    const loadedConversation = await repository.loadConversation(currentConversationId);

    if (loadedConversation) {
      const branch =
        loadedConversation.branches.find((candidate) => candidate.id === currentBranchId) ??
        getPreferredBranch(loadedConversation);

      if (branch) {
        return {
          conversationId: loadedConversation.conversation.id,
          branchId: branch.id,
        };
      }
    }
  }

  const createdConversation = await repository.createConversation({
    title: deriveWorkspaceTitle(prompt),
    createdAt,
  });
  const branch = getPreferredBranch(createdConversation);

  if (!branch) {
    throw new Error("The main branch could not be resolved after creating a conversation.");
  }

  return {
    conversationId: createdConversation.conversation.id,
    branchId: branch.id,
  };
}

async function persistWorkspaceNode(input: WorkspacePersistenceInput) {
  const target = await ensureConversationTarget(
    input.repository,
    input.prompt,
    input.currentConversationId,
    input.currentBranchId,
    input.createdAt,
  );

  await input.repository.appendNode({
    conversationId: target.conversationId,
    branchId: target.branchId,
    title: deriveWorkspaceTitle(input.prompt),
    prompt: input.prompt,
    status: input.status,
    synthesisReport: input.synthesisReport ?? null,
    truthPanelSnapshot: input.truthPanelSnapshot ?? null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });

  const loadedConversation = await input.repository.loadConversation(target.conversationId);

  if (loadedConversation === null) {
    throw new Error(`Conversation ${target.conversationId} could not be reloaded after persistence.`);
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
  const currentConversationId = useAppStore((state) => state.currentConversationId);
  const currentBranchId = useAppStore((state) => state.currentBranchId);
  const apiKeyStatuses = useAppStore((state) => state.apiKeyStatuses);
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const runStatus = useAppStore((state) => state.runStatus);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);
  const repositoryRef = useRef<ReasoningTreeRepository | null>(null);

  if (repositoryRef.current === null) {
    repositoryRef.current = createReasoningTreeRepository();
  }

  const repository = repositoryRef.current;
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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const loadedConversation = await repository.loadLatestConversation();

        if (!active) {
          return;
        }

        if (loadedConversation === null) {
          clearWorkspaceResults();
        } else {
          hydrateWorkspaceStateFromConversation(loadedConversation);
        }

        appStore.getState().resetRuntime();
        setBootstrapErrorMessage(null);
        setBootstrapStatus("ready");
        setLastExecutionMode(null);
      } catch (error) {
        if (!active) {
          return;
        }

        appStore.getState().resetRuntime();
        setBootstrapErrorMessage(
          `Unable to restore the latest local conversation. ${getErrorMessage(error)}`,
        );
        setBootstrapStatus("error");
      }
    })();

    return () => {
      active = false;
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

    setInputErrorMessage(null);
    setBootstrapErrorMessage(null);
    appStore.getState().beginRun();

    try {
      const result = await runWorkspaceSynthesis(trimmedPrompt, {
        apiKeyStatuses,
      });

      try {
        const persistedConversation = await persistWorkspaceNode({
          repository,
          prompt: trimmedPrompt,
          currentConversationId,
          currentBranchId,
          status: "completed",
          synthesisReport: result.report,
          truthPanelSnapshot: result.truthPanelSnapshot,
          createdAt: result.report.createdAt,
        });

        hydrateWorkspaceStateFromConversation(persistedConversation);
        appStore.getState().completeRun(result.report);
        setLastExecutionMode(result.effectiveMode);
      } catch (persistenceError) {
        appStore
          .getState()
          .failRun(`Local persistence failed: ${getErrorMessage(persistenceError)}`);
      }
    } catch (error) {
      let failureMessage = getErrorMessage(error);

      try {
        const failedConversation = await persistWorkspaceNode({
          repository,
          prompt: trimmedPrompt,
          currentConversationId,
          currentBranchId,
          status: "failed",
          createdAt: getTimestamp(),
        });

        hydrateWorkspaceStateFromConversation(failedConversation, {
          preserveExistingResult: true,
        });
      } catch (persistenceError) {
        failureMessage = `${failureMessage} Local persistence also failed: ${getErrorMessage(persistenceError)}`;
      }

      appStore.getState().failRun(failureMessage);
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
    submitPrompt,
  };
}
