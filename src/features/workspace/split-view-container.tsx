import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronUp, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Sparkles, Waypoints } from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import type { ModelRun, SynthesisReport, CandidateModelOutput, JudgeModelOutput } from "@/schema";

function renderList(items: string[], t: (key: string) => string) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{t("No items yet.")}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-lg border border-border/50 bg-background/80 px-4 py-2.5 text-sm leading-6"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ─────  Accordion Section  ───── */

function AccordionSection({
  icon,
  title,
  count,
  defaultOpen = false,
  forceOpen = false,
  accentColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen || forceOpen);

  const effectiveOpen = forceOpen || isOpen;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-accent/30 group"
      >
        <span className={`transition-transform duration-200 ${effectiveOpen ? "rotate-90" : ""}`}>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </span>
        <span className={accentColor ?? "text-muted-foreground"}>{icon}</span>
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accentColor ?? "text-muted-foreground"}`}>
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[9px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 font-mono">
            {count}
          </span>
        )}
      </button>
      {effectiveOpen && (
        <div className="pl-5 pt-2 pb-1 animate-in slide-in-from-top-1 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function ParsedCandidate({ parsed }: { parsed: CandidateModelOutput }) {
  return (
    <div className="font-sans text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
      <p>{parsed.summary}</p>
    </div>
  );
}

function ParsedJudge({ parsed }: { parsed: JudgeModelOutput }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 font-sans text-sm">
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{t("Final Decision")}</div>
        <div className="font-medium text-foreground">{parsed.chosenApproach}</div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{t("Rationale")}</div>
        <p className="text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3">{parsed.rationale}</p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
        <p>{parsed.summary}</p>
      </div>
    </div>
  );
}

function ModelPanel({ run, onMinimize }: { run: ModelRun; onMinimize: () => void }) {
  const { t } = useTranslation();
  const { developerMode } = useSettingsStore();
  const [showRaw, setShowRaw] = useState(true);
  
  const effectiveShowRaw = developerMode && showRaw;
  const isCandidate = run.parsed?.outputType === "candidate";
  const isJudge = run.parsed?.outputType === "judge";

  return (
    <div className="flex flex-col h-full w-[400px] min-w-[400px] shrink-0 rounded-xl border border-border/40 bg-surface-container-low shadow-sm overflow-hidden relative snap-center">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-surface-container object-contain">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <Bot className="h-3 w-3" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary truncate">{run.role}</div>
              {developerMode && (
                <button 
                  onClick={() => setShowRaw(!showRaw)}
                  className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase transition-all select-none ${
                    showRaw 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground border border-border/30"
                  }`}
                  title={showRaw ? t("Switch to Parsed View") as string : t("Switch to JSON View") as string}
                >
                  {showRaw ? "JSON" : "Parsed"}
                </button>
              )}
            </div>
            <div className="text-[9px] text-muted-foreground font-mono truncate">{run.provider} / {run.model}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-1 hover:bg-accent rounded text-muted-foreground transition-colors" title={t("Minimize to PIP") as string} onClick={onMinimize}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-4 leading-relaxed ${effectiveShowRaw ? "whitespace-pre-wrap font-mono text-on-surface-variant bg-surface-container-lowest/50 text-xs" : "text-sm"}`}>
        {run.error ? (
          <div className="text-destructive font-sans font-medium mb-3 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-4 w-4 mb-1 inline mr-2" />
            {run.error.message}
          </div>
        ) : null}

        {effectiveShowRaw ? (
          run.rawText || t("No content available.")
        ) : (
          <>
            {run.status === "running" && (
              <div className="flex items-center gap-2 text-muted-foreground italic animate-pulse">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Model is thinking...")}
              </div>
            )}
            {run.status === "completed" && run.parsed && (
              <>
                {isCandidate && <ParsedCandidate parsed={run.parsed as CandidateModelOutput} />}
                {isJudge && <ParsedJudge parsed={run.parsed as JudgeModelOutput} />}
              </>
            )}
            {run.status === "completed" && !run.parsed && (
              <div className="text-muted-foreground italic">
                {t("Results are being integrated into the synthesis report.")}
              </div>
            )}
            {run.status === "failed" && !run.error && (
              <div className="text-destructive">
                {t("An unknown error occurred during execution.")}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer / Meta */}
      <div className="px-3 py-2 border-t border-border/20 bg-surface-container text-[9px] uppercase tracking-widest font-mono text-muted-foreground flex justify-between">
        <span>{run.latencyMs ?? 0}ms</span>
        <span>{run.usage.totalTokens ?? 0} {t("TOKENS")}</span>
      </div>
    </div>
  );
}

function PipDock({ 
  runs, 
  onRestore 
}: { 
  runs: ModelRun[]; 
  onRestore: (runId: string) => void;
}) {
  if (runs.length === 0) return null;

  return (
    <div className="absolute right-4 top-20 flex flex-col gap-2 z-40 pointer-events-none">
      {runs.map(run => (
        <button
          key={run.id}
          onClick={() => onRestore(run.id)}
          className="pointer-events-auto flex items-center gap-3 w-48 bg-surface-container-high/90 backdrop-blur border border-border/40 shadow-xl rounded-lg p-2 hover:bg-accent transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">{run.role}</div>
            <div className="text-[9px] text-muted-foreground font-mono truncate">{run.model}</div>
          </div>
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      ))}
    </div>
  );
}

export function SynthesisReportSplitView({ report }: { report: SynthesisReport }) {
  const { t } = useTranslation();
  const [minimizedIds, setMinimizedIds] = useState<Set<string>>(new Set());

  const activeRuns = useMemo(() => {
    return report.modelRuns.filter(r => !minimizedIds.has(r.id));
  }, [report.modelRuns, minimizedIds]);

  const pipRuns = useMemo(() => {
    return report.modelRuns.filter(r => minimizedIds.has(r.id));
  }, [report.modelRuns, minimizedIds]);

  const handleMinimize = (id: string) => {
    setMinimizedIds(prev => new Set([...prev, id]));
  };

  const handleRestore = (id: string) => {
    setMinimizedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const hasConflicts = report.conflicts.length > 0;
  const consensusCount = report.consensus?.items.length ?? 0;
  const conflictCount = report.conflicts.length;
  const nextActionCount = report.nextActions?.length ?? 0;

  return (
    <div className="h-full w-full flex flex-col relative">
      <PipDock runs={pipRuns} onRestore={handleRestore} />
      
      <div className="flex-1 w-full overflow-x-auto flex gap-4 p-4 snap-x snap-mandatory">
        {/* Synthesis Dashboard Panel (Summary, Conflicts, etc) — now with accordion */}
        <div className="flex flex-col h-full w-[400px] min-w-[400px] shrink-0 rounded-xl border border-primary/20 bg-primary/5 shadow-sm overflow-hidden snap-center">
          <div className="px-4 py-3 border-b border-primary/10 bg-primary/10 font-bold text-xs uppercase tracking-widest text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> 
            {t("Synthesis Report")}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Summary — default OPEN */}
            <AccordionSection
              icon={<Sparkles className="h-3 w-3" />}
              title={t("Summary")}
              defaultOpen={true}
              accentColor="text-primary"
            >
              <div className="text-sm leading-relaxed">{report.summary}</div>
            </AccordionSection>

            {/* Consensus — default CLOSED */}
            {report.consensus && report.consensus.items.length > 0 && (
              <AccordionSection
                icon={<Waypoints className="h-3 w-3" />}
                title={t("Consensus")}
                count={consensusCount}
                accentColor="text-primary"
              >
                <div className="text-sm text-muted-foreground mb-2">{report.consensus.summary}</div>
                <ul className="space-y-2">
                  {report.consensus.items.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs leading-6">
                      <div className="font-medium">{item.statement}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
                        {item.kind} · {item.confidence} {t("confidence")} · {item.supportingRunIds.length} {t("supporting runs")}
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionSection>
            )}
            
            {/* Conflicts — auto-OPEN when present */}
            {report.conflicts.length > 0 && (
              <AccordionSection
                icon={<AlertTriangle className="h-3 w-3" />}
                title={t("Conflicts Detected")}
                count={conflictCount}
                forceOpen={hasConflicts}
                accentColor="text-destructive"
              >
                <div className="space-y-3">
                  {report.conflicts.map(c => (
                    <div key={c.id} className="breathing-critical p-3 rounded-lg bg-background border border-destructive/30 text-xs">
                      <div className="font-semibold text-destructive mb-1">{c.title}</div>
                      <div className="text-muted-foreground leading-relaxed">{c.summary}</div>
                      <div className="mt-2 text-sm font-medium">{c.question}</div>
                      <ul className="mt-2 space-y-2">
                        {c.positions.map((position) => (
                          <li key={`${c.id}-${position.modelRunId}`} className="rounded-md border border-border/50 bg-card/60 px-2 py-1.5 text-xs">
                            <div className="font-medium">{position.label}</div>
                            <div className="mt-0.5">{position.stance}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Resolution — default CLOSED */}
            {report.resolution && (
              <AccordionSection
                icon={<Bot className="h-3 w-3" />}
                title={t("Resolution")}
                accentColor="text-primary"
              >
                <div className="rounded-lg border border-border/50 bg-background/80 p-3 text-xs">
                  <div className="font-medium">{report.resolution.chosenApproach}</div>
                  <p className="mt-2 text-muted-foreground">{report.resolution.rationale}</p>
                </div>
                {report.resolution.openRisks.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Open risks")}</div>
                    {renderList(report.resolution.openRisks, t)}
                  </div>
                ) : null}
              </AccordionSection>
            )}

            {/* Next Actions — default CLOSED */}
            {report.nextActions && report.nextActions.length > 0 && (
              <AccordionSection
                icon={<Sparkles className="h-3 w-3" />}
                title={t("Next actions")}
                count={nextActionCount}
                accentColor="text-primary"
              >
                {renderList(report.nextActions, t)}
              </AccordionSection>
            )}

          </div>
        </div>

        {/* Model Execution Panels */}
        {activeRuns.map((run) => (
          <ModelPanel key={run.id} run={run} onMinimize={() => handleMinimize(run.id)} />
        ))}
        
        {/* Fill empty space if few models so it aligns well */}
        <div className="w-8 shrink-0" />
      </div>
    </div>
  );
}
