import { useState } from "react";

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
import { selectLatestSynthesisReport, useAppStore, type ApiKeyStatus } from "@/store";
import { appStore } from "@/store/app-store";

export const defaultWorkspacePresetId: SynthesisPresetId = "crossVendorDefault";

type ApiKeyStatuses = Record<string, ApiKeyStatus>;

type RunWorkspaceSynthesisOptions = {
  apiKeyStatuses?: ApiKeyStatuses;
  presetId?: SynthesisPresetId;
  runSynthesisImpl?: typeof runSynthesis;
  createMockRegistry?: (presetId: SynthesisPresetId) => MockRegistry;
};

export type WorkspaceRunResult = SynthesisExecutionResult & {
  effectiveMode: SynthesisMode;
};

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Workspace synthesis failed unexpectedly.";
}

export function useWorkspaceController() {
  const apiKeyStatuses = useAppStore((state) => state.apiKeyStatuses);
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const runStatus = useAppStore((state) => state.runStatus);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);
  const [promptDraft, setPromptDraft] = useState("");
  const [inputErrorMessage, setInputErrorMessage] = useState<string | null>(null);
  const [lastExecutionMode, setLastExecutionMode] = useState<SynthesisMode | null>(null);
  const effectiveMode = resolveWorkspaceRunMode(apiKeyStatuses);
  const displayMode = latestSynthesisReport ? (lastExecutionMode ?? effectiveMode) : effectiveMode;
  const isRunning = runStatus === "running";

  const submitPrompt = async () => {
    const trimmedPrompt = promptDraft.trim();

    if (isRunning) {
      return;
    }

    if (!trimmedPrompt) {
      setInputErrorMessage("Prompt is required before running synthesis.");
      return;
    }

    setInputErrorMessage(null);
    appStore.getState().beginRun();

    try {
      const result = await runWorkspaceSynthesis(trimmedPrompt, {
        apiKeyStatuses,
      });

      appStore.getState().completeRun(result.report);
      appStore.getState().setTruthPanelSnapshot(result.truthPanelSnapshot);
      setLastExecutionMode(result.effectiveMode);
    } catch (error) {
      appStore.getState().failRun(getErrorMessage(error));
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
    isRunning,
    effectiveMode,
    displayMode,
    submitPrompt,
  };
}
