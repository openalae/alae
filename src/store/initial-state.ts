import { buildModelCatalogRecord } from "@/features/settings/providers";
import type { AppStorePreloadedState, AppStoreState } from "@/store/types";

export const initialAppStoreState: AppStoreState = {
  currentConversationId: null,
  currentBranchId: null,
  currentNodeId: null,
  latestSynthesisReport: null,
  runStatus: "idle",
  runPhase: "idle",
  runtimeErrorMessage: null,
  lastRunCompletedAt: null,
  isTruthPanelOpen: false,
  truthPanelSnapshot: null,
  apiKeyStatuses: {},
  modelCatalog: buildModelCatalogRecord(),
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
    modelCatalog: {
      ...initialAppStoreState.modelCatalog,
      ...(preloadedState.modelCatalog ?? {}),
    },
  };
}
