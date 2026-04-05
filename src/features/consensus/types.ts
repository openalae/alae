import type { LanguageModel } from "ai";

import type { SupportedProviderId } from "@/features/settings/providers";
import type {
  CandidateMode,
  CandidateModelOutput,
  ConflictPoint,
  ConsensusItem,
  JudgeModelOutput,
  JudgeStatus,
  ModelRun,
  ReportStage,
  Resolution,
  SynthesisReport,
  TraceEvent,
  TraceLevel,
  TruthPanelSnapshot,
} from "@/schema";

export const synthesisPresetIds = ["single", "dual", "crossVendorDefault", "freeDefault"] as const;
export const synthesisSlotIds = ["strong", "fast-1", "fast-2", "judge"] as const;

export type SynthesisPresetId = (typeof synthesisPresetIds)[number];
export type SynthesisSlotId = (typeof synthesisSlotIds)[number];
export type SynthesisMode = "mock" | "real";
export type SynthesisOutputType = "candidate" | "judge";
export type JudgeMode = "auto" | "manual";

export type SynthesisModelSlot = {
  id: SynthesisSlotId;
  provider: SupportedProviderId;
  modelId: string;
  role: "strong" | "fast" | "judge";
  outputType: SynthesisOutputType;
};

export type ExecutionPlanSource =
  | {
      kind: "preset";
      presetId: SynthesisPresetId;
    }
  | {
      kind: "custom";
      label: string | null;
    };

export type ExecutionPlan = {
  version: 1;
  candidateSlots: readonly SynthesisModelSlot[];
  judgeSlot: SynthesisModelSlot | null;
  conflictMode: JudgeMode;
  source: ExecutionPlanSource;
};

export type SynthesisPreset = {
  id: SynthesisPresetId;
  slots: readonly SynthesisModelSlot[];
};

export type RunSynthesisInput = {
  prompt: string;
  mode: SynthesisMode;
  presetId?: SynthesisPresetId;
  executionPlan?: ExecutionPlan;
  judgeMode?: JudgeMode;
  language?: string;
};

/** Used to run only the judge step on an already-completed set of candidate runs. */
export type RunJudgeOnlyInput = {
  prompt: string;
  mode: SynthesisMode;
  candidateRuns: ModelRun[];
  presetId?: SynthesisPresetId;
  executionPlan?: ExecutionPlan;
  language?: string;
};

export type RealProviderFactory = (modelId: string, apiKey: string) => LanguageModel;
export type RealProviderRegistry = Record<SupportedProviderId, RealProviderFactory>;
export type MockRegistry = Partial<Record<SynthesisSlotId, LanguageModel>>;

export type RunSynthesisOptions = {
  generateId?: () => string;
  currentDate?: () => Date;
  mockRegistry?: MockRegistry;
  realRegistry?: Partial<RealProviderRegistry>;
  readApiKey?: (provider: SupportedProviderId) => Promise<string | null>;
};

export type SynthesisExecutionResult = {
  report: SynthesisReport;
  truthPanelSnapshot: TruthPanelSnapshot;
};

export type CompletedCandidateRun = ModelRun & {
  status: "completed";
  parsed: CandidateModelOutput;
  error: null;
};

export type CompletedJudgeRun = ModelRun & {
  status: "completed";
  parsed: JudgeModelOutput;
  error: null;
};

export type SlotExecution = {
  slot: SynthesisModelSlot;
  run: ModelRun;
};

export type TraceEventKind =
  | "started"
  | "completed"
  | "failed"
  | "missing-key"
  | "fallback-resolution";

export type TraceEventDescriptor = {
  kind: TraceEventKind;
  level: TraceLevel;
  slotId?: SynthesisSlotId;
  occurredAt: string;
  message: string;
};

export type ConsensusExtractionOptions = {
  generateId?: () => string;
};

export type ConflictExtractionOptions = {
  generateId?: () => string;
};

export type BuildTruthPanelSnapshotInput = {
  runs: ModelRun[];
  reportId: string | null;
  generatedAt: string;
  events: TraceEvent[];
};

export type BuildTraceEventsInput = {
  slotExecutions: SlotExecution[];
  generatedAt: string;
  generateId?: () => string;
  usedFallbackResolution: boolean;
};

export type BuildResolutionFromJudgeInput = {
  judgeRun: CompletedJudgeRun;
  conflicts: ConflictPoint[];
};

export type BuildCandidateResolutionInput = {
  sourceRun: CompletedCandidateRun;
};

export type BuildFallbackResolutionInput = {
  sourceRun: CompletedCandidateRun;
  conflicts: ConflictPoint[];
};

export type BuildReportInput = {
  id: string;
  prompt: string;
  summary: string;
  status: SynthesisReport["status"];
  candidateMode: CandidateMode;
  pendingJudge: boolean;
  reportStage: ReportStage;
  judgeStatus: JudgeStatus;
  executionPlan: ExecutionPlan | null;
  consensusItems: ConsensusItem[];
  successfulCandidateCount: number;
  conflicts: ConflictPoint[];
  resolution: Resolution | null;
  nextActions: string[];
  modelRuns: ModelRun[];
  createdAt: string;
};
