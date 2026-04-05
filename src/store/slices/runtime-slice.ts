import type { AppStoreSlice, RuntimeActions } from "@/store/types";

export const createRuntimeSlice: AppStoreSlice<RuntimeActions> = (set) => ({
  beginRun: (phase = "preflight") =>
    set({
      runStatus: "running",
      runPhase: phase,
      runtimeErrorMessage: null,
    }),
  setRunPhase: (phase) =>
    set((state) => ({
      runStatus:
        phase === "failed" ? "failed" : phase === "completed" ? "completed" : state.runStatus,
      runPhase: phase,
    })),
  completeRun: (report) =>
    set({
      runStatus: report.status === "failed" ? "failed" : "completed",
      runPhase: report.reportStage === "awaiting_judge" ? "conflicts_pending" : report.reportStage === "failed" ? "failed" : "completed",
      runtimeErrorMessage: null,
      lastRunCompletedAt: report.createdAt,
      latestSynthesisReport: report,
    }),
  failRun: (message) =>
    set({
      runStatus: "failed",
      runPhase: "failed",
      runtimeErrorMessage: message,
    }),
  resetRuntime: () =>
    set({
      runStatus: "idle",
      runPhase: "idle",
      runtimeErrorMessage: null,
      lastRunCompletedAt: null,
    }),
});
