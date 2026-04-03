import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Sun, Moon, Languages, Code2, KeyRound } from "lucide-react";

import { useSettingsStore } from "@/store/settings";
import { ProviderAccessCard } from "@/features/settings/provider-access-card";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";
import { useState } from "react";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to refresh provider access state.";
}

type SettingsTab = "appearance" | "providers" | "advanced";

export function SettingsModal() {
  const { t } = useTranslation();
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    theme,
    setTheme,
    locale,
    setLocale,
    developerMode,
    setDeveloperMode,
    activeSettingsTab,
    setActiveSettingsTab,
  } = useSettingsStore();

  const overlayRef = useRef<HTMLDivElement>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const refreshProviders = async () => {
    setIsRefreshing(true);
    setProviderError(null);
    try {
      await refreshApiKeyStatuses();
    } catch (error) {
      setProviderError(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh provider statuses when switching to providers tab
  useEffect(() => {
    if (activeSettingsTab === "providers" && isSettingsModalOpen) {
      void refreshProviders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSettingsTab, isSettingsModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettingsModal();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsModalOpen, closeSettingsModal]);

  if (!isSettingsModalOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closeSettingsModal();
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: t("Appearance"), icon: <Sun className="h-3.5 w-3.5" /> },
    { id: "providers", label: t("Model providers"), icon: <KeyRound className="h-3.5 w-3.5" /> },
    { id: "advanced", label: t("Advanced"), icon: <Code2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex h-[min(600px,85vh)] w-[min(720px,90vw)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-bold tracking-tight">{t("Settings")}</h2>
          <button
            onClick={closeSettingsModal}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border/30 bg-surface-container-lowest p-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  activeSettingsTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSettingsTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t("Theme")}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t("Choose your preferred color scheme.")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        theme === "dark"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      {t("Dark")}
                    </button>
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        theme === "light"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      {t("Light")}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-6">
                  <h3 className="text-sm font-semibold mb-1">{t("Language")}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t("Select your display language.")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLocale("en")}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        locale === "en"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Languages className="h-4 w-4" />
                      English
                    </button>
                    <button
                      onClick={() => setLocale("zh")}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        locale === "zh"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Languages className="h-4 w-4" />
                      中文
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === "providers" && (
              <ProviderAccessCard
                isRefreshing={isRefreshing}
                panelError={providerError}
                onRefresh={() => void refreshProviders()}
              />
            )}

            {activeSettingsTab === "advanced" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t("Developer Mode")}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("Enable developer tools, status bar, and additional debugging details.")}
                  </p>
                  <button
                    onClick={() => setDeveloperMode(!developerMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      developerMode ? "bg-primary" : "bg-border"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        developerMode ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
