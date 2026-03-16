import { ArrowUpRight, LayoutPanelTop, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const installedStack = [
  "Tauri 2 + Rust shell",
  "React 19 + Vite + TypeScript",
  "Tailwind v4 + shadcn base",
  "Vitest + React Testing Library",
];

const queuedModules = [
  "Schema contracts",
  "Zustand state slices",
  "Secure API key bridge",
  "PGLite conversation tree",
  "Consensus orchestration",
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
              Alae scaffolded for a local-first reasoning workstation.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
              Module 1 is ready: the desktop shell, UI foundation, test tooling, and
              PRD-aligned directories are in place. The next round can start from schema
              contracts instead of boilerplate.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current module
            </div>
            <div className="mt-2 text-lg font-semibold">01. Project Scaffold</div>
          </div>
          <div className="rounded-3xl border border-border/80 bg-card/75 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Target surface
            </div>
            <div className="mt-2 text-lg font-semibold">Center Workspace + Truth Panel</div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-6 py-8 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-card/85">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <LayoutPanelTop className="h-5 w-5 text-primary" />
                  Progressive Workspace Base
                </CardTitle>
                <CardDescription>
                  The default Tauri welcome page is replaced with a product shell that matches
                  the MVP direction without jumping ahead into reasoning logic.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled>
                Module 1 complete
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
                      {index + 2}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </CardContent>
          <CardFooter className="border-t border-border/70 pt-6">
            <Button variant="default" disabled>
              Schema contracts next
            </Button>
            <Button variant="ghost" disabled>
              Native keychain bridge after state setup
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Truth Panel Stub
            </CardTitle>
            <CardDescription>
              This column reserves the final Phase 1 inspector surface without wiring live
              metrics before the synthesis engine exists.
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
      </main>
    </div>
  );
}
