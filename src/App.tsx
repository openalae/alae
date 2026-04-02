import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";
import "@/i18n"; 

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
  }, [locale, i18n]);

  return <AppShell />;
}

export default App;
