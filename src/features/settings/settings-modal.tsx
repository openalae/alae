import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Sun, Moon, Languages, Code2, KeyRound, Layers, BrainCircuit, Zap, Trash2 } from "lucide-react";

import { useSettingsStore } from "@/store/settings";
import { ProviderAccessCard } from "@/features/settings/provider-access-card";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";
import { synthesisPresetDefinitions, getPresetCandidateCount } from "@/features/consensus/presets";
import { useState } from "react";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to refresh provider access state.";
}

type SettingsTab = "appearance" | "providers" | "presets" | "advanced";

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
    judgeMode,
    setJudgeMode,
    defaultPresetId,
    setDefaultPresetId,
    customPresets,
    deleteCustomPreset,
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

  useEffect(() => {
    if (activeSettingsTab === "providers" && isSettingsModalOpen) {
      void refreshProviders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSettingsTab, isSettingsModalOpen]);

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
    { id: "presets", label: t("Templates"), icon: <Layers className="h-3.5 w-3.5" /> },
    { id: "advanced", label: t("Advanced"), icon: <Code2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex h-[min(620px,88vh)] w-[min(760px,92vw)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-2xl animate-in zoom-in-95 fade-in duration-200">
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

            {activeSettingsTab === "presets" && (
              <div className="space-y-6">
                {/* Default Template */}
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t("Default Template")}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("Choose the template used to prefill the input toolbar. You can still swap models per run before sending.")}
                  </p>
                  <div className="grid gap-2">
                    {synthesisPresetDefinitions.map((preset) => {
                      const n = getPresetCandidateCount(preset.id);
                      const isSelected = defaultPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => setDefaultPresetId(preset.id)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                            isSelected
                              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                              : "border-border/50 bg-card/60 hover:bg-accent hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              }`}>
                                {n}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{t(preset.label)}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                  {preset.providerSummary}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                                {t("Default")}
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground pl-10">
                            {t(preset.description)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {customPresets.length > 0 && (
                    <div className="pt-2">
                       <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-widest">{t("Custom Presets")}</h4>
                       <div className="grid gap-2">
                          {customPresets.map((presetDef) => {
                            const n = presetDef.preset.slots.filter(s => s.role !== "synthesis").length;
                            const isSelected = defaultPresetId === presetDef.id;
                            return (
                               <div key={presetDef.id} className="relative group">
                                 <button
                                  onClick={() => setDefaultPresetId(presetDef.id)}
                                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                                    isSelected
                                      ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                                      : "border-border/50 bg-card/60 hover:bg-accent hover:border-border"
                                  }`}
                                 >
                                   <div className="flex items-center justify-between gap-3">
                                     <div className="flex items-center gap-3">
                                       <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                         isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                       }`}>
                                         {n}
                                       </div>
                                       <div>
                                         <div className="text-sm font-semibold">{presetDef.label}</div>
                                         <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                           {presetDef.providerSummary}
                                         </div>
                                       </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       {isSelected && (
                                         <div className="text-[10px] font-semibold text-primary uppercase tracking-widest mr-2">
                                           {t("Default")}
                                         </div>
                                       )}
                                       <button
                                         onClick={(e) => { e.stopPropagation(); deleteCustomPreset(presetDef.id); }}
                                         className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all flex items-center justify-center"
                                         title={t("Delete custom preset")}
                                       >
                                          <Trash2 className="h-3.5 w-3.5" />
                                       </button>
                                     </div>
                                   </div>
                                 </button>
                               </div>
                            );
                          })}
                       </div>
                    </div>
                  )}
                </div>

                {/* Judge Resolution Mode */}
                <div className="border-t border-border/30 pt-6">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    {t("Conflict Resolution")}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("When models disagree, choose whether the judge runs automatically or waits for your confirmation.")}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setJudgeMode("auto")}
                      className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                        judgeMode === "auto"
                          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                          : "border-border/50 bg-card/60 hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`h-4 w-4 ${judgeMode === "auto" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-semibold">{t("Auto")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-5">
                        {t("Judge runs immediately after candidates finish. Fully automated.")}
                      </p>
                    </button>
                    <button
                      onClick={() => setJudgeMode("manual")}
                      className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                        judgeMode === "manual"
                          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                          : "border-border/50 bg-card/60 hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <BrainCircuit className={`h-4 w-4 ${judgeMode === "manual" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-semibold">{t("Manual")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-5">
                        {t("Candidate results shown first. You decide when to resolve conflicts.")}
                      </p>
                    </button>
                  </div>
                </div>
              </div>
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
