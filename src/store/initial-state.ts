import type { AppStorePreloadedState, AppStoreState } from "@/store/types";

export const initialAppStoreState: AppStoreState = {
  currentConversationId: null,
  currentBranchId: null,
  currentNodeId: null,
  latestSynthesisReport: null,
  runStatus: "idle",
  runtimeErrorMessage: null,
  lastRunCompletedAt: null,
  isTruthPanelOpen: false,
  truthPanelSnapshot: null,
  apiKeyStatuses: {},
};

export function createInitialAppStoreState(
  preloadedState: AppStorePreloadedState = {},
): AppStoreState {
  return {
    ...initialAppStoreState,
    ...preloadedState,
    apiKeyStatuses: {
      ...initialAppStoreState.apiKeyStatuses,
      ...(preloadedState.apiKeyStatuses ?? {}),
    },
  };
}
