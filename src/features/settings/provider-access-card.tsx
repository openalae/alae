import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, LoaderCircle, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProviderAccessSectionId,
  providerAccessCardId,
  providerDefinitions,
  providerRequiresApiKey,
  type CredentialProviderId,
  type SupportedProviderId,
} from "@/features/settings/providers";
import { removeApiKey, saveApiKey } from "@/features/settings/api-key-bridge";
import { useAppStore } from "@/store";

type ProviderAction = "idle" | "saving" | "deleting";

function buildProviderRecord<TValue>(
  factory: (provider: SupportedProviderId) => TValue,
): Record<SupportedProviderId, TValue> {
  return Object.fromEntries(
    providerDefinitions.map((provider) => [provider.id, factory(provider.id)]),
  ) as Record<SupportedProviderId, TValue>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected secure store error.";
}

type ProviderAccessCardProps = {
  isRefreshing?: boolean;
  panelError?: string | null;
  onRefresh?: () => void;
};

export function ProviderAccessCard({
  isRefreshing = false,
  panelError = null,
  onRefresh,
}: ProviderAccessCardProps) {
  const { t } = useTranslation();
  const apiKeyStatuses = useAppStore((state) => state.apiKeyStatuses);
  const [inputValues, setInputValues] = useState<Record<SupportedProviderId, string>>(() =>
    buildProviderRecord(() => ""),
  );
  const [rowActions, setRowActions] = useState<Record<SupportedProviderId, ProviderAction>>(() =>
    buildProviderRecord(() => "idle"),
  );
  const [feedbackMessages, setFeedbackMessages] = useState<
    Record<SupportedProviderId, string | null>
  >(() => buildProviderRecord(() => null));

  const setFeedbackMessage = (provider: SupportedProviderId, message: string | null) => {
    setFeedbackMessages((current) => ({ ...current, [provider]: message }));
  };

  const setRowAction = (provider: SupportedProviderId, action: ProviderAction) => {
    setRowActions((current) => ({ ...current, [provider]: action }));
  };

  const handleInputChange = (provider: SupportedProviderId, value: string) => {
    setInputValues((current) => ({ ...current, [provider]: value }));
    setFeedbackMessage(provider, null);
  };

  const handleSave = async (provider: CredentialProviderId) => {
    if (!inputValues[provider].trim()) {
      setFeedbackMessage(provider, t("API key is required."));
      return;
    }
    setRowAction(provider, "saving");
    try {
      await saveApiKey(provider, inputValues[provider]);
      setInputValues((current) => ({ ...current, [provider]: "" }));
      setFeedbackMessage(provider, t("API key saved."));
    } catch (error) {
      setFeedbackMessage(provider, getErrorMessage(error));
    } finally {
      setRowAction(provider, "idle");
    }
  };

  const handleDelete = async (provider: CredentialProviderId) => {
    setRowAction(provider, "deleting");
    try {
      await removeApiKey(provider);
      setInputValues((current) => ({ ...current, [provider]: "" }));
      setFeedbackMessage(provider, t("API key removed."));
    } catch (error) {
      setFeedbackMessage(provider, getErrorMessage(error));
    } finally {
      setRowAction(provider, "idle");
    }
  };

  return (
    <div id={providerAccessCardId} tabIndex={-1} className="rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-border/30">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" />
            {t("Model providers")}
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("Add hosted-provider API keys or connect local runtimes to switch from demo mode to live model calls. Stored keys stay in the native secure store.")}
          </p>
        </div>
        {onRefresh ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md"
            disabled={isRefreshing}
            onClick={onRefresh}
            title={isRefreshing ? t("Refreshing...") as string : t("Refresh access") as string}
          >
            <RotateCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {panelError ? (
          <div className="rounded-lg border px-3 py-2 text-xs badge-warning">{panelError}</div>
        ) : null}

        {providerDefinitions.map((provider) => {
          const requiresApiKey = providerRequiresApiKey(provider.id);
          const credentialProviderId = requiresApiKey
            ? (provider.id as CredentialProviderId)
            : null;
          const status = apiKeyStatuses[provider.id] ?? {
            configured: false,
            lastCheckedAt: null,
            error: null,
          };
          const isBusy = rowActions[provider.id] !== "idle";

          const statusLabel = requiresApiKey
            ? status.configured ? t("Ready") : t("Missing key")
            : status.lastCheckedAt === null
              ? t("Not checked")
              : status.configured ? t("Available") : t("Unavailable");

          const statusClasses = requiresApiKey
            ? status.configured ? "badge-success" : "badge-neutral"
            : status.lastCheckedAt === null
              ? "badge-neutral"
              : status.configured ? "badge-info" : "badge-error";

          const feedback =
            feedbackMessages[provider.id] ??
            status.error ??
            (requiresApiKey
              ? status.lastCheckedAt
                ? `Checked ${status.lastCheckedAt}`
                : t("Missing key")
              : status.lastCheckedAt
                ? status.configured
                  ? `Runtime detected at ${provider.connectionHint?.match(/http:\/\/[^\s]+/u)?.[0] ?? "the local endpoint"}.`
                  : "No local runtime responded on the expected Ollama endpoint."
                : "Run a refresh to check the local runtime.");

          return (
            <section
              key={provider.id}
              id={getProviderAccessSectionId(provider.id)}
              tabIndex={-1}
              className="rounded-lg border border-border/50 bg-background/75 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{provider.label}</h3>
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${statusClasses}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{provider.description}</p>
                </div>
                {isRefreshing ? (
                  <LoaderCircle className="mt-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Refreshing provider statuses" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                )}
              </div>

              {requiresApiKey ? (
                <div className="mt-3 grid gap-2">
                  <label className="text-xs font-medium" htmlFor={`api-key-${provider.id}`}>
                    {t("API key")}
                  </label>
                  <Input
                    id={`api-key-${provider.id}`}
                    type="password"
                    value={inputValues[provider.id]}
                    onChange={(event) => handleInputChange(provider.id, event.target.value)}
                    placeholder={provider.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isBusy}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={isBusy} onClick={() => void handleSave(credentialProviderId!)}>
                      {rowActions[provider.id] === "saving" ? t("Saving...") : t("Save key")}
                    </Button>
                    <Button variant="outline" size="sm" disabled={isBusy} onClick={() => void handleDelete(credentialProviderId!)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {rowActions[provider.id] === "deleting" ? t("Removing...") : t("Remove key")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                  <p className="text-xs font-medium">{t("Connection")}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{provider.connectionHint}</p>
                </div>
              )}

              <p className="mt-2 text-xs leading-5 text-muted-foreground">{feedback}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
