import type { StateCreator, StoreApi } from "zustand";

import type { NodeStatus, SynthesisReport, TruthPanelSnapshot } from "@/schema";

export type ActivePath = {
  currentConversationId: string | null;
  currentBranchId: string | null;
  currentNodeId: string | null;
};

export type ApiKeyStatus = {
  configured: boolean;
  lastCheckedAt: string | null;
  error: string | null;
};

export type WorkspaceState = ActivePath & {
  latestSynthesisReport: SynthesisReport | null;
};

export type WorkspaceActions = {
  setActivePath: (payload: ActivePath) => void;
  setCurrentConversation: (id: string | null) => void;
  setCurrentBranch: (id: string | null) => void;
  setCurrentNode: (id: string | null) => void;
  setLatestSynthesisReport: (report: SynthesisReport) => void;
  clearLatestSynthesisReport: () => void;
  resetWorkspace: () => void;
};

export type RuntimeState = {
  runStatus: NodeStatus;
  runtimeErrorMessage: string | null;
  lastRunCompletedAt: string | null;
};

export type RuntimeActions = {
  beginRun: () => void;
  completeRun: (report: SynthesisReport) => void;
  failRun: (message: string) => void;
  resetRuntime: () => void;
};

export type TruthPanelState = {
  isTruthPanelOpen: boolean;
  truthPanelSnapshot: TruthPanelSnapshot | null;
};

export type TruthPanelActions = {
  openTruthPanel: () => void;
  closeTruthPanel: () => void;
  toggleTruthPanel: () => void;
  setTruthPanelSnapshot: (snapshot: TruthPanelSnapshot) => void;
  clearTruthPanelSnapshot: () => void;
};

export type SettingsState = {
  apiKeyStatuses: Record<string, ApiKeyStatus>;
};

export type SettingsActions = {
  setApiKeyStatus: (provider: string, status: ApiKeyStatus) => void;
  setApiKeyStatuses: (statuses: Record<string, ApiKeyStatus>) => void;
  clearApiKeyStatus: (provider: string) => void;
  resetApiKeyStatuses: () => void;
};

export type AppStoreState = WorkspaceState & RuntimeState & TruthPanelState & SettingsState;
export type AppStoreActions = WorkspaceActions &
  RuntimeActions &
  TruthPanelActions &
  SettingsActions;
export type AppStore = AppStoreState & AppStoreActions;
export type AppStorePreloadedState = Partial<AppStoreState>;
export type AppStoreInstance = StoreApi<AppStore>;
export type AppStoreSlice<TSlice> = StateCreator<AppStore, [], [], TSlice>;
