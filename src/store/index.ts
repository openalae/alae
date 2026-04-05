import type { ActivePath, AppStoreState, TruthPanelState } from "@/store/types";
import type { SupportedProviderId } from "@/features/settings/providers";

export { createAppStore, useAppStore } from "@/store/app-store";
export { createInitialAppStoreState, initialAppStoreState } from "@/store/initial-state";
export type {
  ActivePath,
  ApiKeyStatus,
  AppStore,
  AppStoreActions,
  AppStoreInstance,
  AppStorePreloadedState,
  AppStoreState,
  ModelCatalogRecord,
  ProviderStatusMap,
  RuntimeActions,
  RuntimeState,
  SettingsActions,
  SettingsState,
  TruthPanelActions,
  TruthPanelState,
  WorkspaceActions,
  WorkspaceState,
} from "@/store/types";

export const selectActivePath = (state: AppStoreState): ActivePath => ({
  currentConversationId: state.currentConversationId,
  currentBranchId: state.currentBranchId,
  currentNodeId: state.currentNodeId,
});

export const selectLatestSynthesisReport = (state: AppStoreState) => state.latestSynthesisReport;

export const selectTruthPanelState = (state: AppStoreState): TruthPanelState => ({
  isTruthPanelOpen: state.isTruthPanelOpen,
  truthPanelSnapshot: state.truthPanelSnapshot,
});

export const selectApiKeyStatus =
  (provider: SupportedProviderId) => (state: AppStoreState) => state.apiKeyStatuses[provider];

export const selectProviderModelCatalog =
  (provider: SupportedProviderId) => (state: AppStoreState) => state.modelCatalog[provider];
