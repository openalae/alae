import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SynthesisToggle, SynthesisPresetId } from "@/features/consensus/types";

export type Theme = "light" | "dark";
export type Locale = "en" | "zh";
export type SettingsTab = "appearance" | "providers" | "presets" | "advanced";

interface SettingsState {
  theme: Theme;
  locale: Locale;
  activeSettingsTab: SettingsTab;
  isRightPanelOpen: boolean;
  isLeftPanelOpen: boolean;
  isSettingsModalOpen: boolean;
  developerMode: boolean;
  synthesisMode: SynthesisToggle;
  defaultPresetId: SynthesisPresetId;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setActiveSettingsTab: (tab: SettingsTab) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  openSettingsModal: (tab?: SettingsTab) => void;
  closeSettingsModal: () => void;
  setDeveloperMode: (enabled: boolean) => void;
  setSynthesisMode: (mode: SynthesisToggle) => void;
  setDefaultPresetId: (presetId: SynthesisPresetId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      locale: "en",
      activeSettingsTab: "appearance",
      isRightPanelOpen: false,
      isLeftPanelOpen: false,
      isSettingsModalOpen: false,
      developerMode: false,
      synthesisMode: "auto",
      defaultPresetId: "freeDefault",
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),
      toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
      setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
      toggleLeftPanel: () => set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),
      setLeftPanelOpen: (open) => set({ isLeftPanelOpen: open }),
      openSettingsModal: (tab) => set((s) => ({
        isSettingsModalOpen: true,
        activeSettingsTab: tab ?? s.activeSettingsTab,
      })),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
      setSynthesisMode: (mode) => set({ synthesisMode: mode }),
      setDefaultPresetId: (presetId) => set({ defaultPresetId: presetId }),
    }),
    {
      name: "alae-settings-storage",
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        isRightPanelOpen: state.isRightPanelOpen,
        isLeftPanelOpen: state.isLeftPanelOpen,
        developerMode: state.developerMode,
        synthesisMode: state.synthesisMode,
        defaultPresetId: state.defaultPresetId,
      }),
    }
  )
);
