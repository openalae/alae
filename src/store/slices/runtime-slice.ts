import type { AppStoreSlice, RuntimeActions } from "@/store/types";

export const createRuntimeSlice: AppStoreSlice<RuntimeActions> = (set) => ({
  beginRun: () =>
    set({
      runStatus: "running",
      runtimeErrorMessage: null,
    }),
  completeRun: (report) =>
    set({
      runStatus: "completed",
      runtimeErrorMessage: null,
      lastRunCompletedAt: report.createdAt,
      latestSynthesisReport: report,
    }),
  failRun: (message) =>
    set({
      runStatus: "failed",
      runtimeErrorMessage: message,
    }),
  resetRuntime: () =>
    set({
      runStatus: "idle",
      runtimeErrorMessage: null,
      lastRunCompletedAt: null,
    }),
});
