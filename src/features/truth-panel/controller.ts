import { useEffect } from "react";

import { selectLatestSynthesisReport, useAppStore } from "@/store";
import { appStore } from "@/store/app-store";

export function useTruthPanelState() {
  const isTruthPanelOpen = useAppStore((state) => state.isTruthPanelOpen);
  const truthPanelSnapshot = useAppStore((state) => state.truthPanelSnapshot);
  const latestSynthesisReport = useAppStore(selectLatestSynthesisReport);
  const runtimeErrorMessage = useAppStore((state) => state.runtimeErrorMessage);

  return {
    isTruthPanelOpen,
    truthPanelSnapshot,
    latestSynthesisReport,
    runtimeErrorMessage,
  };
}

export function useTruthPanelAutoOpen() {
  const { latestSynthesisReport, runtimeErrorMessage } = useTruthPanelState();

  useEffect(() => {
    if (runtimeErrorMessage || latestSynthesisReport?.status === "failed") {
      appStore.getState().openTruthPanel();
    }
  }, [latestSynthesisReport?.status, runtimeErrorMessage]);
}

export function toggleTruthPanel() {
  appStore.getState().toggleTruthPanel();
}
