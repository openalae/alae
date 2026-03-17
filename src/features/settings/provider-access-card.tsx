import { useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  providerDefinitions,
  type SupportedProviderId,
} from "@/features/settings/providers";
import {
  refreshApiKeyStatuses,
  removeApiKey,
  saveApiKey,
} from "@/features/settings/api-key-bridge";
import { useAppStore } from "@/store";

type ProviderAction = "idle" | "saving" | "deleting";

function buildProviderRecord<TValue>(factory: () => TValue): Record<SupportedProviderId, TValue> {
  return {
    openai: factory(),
    anthropic: factory(),
    google: factory(),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected secure store error.";
}

export function ProviderAccessCard() {
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
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    refreshApiKeyStatuses()
      .catch((error) => {
        if (active) {
          setPanelError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setIsRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const setFeedbackMessage = (provider: SupportedProviderId, message: string | null) => {
    setFeedbackMessages((current) => ({
      ...current,
      [provider]: message,
    }));
  };

  const setRowAction = (provider: SupportedProviderId, action: ProviderAction) => {
    setRowActions((current) => ({
      ...current,
      [provider]: action,
    }));
  };

  const handleInputChange = (provider: SupportedProviderId, value: string) => {
    setInputValues((current) => ({
      ...current,
      [provider]: value,
    }));
    setFeedbackMessage(provider, null);
  };

  const handleSave = async (provider: SupportedProviderId) => {
    if (!inputValues[provider].trim()) {
      setFeedbackMessage(provider, "API key is required.");
      return;
    }

    setPanelError(null);
    setRowAction(provider, "saving");

    try {
      await saveApiKey(provider, inputValues[provider]);

      setInputValues((current) => ({
        ...current,
        [provider]: "",
      }));
      setFeedbackMessage(provider, "Saved to secure store.");
    } catch (error) {
      setFeedbackMessage(provider, getErrorMessage(error));
    } finally {
      setRowAction(provider, "idle");
    }
  };

  const handleDelete = async (provider: SupportedProviderId) => {
    setPanelError(null);
    setRowAction(provider, "deleting");

    try {
      await removeApiKey(provider);

      setInputValues((current) => ({
        ...current,
        [provider]: "",
      }));
      setFeedbackMessage(provider, "Removed from secure store.");
    } catch (error) {
      setFeedbackMessage(provider, getErrorMessage(error));
    } finally {
      setRowAction(provider, "idle");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-primary" />
          Provider Access
        </CardTitle>
        <CardDescription>
          API keys stay in the native secure store. The app only tracks configuration
          status in memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {panelError ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            {panelError}
          </div>
        ) : null}

        {providerDefinitions.map((provider) => {
          const status = apiKeyStatuses[provider.id] ?? {
            configured: false,
            lastCheckedAt: null,
            error: null,
          };
          const isBusy = rowActions[provider.id] !== "idle";
          const statusLabel = status.configured ? "Configured" : "Not configured";
          const statusClasses = status.configured
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
            : "border-border/80 bg-background/70 text-muted-foreground";
          const feedback =
            feedbackMessages[provider.id] ??
            status.error ??
            (status.lastCheckedAt
              ? `Last checked ${status.lastCheckedAt}`
              : "No secure credential stored yet.");

          return (
            <section
              key={provider.id}
              className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold">{provider.label}</h3>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusClasses}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{provider.description}</p>
                </div>
                {isRefreshing ? (
                  <LoaderCircle
                    className="mt-1 h-4 w-4 animate-spin text-muted-foreground"
                    aria-label="Refreshing provider statuses"
                  />
                ) : (
                  <ShieldCheck className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-sm font-medium" htmlFor={`api-key-${provider.id}`}>
                  API key
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

                <div className="flex flex-wrap gap-3">
                  <Button disabled={isBusy} onClick={() => void handleSave(provider.id)}>
                    {rowActions[provider.id] === "saving" ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => void handleDelete(provider.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {rowActions[provider.id] === "deleting" ? "Removing..." : "Delete"}
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">{feedback}</p>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
