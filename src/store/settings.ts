import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type Locale = "en" | "zh";

interface SettingsState {
  theme: Theme;
  locale: Locale;
  isRightPanelOpen: boolean;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      locale: "en",
      isRightPanelOpen: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
      setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
    }),
    {
      name: "alae-settings-storage",
    }
  )
);
