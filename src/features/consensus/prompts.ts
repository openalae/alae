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
    "Focus on facts, approaches, risks, assumptions, and disagreements that the synthesis step should review.",
    "",
    `Prompt: ${prompt}`,
  ].join("\n");
}

export function buildSynthesisSystemPrompt(language?: string) {
  const langInstruction = language === "zh"
    ? "IMPORTANT: You must provide all textual content (summaries, rationales, chosenApproach, highlights, etc.) in Simplified Chinese (中文)."
    : "IMPORTANT: You must provide all textual content (summaries, rationales, chosenApproach, highlights, etc.) in English.";

  return [
    "You are the synthesis summarizer for Alae.",
    "Review the candidate model outputs below.",
    "Summarize the consensus, highlight key insights, note areas of disagreement, and propose a recommended approach.",
    "Return a structured synthesis only.",
    langInstruction,
  ].join(" ");
}

export function buildSynthesisUserPrompt(input: {
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
    "Synthesize the candidate outputs below into a unified analysis.",
    "Highlight areas of agreement, note key differences, and recommend a path forward.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
