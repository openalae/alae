import type { AppStoreSlice, TruthPanelActions } from "@/store/types";

export const createTruthPanelSlice: AppStoreSlice<TruthPanelActions> = (set) => ({
  openTruthPanel: () => set({ isTruthPanelOpen: true }),
  closeTruthPanel: () => set({ isTruthPanelOpen: false }),
  toggleTruthPanel: () => set((state) => ({ isTruthPanelOpen: !state.isTruthPanelOpen })),
  setTruthPanelSnapshot: (snapshot) => set({ truthPanelSnapshot: snapshot }),
  clearTruthPanelSnapshot: () => set({ truthPanelSnapshot: null }),
});
