import type { AppStoreSlice, SettingsActions } from "@/store/types";

import { initialAppStoreState } from "@/store/initial-state";

export const createSettingsSlice: AppStoreSlice<SettingsActions> = (set) => ({
  setApiKeyStatus: (provider, status) =>
    set((state) => ({
      apiKeyStatuses: {
        ...state.apiKeyStatuses,
        [provider]: status,
      },
    })),
  setApiKeyStatuses: (statuses) =>
    set({
      apiKeyStatuses: {
        ...statuses,
      },
    }),
  clearApiKeyStatus: (provider) =>
    set((state) => {
      const { [provider]: _removed, ...remainingStatuses } = state.apiKeyStatuses;

      return {
        apiKeyStatuses: remainingStatuses,
      };
    }),
  resetApiKeyStatuses: () =>
    set({
      apiKeyStatuses: initialAppStoreState.apiKeyStatuses,
    }),
  setModelCatalog: (catalog) =>
    set({
      modelCatalog: catalog,
    }),
  setProviderModelCatalog: (provider, models) =>
    set((state) => ({
      modelCatalog: {
        ...state.modelCatalog,
        [provider]: models,
      },
    })),
  resetModelCatalog: () =>
    set({
      modelCatalog: initialAppStoreState.modelCatalog,
    }),
});
