import {
  CandidateModelOutputSchema,
  ConflictPointSchema,
  ConversationBranchSchema,
  ConversationNodeSchema,
  ModelRunSchema,
  SynthesisReportSchema,
  TruthPanelSnapshotSchema,
  type CandidateModelOutput,
  type ConversationBranch,
  type ConversationNode,
  type JudgeModelOutput,
  type ModelRun,
  type SynthesisReport,
  type TruthPanelSnapshot,
} from "@/schema";

const baseTimestamp = "2026-03-17T09:00:00Z";
const completedTimestamp = "2026-03-17T09:01:00Z";
const generatedTimestamp = "2026-03-17T09:02:00Z";

const candidateOutput: CandidateModelOutput = {
  outputType: "candidate",
  summary: "The fast model converges on a typed schema-first approach.",
  consensusItems: [
    {
      kind: "approach",
      statement: "Define Zod contracts before implementing orchestration logic.",
      confidence: "high",
    },
  ],
  conflictObservations: [
    {
      title: "Resolution placement",
      summary: "One model suggests always returning a resolution object.",
      category: "approach",
      severity: "medium",
      question: "Should failed reports allow a null resolution?",
      stance: "Allow null only for failed reports.",
    },
  ],
  recommendedActions: ["Create domain schema files first."],
};

const judgeOutput: JudgeModelOutput = {
  outputType: "judge",
  summary: "Failed reports should not force a synthetic resolution object.",
  chosenApproach: "Keep resolution nullable only for failed reports.",
  rationale: "This preserves a stable key without inventing content.",
  resolvedConflictIds: ["conflict-resolution-nullability"],
  openRisks: ["Judge outputs still need runtime prompt tuning later."],
};

const completedCandidateRun: ModelRun = {
  id: "run-strong-1",
  provider: "openai",
  model: "gpt-5.4",
  role: "strong",
  status: "completed",
  startedAt: baseTimestamp,
  completedAt: completedTimestamp,
  latencyMs: 900,
  usage: {
    inputTokens: 320,
    outputTokens: 180,
    totalTokens: 500,
  },
  rawText: "Structured schema output",
  parsed: candidateOutput,
  validation: {
    status: "passed",
    issues: [],
  },
  error: null,
};

const completedJudgeRun: ModelRun = {
  id: "run-judge-1",
  provider: "anthropic",
  model: "claude-judge",
  role: "judge",
  status: "completed",
  startedAt: baseTimestamp,
  completedAt: completedTimestamp,
  latencyMs: 1100,
  usage: {
    inputTokens: 210,
    outputTokens: 140,
    totalTokens: 350,
  },
  rawText: "Judge output",
  parsed: judgeOutput,
  validation: {
    status: "passed",
    issues: [],
  },
  error: null,
};

const failedFastRun: ModelRun = {
  id: "run-fast-1",
  provider: "openai",
  model: "gpt-5.4-mini",
  role: "fast",
  status: "failed",
  startedAt: baseTimestamp,
  completedAt: completedTimestamp,
  latencyMs: null,
  usage: {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  },
  rawText: null,
  parsed: null,
  validation: {
    status: "failed",
    issues: [
      {
        runId: "run-fast-1",
        path: ["parsed"],
        message: "Provider returned invalid JSON.",
        severity: "error",
      },
    ],
  },
  error: {
    message: "Provider timeout",
    code: "TIMEOUT",
    retryable: true,
  },
};

const readyReport: SynthesisReport = {
  id: "report-ready-1",
  prompt: "Design the schema layer for Phase 1.",
  summary: "The report converges on strict domain schemas and a nullable failed resolution.",
  status: "ready",
  consensus: {
    summary: "The schema layer should be the single type source of truth.",
    items: [
      {
        id: "consensus-schema-barrel",
        kind: "approach",
        statement: "Re-export every schema and infer type from a single barrel file.",
        confidence: "high",
        supportingRunIds: ["run-strong-1", "run-judge-1"],
      },
    ],
  },
  conflicts: [
    {
      id: "conflict-resolution-nullability",
      title: "Resolution nullability",
      summary: "Models disagree on whether failed reports should synthesize a resolution.",
      category: "approach",
      severity: "medium",
      question: "Should failed reports require a resolution object?",
      positions: [
        {
          modelRunId: "run-strong-1",
          label: "Strong model",
          stance: "Require a resolution object for every report.",
          evidence: "A stable object simplifies UI rendering.",
        },
        {
          modelRunId: "run-judge-1",
          label: "Judge model",
          stance: "Allow null for failed reports only.",
          evidence: "Do not fabricate content for failed runs.",
        },
      ],
    },
  ],
  resolution: {
    summary: "Failed reports may keep a null resolution, all other reports must resolve conflicts.",
    rationale: "This keeps the report shape stable without inventing unavailable content.",
    chosenApproach: "Nullable resolution only for failed reports.",
    resolvedConflictIds: ["conflict-resolution-nullability"],
    judgeModelRunId: "run-judge-1",
    openRisks: ["Provider-specific parsed payloads will need further tuning in Module 6."],
  },
  nextActions: ["Implement schema files before touching state or orchestration."],
  modelRuns: [completedCandidateRun, completedJudgeRun],
  createdAt: generatedTimestamp,
};

const partialReport: SynthesisReport = {
  ...readyReport,
  id: "report-partial-1",
  status: "partial",
  modelRuns: [completedCandidateRun, failedFastRun, completedJudgeRun],
};

const failedReport: SynthesisReport = {
  id: "report-failed-1",
  prompt: "Design the schema layer for Phase 1.",
  summary: "Every run failed before a usable synthesis report could be assembled.",
  status: "failed",
  consensus: {
    summary: "No reliable consensus was extracted.",
    items: [],
  },
  conflicts: [],
  resolution: null,
  nextActions: ["Retry the job once the provider issue is resolved."],
  modelRuns: [failedFastRun],
  createdAt: generatedTimestamp,
};

const rootNode: ConversationNode = {
  id: "node-root-1",
  conversationId: "conversation-1",
  branchId: "branch-main-1",
  parentNodeId: null,
  title: "Schema design kickoff",
  prompt: readyReport.prompt,
  status: "completed",
  synthesisReport: readyReport,
  createdAt: baseTimestamp,
  updatedAt: generatedTimestamp,
};

const childNode: ConversationNode = {
  ...rootNode,
  id: "node-child-1",
  parentNodeId: "node-root-1",
  title: "Follow-up schema refinement",
  prompt: "Tighten the truth panel snapshot contract.",
};

const mainBranch: ConversationBranch = {
  id: "branch-main-1",
  conversationId: "conversation-1",
  name: "main",
  sourceNodeId: null,
  rootNodeId: "node-root-1",
  headNodeId: "node-child-1",
  createdAt: baseTimestamp,
  updatedAt: generatedTimestamp,
};

const forkBranch: ConversationBranch = {
  ...mainBranch,
  id: "branch-fork-1",
  name: "resolution-nullability-fork",
  sourceNodeId: "node-root-1",
};

const truthPanelSnapshot: TruthPanelSnapshot = {
  reportId: readyReport.id,
  generatedAt: generatedTimestamp,
  runSummary: {
    totalRuns: 2,
    pendingRuns: 0,
    runningRuns: 0,
    completedRuns: 2,
    failedRuns: 0,
    aggregateInputTokens: 530,
    aggregateOutputTokens: 320,
    aggregateTotalTokens: 850,
    aggregateLatencyMs: 2000,
    maxLatencyMs: 1100,
  },
  runs: [completedCandidateRun, completedJudgeRun],
  validationIssues: [],
  events: [
    {
      id: "trace-1",
      scope: "synthesis",
      level: "info",
      message: "Judge resolution completed.",
      occurredAt: generatedTimestamp,
    },
  ],
};

describe("schema barrel", () => {
  it("parses valid module 2 fixtures", () => {
    expect(CandidateModelOutputSchema.parse(candidateOutput)).toEqual(candidateOutput);
    expect(ModelRunSchema.parse(completedCandidateRun)).toEqual(completedCandidateRun);
    expect(SynthesisReportSchema.parse(readyReport)).toEqual(readyReport);
    expect(SynthesisReportSchema.parse(partialReport)).toEqual(partialReport);
    expect(SynthesisReportSchema.parse(failedReport)).toEqual(failedReport);
    expect(ConversationNodeSchema.parse(rootNode)).toEqual(rootNode);
    expect(ConversationNodeSchema.parse(childNode)).toEqual(childNode);
    expect(ConversationBranchSchema.parse(mainBranch)).toEqual(mainBranch);
    expect(ConversationBranchSchema.parse(forkBranch)).toEqual(forkBranch);
    expect(TruthPanelSnapshotSchema.parse(truthPanelSnapshot)).toEqual(truthPanelSnapshot);
  });

  it("rejects malformed conflict points", () => {
    const result = ConflictPointSchema.safeParse({
      ...readyReport.conflicts[0],
      positions: [readyReport.conflicts[0].positions[0]],
    });

    expect(result.success).toBe(false);
  });

  it("rejects completed runs without completedAt", () => {
    const result = ModelRunSchema.safeParse({
      ...completedCandidateRun,
      completedAt: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects failed runs without an error payload", () => {
    const result = ModelRunSchema.safeParse({
      ...failedFastRun,
      error: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects failed reports with a resolution object", () => {
    const result = SynthesisReportSchema.safeParse({
      ...failedReport,
      resolution: readyReport.resolution,
    });

    expect(result.success).toBe(false);
  });

  it("rejects reports that reference unknown resolved conflict ids", () => {
    const result = SynthesisReportSchema.safeParse({
      ...readyReport,
      resolution: {
        ...readyReport.resolution!,
        resolvedConflictIds: ["missing-conflict-id"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects completed nodes without report snapshots", () => {
    const result = ConversationNodeSchema.safeParse({
      ...rootNode,
      synthesisReport: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects inconsistent branch roots and heads", () => {
    const result = ConversationBranchSchema.safeParse({
      ...mainBranch,
      rootNodeId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects truth panel snapshots whose run summary does not match runs", () => {
    const result = TruthPanelSnapshotSchema.safeParse({
      ...truthPanelSnapshot,
      runSummary: {
        ...truthPanelSnapshot.runSummary,
        totalRuns: 3,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects truth panel validation issues for unknown runs", () => {
    const result = TruthPanelSnapshotSchema.safeParse({
      ...truthPanelSnapshot,
      validationIssues: [
        {
          runId: "unknown-run",
          path: ["parsed"],
          message: "Unknown issue",
          severity: "error",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown keys and malformed timestamps", () => {
    const result = SynthesisReportSchema.safeParse({
      ...readyReport,
      createdAt: "not-a-timestamp",
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});
