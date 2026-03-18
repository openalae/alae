import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { refreshApiKeyStatuses } from "@/features/settings/api-key-bridge";
import { ProviderAccessCard } from "@/features/settings";
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
              Alae now centers execution on a progressive synthesis workspace.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
              Module 7 replaces the shell placeholder with a real center-column workflow:
              compose a prompt, run synthesis in `Auto`, and keep raw model output behind
              deliberate drill-down disclosure.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current module
            </div>
            <div className="mt-2 text-lg font-semibold">07. Progressive Workspace</div>
          </div>
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Runtime mode
            </div>
            <div className="mt-2 text-lg font-semibold">Auto: real when fully configured</div>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Truth Panel Preview
              </CardTitle>
              <CardDescription>
                Module 8 will consume the stored truth snapshot and render runtime telemetry in
                this rail. Module 7 only reserves the surface and keeps the focus on the center
                report.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Run summary
                </div>
                <div className="mt-3 text-sm font-medium">Pending snapshot visualization</div>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Token telemetry
                </div>
                <div className="mt-3 text-sm font-medium">Pending aggregate token charts</div>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Trace events
                </div>
                <div className="mt-3 text-sm font-medium">Pending validation and runtime trace UI</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/15 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <KeyRound className="h-5 w-5 text-primary" />
                Provider boundary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>API keys remain in the OS secure store and never enter Zustand.</p>
              <p>The workspace only inspects provider configuration status to decide real vs mock execution.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
