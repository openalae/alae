import type { AppStoreSlice, WorkspaceActions } from "@/store/types";

export const createWorkspaceSlice: AppStoreSlice<WorkspaceActions> = (set) => ({
  setActivePath: (payload) =>
    set({
      currentConversationId: payload.currentConversationId,
      currentBranchId: payload.currentBranchId,
      currentNodeId: payload.currentNodeId,
    }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setCurrentBranch: (id) => set({ currentBranchId: id }),
  setCurrentNode: (id) => set({ currentNodeId: id }),
  setLatestSynthesisReport: (report) => set({ latestSynthesisReport: report }),
  clearLatestSynthesisReport: () => set({ latestSynthesisReport: null }),
  resetWorkspace: () =>
    set({
      currentConversationId: null,
      currentBranchId: null,
      currentNodeId: null,
      latestSynthesisReport: null,
    }),
});
