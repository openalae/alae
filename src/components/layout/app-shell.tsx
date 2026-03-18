import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";
import { ProviderAccessCard } from "@/features/settings";
import { TruthPanel } from "@/features/truth-panel";
import { ProgressiveWorkspace } from "@/features/workspace";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unable to refresh provider access state.";
}

export function AppShell() {
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(true);
  const [providerPanelError, setProviderPanelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    refreshApiKeyStatuses()
      .catch((error) => {
        if (active) {
          setProviderPanelError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setIsRefreshingProviders(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col px-6 py-8 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Phase 1 MVP
          </div>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-balance lg:text-6xl">
              Alae now closes the full Phase 1 loop with local conversation recovery.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
              Module 9 wires the MVP end to end: submit a prompt, persist the resulting node into
              the reasoning tree, and restore the latest local conversation into the center
              workspace and right-side truth panel on startup.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current module
            </div>
            <div className="mt-2 text-lg font-semibold">09. Phase 1 End-to-End Hardening</div>
          </div>
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Diagnostic focus
            </div>
            <div className="mt-2 text-lg font-semibold">Persistence, recovery, and report continuity</div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-6 py-8 xl:grid-cols-[minmax(0,1.95fr)_320px]">
        <ProgressiveWorkspace />

        <div className="space-y-5">
          <ProviderAccessCard
            isRefreshing={isRefreshingProviders}
            panelError={providerPanelError}
          />
          <TruthPanel />
        </div>
      </main>
    </div>
  );
}
