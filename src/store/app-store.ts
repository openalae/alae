import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { createInitialAppStoreState } from "@/store/initial-state";
import { createRuntimeSlice } from "@/store/slices/runtime-slice";
import { createSettingsSlice } from "@/store/slices/settings-slice";
import { createTruthPanelSlice } from "@/store/slices/truth-panel-slice";
import { createWorkspaceSlice } from "@/store/slices/workspace-slice";
import type { AppStore, AppStorePreloadedState } from "@/store/types";

export const createAppStore = (preloadedState: AppStorePreloadedState = {}) => {
  const initialState = createInitialAppStoreState(preloadedState);

  return createStore<AppStore>()((...storeArgs) => ({
    ...initialState,
    ...createWorkspaceSlice(...storeArgs),
    ...createRuntimeSlice(...storeArgs),
    ...createTruthPanelSlice(...storeArgs),
    ...createSettingsSlice(...storeArgs),
  }));
};

const appStore = createAppStore();

export const useAppStore = <T>(selector: (state: AppStore) => T) => useStore(appStore, selector);
