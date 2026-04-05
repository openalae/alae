import {
  SynthesisReportSchema,
  TruthPanelSnapshotSchema,
  TraceEventSchema,
  type ConflictPoint,
  type ConflictSeverity,
  type ConsensusItem,
  type ModelRun,
  type Resolution,
  type TraceEvent,
  type ValidationIssue,
} from "@/schema";
import type {
  BuildFallbackResolutionInput,
  BuildReportInput,
  BuildResolutionFromJudgeInput,
  BuildTraceEventsInput,
  BuildTruthPanelSnapshotInput,
  CompletedCandidateRun,
  CompletedJudgeRun,
  ConflictExtractionOptions,
  ConsensusExtractionOptions,
} from "@/features/consensus/types";

const severityRank: Record<ConflictSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const confidenceRank: Record<ConsensusItem["confidence"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function createDefaultId() {
  return globalThis.crypto.randomUUID();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function maxSeverity(left: ConflictSeverity, right: ConflictSeverity): ConflictSeverity {
  return severityRank[left] >= severityRank[right] ? left : right;
}

function formatRunLabel(run: ModelRun) {
  return `${run.role}:${run.provider}/${run.model}`;
}

function aggregateNullableIntegers(values: Array<number | null>) {
  const presentValues = values.filter((value): value is number => value !== null);
  if (presentValues.length === 0) {
    return null;
  }

  return presentValues.reduce((sum, value) => sum + value, 0);
}

function maxNullableInteger(values: Array<number | null>) {
  const presentValues = values.filter((value): value is number => value !== null);
  if (presentValues.length === 0) {
    return null;
  }

  return Math.max(...presentValues);
}

export function isCompletedCandidateRun(run: ModelRun): run is CompletedCandidateRun {
  return run.status === "completed" && run.parsed?.outputType === "candidate";
}

export function isCompletedJudgeRun(run: ModelRun): run is CompletedJudgeRun {
  return run.status === "completed" && run.parsed?.outputType === "judge";
}

export function extractConsensusItems(
  candidateRuns: ModelRun[],
  options: ConsensusExtractionOptions = {},
): ConsensusItem[] {
  const generateId = options.generateId ?? createDefaultId;
  const successfulRuns = candidateRuns.filter(isCompletedCandidateRun);

  if (successfulRuns.length < 2) {
    return [];
  }

  const groupedItems = new Map<
    string,
    {
      kind: ConsensusItem["kind"];
      statement: string;
      confidence: ConsensusItem["confidence"];
      supportingRunIds: string[];
    }
  >();

  for (const run of successfulRuns) {
    for (const item of run.parsed.consensusItems) {
      const key = `${item.kind}:${normalizeText(item.statement)}`;
      const existingItem = groupedItems.get(key);

      if (!existingItem) {
        groupedItems.set(key, {
          kind: item.kind,
          statement: item.statement,
          confidence: item.confidence,
          supportingRunIds: [run.id],
        });
        continue;
      }

      if (!existingItem.supportingRunIds.includes(run.id)) {
        existingItem.supportingRunIds.push(run.id);
      }

      if (confidenceRank[item.confidence] > confidenceRank[existingItem.confidence]) {
        existingItem.confidence = item.confidence;
      }
    }
  }

  return Array.from(groupedItems.values())
    .filter((item) => item.supportingRunIds.length >= 2)
    .map((item) => ({
      id: `consensus-${generateId()}`,
      kind: item.kind,
      statement: item.statement,
      confidence: item.confidence,
      supportingRunIds: item.supportingRunIds,
    }));
}

export function extractConflictPoints(
  candidateRuns: ModelRun[],
  options: ConflictExtractionOptions = {},
): ConflictPoint[] {
  const generateId = options.generateId ?? createDefaultId;
  const successfulRuns = candidateRuns.filter(isCompletedCandidateRun);
  const groupedConflicts = new Map<
    string,
    {
      title: string;
      summary: string;
      category: ConflictPoint["category"];
      severity: ConflictPoint["severity"];
      question: string;
      positions: ConflictPoint["positions"];
      seenRunIds: Set<string>;
    }
  >();

  for (const run of successfulRuns) {
    for (const observation of run.parsed.conflictObservations) {
      const key = `${observation.category}:${normalizeText(observation.question)}`;
      const existingConflict = groupedConflicts.get(key);

      if (!existingConflict) {
        groupedConflicts.set(key, {
          title: observation.title,
          summary: observation.summary,
          category: observation.category,
          severity: observation.severity,
          question: observation.question,
          positions: [
            {
              modelRunId: run.id,
              label: formatRunLabel(run),
              stance: observation.stance,
              evidence: observation.summary,
            },
          ],
          seenRunIds: new Set([run.id]),
        });
        continue;
      }

      existingConflict.severity = maxSeverity(existingConflict.severity, observation.severity);

      if (!existingConflict.seenRunIds.has(run.id)) {
        existingConflict.positions.push({
          modelRunId: run.id,
          label: formatRunLabel(run),
          stance: observation.stance,
          evidence: observation.summary,
        });
        existingConflict.seenRunIds.add(run.id);
      }
    }
  }

  return Array.from(groupedConflicts.values())
    .filter((conflict) => {
      if (conflict.positions.length < 2) {
        return false;
      }

      const stances = new Set(
        conflict.positions.map((position) => normalizeText(position.stance)),
      );

      return stances.size >= 2;
    })
    .map((conflict) => ({
      id: `conflict-${generateId()}`,
      title: conflict.title,
      summary: conflict.summary,
      category: conflict.category,
      severity: conflict.severity,
      question: conflict.question,
      positions: conflict.positions,
    }));
}

export function buildResolutionFromJudge({
  judgeRun,
  conflicts,
}: BuildResolutionFromJudgeInput): Resolution {
  const knownConflictIds = new Set(conflicts.map((conflict) => conflict.id));

  return {
    summary: judgeRun.parsed.summary,
    rationale: judgeRun.parsed.rationale,
    chosenApproach: judgeRun.parsed.chosenApproach,
    resolvedConflictIds: judgeRun.parsed.resolvedConflictIds.filter((id) =>
      knownConflictIds.has(id),
    ),
    judgeModelRunId: judgeRun.id,
    openRisks: uniqueStrings(judgeRun.parsed.openRisks),
  };
}

export function buildFallbackResolution({
  sourceRun,
  conflicts,
}: BuildFallbackResolutionInput): Resolution {
  const chosenApproach =
    sourceRun.parsed.consensusItems[0]?.statement ?? sourceRun.parsed.summary;
  const openRisks = uniqueStrings(
    conflicts.map(() => `Unresolved conflict: {{question}}`),
  );

  return {
    summary: `Fallback resolution from {{label}}: {{summary}}`,
    rationale: `Judge resolution was unavailable, so the synthesis fell back to {{label}}.`,
    chosenApproach,
    resolvedConflictIds: [],
    judgeModelRunId: sourceRun.id,
    openRisks,
  };
}

export function buildCandidateResolution({
  sourceRun,
}: Pick<BuildFallbackResolutionInput, "sourceRun">): Resolution {
  const chosenApproach =
    sourceRun.parsed.consensusItems[0]?.statement ?? sourceRun.parsed.summary;

  return {
    summary: sourceRun.parsed.summary,
    rationale: "Candidate runs completed without a judge pass.",
    chosenApproach,
    resolvedConflictIds: [],
    judgeModelRunId: sourceRun.id,
    openRisks: [],
  };
}

export function buildConsensusSummary(
  consensusItems: ConsensusItem[],
  successfulCandidateCount: number,
) {
  if (successfulCandidateCount === 0) {
    return "No cross-run consensus is available because no candidate run completed successfully.";
  }

  if (consensusItems.length === 0) {
    return "No consensus items met the 2-of-N threshold across {{count}} successful candidate runs.";
  }

  return "{{itemCount}} consensus item(s) met the 2-of-N threshold across {{runCount}} successful candidate runs.";
}

export function buildNextActions(
  candidateRuns: CompletedCandidateRun[],
  resolution: Resolution | null,
) {
  const candidateActions = candidateRuns.flatMap((run) => run.parsed.recommendedActions);
  const riskActions = resolution?.openRisks ?? [];
  return uniqueStrings([...candidateActions, ...riskActions]);
}

export function buildTraceEvents({
  slotExecutions,
  generatedAt,
  generateId = createDefaultId,
  usedFallbackResolution,
}: BuildTraceEventsInput): TraceEvent[] {
  const events: TraceEvent[] = [];

  const pushEvent = (descriptor: {
    kind: string;
    level: TraceEvent["level"];
    occurredAt: string;
    message: string;
  }) => {
    events.push(
      TraceEventSchema.parse({
        id: `event-${generateId()}`,
        scope: descriptor.kind,
        level: descriptor.level,
        message: descriptor.message,
        occurredAt: descriptor.occurredAt,
      }),
    );
  };

  for (const execution of slotExecutions) {
    const { slot, run } = execution;

    if (run.error?.code === "MISSING_API_KEY") {
      pushEvent({
        kind: `missing-key:${slot.id}`,
        level: "warning",
        occurredAt: run.completedAt ?? run.startedAt,
        message: `Missing API key for {{provider}}; {{id}} was not executed.`,
      });
      continue;
    }

    if (run.error?.code === "SKIPPED_NO_CANDIDATE_SUCCESS") {
      pushEvent({
        kind: `failed:${slot.id}`,
        level: "error",
        occurredAt: run.completedAt ?? run.startedAt,
        message: `{{label}} was skipped because no candidate run completed successfully.`,
      });
      continue;
    }

    pushEvent({
      kind: `started:${slot.id}`,
      level: "info",
      occurredAt: run.startedAt,
      message: `Started {{label}}.`,
    });

    if (run.status === "completed") {
      pushEvent({
        kind: `completed:${slot.id}`,
        level: "info",
        occurredAt: run.completedAt ?? run.startedAt,
        message: `Completed {{label}}.`,
      });
      continue;
    }

    pushEvent({
      kind: `failed:${slot.id}`,
      level: "error",
      occurredAt: run.completedAt ?? run.startedAt,
      message: `{{label}} failed: {{message}}`,
    });
  }

  if (usedFallbackResolution) {
    pushEvent({
      kind: "fallback-resolution",
      level: "warning",
      occurredAt: generatedAt,
      message: "Judge resolution was unavailable; a fallback resolution was used.",
    });
  }

  return events;
}

export function buildTruthPanelSnapshot({
  runs,
  reportId,
  generatedAt,
  events,
}: BuildTruthPanelSnapshotInput) {
  const completedRuns = runs.filter((run) => run.status === "completed");
  const validationIssues = runs.flatMap((run) => run.validation.issues);

  return TruthPanelSnapshotSchema.parse({
    reportId,
    generatedAt,
    runSummary: {
      totalRuns: runs.length,
      pendingRuns: runs.filter((run) => run.status === "pending").length,
      runningRuns: runs.filter((run) => run.status === "running").length,
      completedRuns: completedRuns.length,
      failedRuns: runs.filter((run) => run.status === "failed").length,
      aggregateInputTokens: aggregateNullableIntegers(
        completedRuns.map((run) => run.usage.inputTokens),
      ),
      aggregateOutputTokens: aggregateNullableIntegers(
        completedRuns.map((run) => run.usage.outputTokens),
      ),
      aggregateTotalTokens: aggregateNullableIntegers(
        completedRuns.map((run) => run.usage.totalTokens),
      ),
      aggregateLatencyMs: aggregateNullableIntegers(
        completedRuns.map((run) => run.latencyMs),
      ),
      maxLatencyMs: maxNullableInteger(completedRuns.map((run) => run.latencyMs)),
    },
    runs,
    validationIssues,
    events,
  });
}

export function buildSynthesisReport(input: BuildReportInput) {
  return SynthesisReportSchema.parse({
    id: input.id,
    prompt: input.prompt,
    summary: input.summary,
    status: input.status,
    candidateMode: input.candidateMode,
    pendingJudge: input.pendingJudge,
    reportStage: input.reportStage,
    judgeStatus: input.judgeStatus,
    executionPlan: input.executionPlan,
    consensus: {
      summary: buildConsensusSummary(input.consensusItems, input.successfulCandidateCount),
      items: input.consensusItems,
    },
    conflicts: input.conflicts,
    resolution: input.resolution,
    nextActions: input.nextActions,
    modelRuns: input.modelRuns,
    createdAt: input.createdAt,
  });
}

export function flattenValidationIssues(runs: ModelRun[]) {
  return runs.flatMap((run) => run.validation.issues);
}

export function createDefaultFailureSummary() {
  return "Synthesis failed because no candidate model produced a valid structured analysis.";
}

export function createValidationIssue(
  runId: string,
  path: string[],
  message: string,
): ValidationIssue {
  return {
    runId,
    path: path.length > 0 ? path : ["output"],
    message,
    severity: "error",
  };
}
