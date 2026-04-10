import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";

function App() {
  const { theme, locale } = useSettingsStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  useEffect(() => {
    // Background refresh of local models and API statuses on startup
    void refreshApiKeyStatuses().catch((err) => {
      console.error("Failed to refresh API statuses on startup:", err);
    });
  }, []);

  return <AppShell />;
}

export default App;
