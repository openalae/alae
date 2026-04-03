import type {
  CompletedCandidateRun,
  SynthesisModelSlot,
} from "@/features/consensus/types";
import type { ConflictPoint, ConsensusItem } from "@/schema";

function buildRunDigest(run: CompletedCandidateRun) {
  return {
    runId: run.id,
    provider: run.provider,
    model: run.model,
    role: run.role,
    summary: run.parsed.summary,
    consensusItems: run.parsed.consensusItems,
    conflictObservations: run.parsed.conflictObservations,
    recommendedActions: run.parsed.recommendedActions,
  };
}

export function buildCandidateSystemPrompt(slot: SynthesisModelSlot, language?: string) {
  const langInstruction = language === "zh"
    ? "IMPORTANT: You must provide all textual content (summaries, statements, titles, etc.) in Simplified Chinese (中文)."
    : "IMPORTANT: You must provide all textual content (summaries, statements, titles, etc.) in English.";

  return [
    `You are the ${slot.id} synthesis candidate for Alae.`,
    "Return a structured analysis only.",
    "Extract consensus-ready items, describe meaningful conflicts, and list concrete next actions.",
    "Do not invent certainty where the prompt is ambiguous.",
    langInstruction,
  ].join(" ");
}

export function buildCandidateUserPrompt(prompt: string) {
  return [
    "Analyze the following user prompt for a multi-model synthesis workflow.",
    "Focus on facts, approaches, risks, assumptions, and disagreements that a judge model should review.",
    "",
    `Prompt: ${prompt}`,
  ].join("\n");
}

export function buildJudgeSystemPrompt(language?: string) {
  const langInstruction = language === "zh"
    ? "IMPORTANT: You must provide all textual content (summaries, rationales, chosenApproach, etc.) in Simplified Chinese (中文)."
    : "IMPORTANT: You must provide all textual content (summaries, rationales, chosenApproach, etc.) in English.";

  return [
    "You are the synthesis judge for Alae.",
    "Review the candidate outputs and resolve the conflicts using only the provided conflict IDs.",
    "Return a structured resolution only.",
    langInstruction,
  ].join(" ");
}

export function buildJudgeUserPrompt(input: {
  prompt: string;
  candidateRuns: CompletedCandidateRun[];
  consensusItems: ConsensusItem[];
  conflicts: ConflictPoint[];
}) {
  const payload = {
    prompt: input.prompt,
    candidateRuns: input.candidateRuns.map(buildRunDigest),
    consensusItems: input.consensusItems,
    conflicts: input.conflicts,
  };

  return [
    "Resolve the synthesis using the candidate outputs below.",
    "Use only conflict IDs that appear in the conflicts array when filling resolvedConflictIds.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
