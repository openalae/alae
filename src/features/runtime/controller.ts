import { useEffect } from "react";

import { selectLatestSynthesisReport, useAppStore } from "@/store";
import { appStore } from "@/store/app-store";

export function useRuntimeDrawerState() {
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

export function useRuntimeDrawerAutoOpen() {
  const { runtimeErrorMessage } = useRuntimeDrawerState();

  useEffect(() => {
    if (runtimeErrorMessage) {
      appStore.getState().openTruthPanel();
    }
  }, [runtimeErrorMessage]);
}

export function toggleRuntimeDrawer() {
  appStore.getState().toggleTruthPanel();
}
