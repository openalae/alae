import type { StateCreator, StoreApi } from "zustand";

import type {
  ModelCatalogRecord,
  ModelCatalogItem,
  SupportedProviderId,
} from "@/features/settings/providers";
import type { NodeStatus, SynthesisReport, TruthPanelSnapshot } from "@/schema";

export type { ModelCatalogRecord } from "@/features/settings/providers";

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
  runPhase: RuntimePhase;
  runtimeErrorMessage: string | null;
  lastRunCompletedAt: string | null;
};

export type RuntimePhase =
  | "idle"
  | "preflight"
  | "candidate_running"
  | "conflicts_pending"
  | "judge_running"
  | "completed"
  | "failed";

export type RuntimeActions = {
  beginRun: (phase?: Extract<RuntimePhase, "preflight" | "candidate_running" | "judge_running">) => void;
  setRunPhase: (phase: RuntimePhase) => void;
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

export type ProviderStatusMap = Partial<Record<SupportedProviderId, ApiKeyStatus>>;

export type SettingsState = {
  apiKeyStatuses: ProviderStatusMap;
  modelCatalog: ModelCatalogRecord;
};

export type SettingsActions = {
  setApiKeyStatus: (provider: SupportedProviderId, status: ApiKeyStatus) => void;
  setApiKeyStatuses: (statuses: ProviderStatusMap) => void;
  clearApiKeyStatus: (provider: SupportedProviderId) => void;
  resetApiKeyStatuses: () => void;
  setModelCatalog: (catalog: ModelCatalogRecord) => void;
  setProviderModelCatalog: (provider: SupportedProviderId, models: ModelCatalogItem[]) => void;
  resetModelCatalog: () => void;
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
