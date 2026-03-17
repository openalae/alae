import {
  ArrowUpRight,
  KeyRound,
  LayoutPanelTop,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProviderAccessCard } from "@/features/settings";

const installedStack = [
  "Tauri 2 + Rust shell",
  "React 19 + Vite + TypeScript",
  "Tailwind v4 + shadcn base",
  "Zod schema contracts + Zustand slices",
  "Native secure-store bridge",
  "Vitest + React Testing Library",
];

const queuedModules = [
  "PGLite conversation tree",
  "Consensus orchestration",
  "Progressive workspace",
  "Truth panel telemetry",
];

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 py-8 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Phase 1 MVP
          </div>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance lg:text-6xl">
              Alae now secures provider access in the desktop shell.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
              Modules 1 through 4 are in place: scaffold, schema contracts, global state,
              and native API key management. The next round can connect local storage
              without revisiting security boundaries.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current module
            </div>
            <div className="mt-2 text-lg font-semibold">04. Secure API Key Bridge</div>
          </div>
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Target surface
            </div>
            <div className="mt-2 text-lg font-semibold">Desktop shell + secure providers</div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-6 py-8 xl:grid-cols-[minmax(0,1.65fr)_380px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-card/85">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <LayoutPanelTop className="h-5 w-5 text-primary" />
                  Workspace Foundation
                </CardTitle>
                <CardDescription>
                  The shell stays focused on MVP foundations while native credential storage
                  is wired end to end.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled>
                Module 4 complete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-[1.5rem] border border-border/70 bg-background/75 p-5">
              <div className="text-sm font-medium text-muted-foreground">Installed foundation</div>
              <ul className="mt-4 grid gap-3">
                {installedStack.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.5rem] border border-dashed border-border/80 bg-card/60 p-5">
              <div className="text-sm font-medium text-muted-foreground">Queued MVP modules</div>
              <ul className="mt-4 space-y-3 text-sm text-foreground">
                {queuedModules.map((item, index) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {index + 5}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </CardContent>
          <CardFooter className="border-t border-border/70 pt-6">
            <Button variant="default" disabled>
              PGLite conversation tree next
            </Button>
            <Button variant="ghost" disabled>
              Native credentials wired and verified
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <ProviderAccessCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Truth Panel Stub
              </CardTitle>
              <CardDescription>
                This column still reserves the final Phase 1 inspector surface while model
                telemetry and trace data remain out of scope for module 4.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Runtime
                </div>
                <div className="mt-3 text-sm font-medium">Awaiting multi-model orchestration</div>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Token telemetry
                </div>
                <div className="mt-3 text-sm font-medium">Pending model run records</div>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Validation traces
                </div>
                <div className="mt-3 text-sm font-medium">Pending Zod contracts</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/15 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <KeyRound className="h-5 w-5 text-primary" />
                Security boundary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Only provider configuration state lives in Zustand.</p>
              <p>Raw API keys stay in the OS secure store and are fetched on demand only.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
