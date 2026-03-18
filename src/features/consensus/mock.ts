import type { LanguageModel, LanguageModelV1CallOptions } from "ai";

import { getSynthesisPreset } from "@/features/consensus/presets";
import type { MockRegistry, SynthesisPresetId, SynthesisSlotId } from "@/features/consensus/types";
import type { CandidateModelOutput, JudgeModelOutput } from "@/schema";

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return (
    !!part &&
    typeof part === "object" &&
    "type" in part &&
    part.type === "text" &&
    "text" in part &&
    typeof part.text === "string"
  );
}

function extractUserPromptText(options: LanguageModelV1CallOptions) {
  const userMessage = [...options.prompt]
    .reverse()
    .find((message) => message.role === "user");

  if (!userMessage) {
    return "";
  }

  if (typeof userMessage.content === "string") {
    return userMessage.content;
  }

  return userMessage.content
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function extractTopicFromCandidatePrompt(promptText: string) {
  const match = /Prompt:\s*([\s\S]+)$/m.exec(promptText);
  return (match?.[1] ?? promptText).trim() || "the current user request";
}

function extractJudgePayload(promptText: string) {
  const jsonStart = promptText.indexOf("{");

  if (jsonStart < 0) {
    return {
      prompt: "the current user request",
      conflictIds: [] as string[],
    };
  }

  try {
    const payload = JSON.parse(promptText.slice(jsonStart)) as {
      prompt?: unknown;
      conflicts?: Array<{ id?: unknown }>;
    };

    return {
      prompt:
        typeof payload.prompt === "string" && payload.prompt.trim().length > 0
          ? payload.prompt.trim()
          : "the current user request",
      conflictIds: Array.isArray(payload.conflicts)
        ? payload.conflicts
            .map((conflict) => (typeof conflict?.id === "string" ? conflict.id : null))
            .filter((conflictId): conflictId is string => conflictId !== null)
        : [],
    };
  } catch {
    return {
      prompt: "the current user request",
      conflictIds: [] as string[],
    };
  }
}

function createMockLanguageModel<TObject>(input: {
  provider: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  buildObject: (options: LanguageModelV1CallOptions) => TObject;
}): LanguageModel {
  return {
    specificationVersion: "v1",
    provider: input.provider,
    modelId: input.modelId,
    defaultObjectGenerationMode: "json",
    supportsStructuredOutputs: true,
    doGenerate: async (options) => {
      const object = input.buildObject(options);

      return {
        text: JSON.stringify(object),
        finishReason: "stop",
        usage: {
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
        },
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
        response: {
          id: `mock-${input.modelId}`,
          modelId: input.modelId,
          timestamp: new Date(),
        },
      };
    },
    doStream: async () => {
      throw new Error("Streaming is not implemented for mock synthesis models.");
    },
  };
}

function buildStrongCandidate(topic: string): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Deliver a focused synthesis workspace for ${topic}.`,
    consensusItems: [
      {
        kind: "approach",
        statement: "Render a high-signal synthesis report before exposing raw model output.",
        confidence: "high",
      },
      {
        kind: "risk",
        statement: "Automatically fall back to mock execution when required provider keys are missing.",
        confidence: "high",
      },
    ],
    conflictObservations: [
      {
        title: "How raw model output should surface",
        summary: "The default surface should stay concise so the synthesis report remains readable.",
        category: "approach",
        severity: "medium",
        question: "Should raw model outputs be shown inline by default?",
        stance: "No. Keep raw output behind drill-down disclosure.",
      },
    ],
    recommendedActions: [
      "Ship a centered report view first.",
      "Add a clear badge when execution falls back to mock mode.",
    ],
  };
}

function buildFastCandidateOne(topic: string): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Use a thin workspace controller to orchestrate ${topic}.`,
    consensusItems: [
      {
        kind: "approach",
        statement: "Render a high-signal synthesis report before exposing raw model output.",
        confidence: "medium",
      },
      {
        kind: "approach",
        statement: "Keep workspace orchestration separate from presentational UI components.",
        confidence: "high",
      },
    ],
    conflictObservations: [
      {
        title: "How raw model output should surface",
        summary: "Inline raw payloads would drown the synthesis report and weaken progressive disclosure.",
        category: "approach",
        severity: "high",
        question: "Should raw model outputs be shown inline by default?",
        stance: "No. Keep raw output behind drill-down disclosure.",
      },
    ],
    recommendedActions: [
      "Store the latest report and truth snapshot only after the run succeeds.",
      "Support Cmd/Ctrl+Enter to keep the main flow keyboard-friendly.",
    ],
  };
}

function buildFastCandidateTwo(topic: string): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Prefer deterministic demo coverage for ${topic} when live providers are unavailable.`,
    consensusItems: [
      {
        kind: "risk",
        statement: "Automatically fall back to mock execution when required provider keys are missing.",
        confidence: "high",
      },
      {
        kind: "approach",
        statement: "Keep workspace orchestration separate from presentational UI components.",
        confidence: "medium",
      },
    ],
    conflictObservations: [
      {
        title: "How raw model output should surface",
        summary: "Showing raw payloads immediately reduces clicks and makes the model outputs auditable at a glance.",
        category: "approach",
        severity: "medium",
        question: "Should raw model outputs be shown inline by default?",
        stance: "Yes. Surface raw output directly in the main report area.",
      },
    ],
    recommendedActions: [
      "Expose model runs in an accordion so users can audit them on demand.",
      "Reserve the right rail for provider access and future truth panel telemetry.",
    ],
  };
}

function buildJudgeOutput(promptText: string, conflictIds: string[]): JudgeModelOutput {
  return {
    outputType: "judge",
    summary: `Use a progressive drill-down workspace for ${promptText}.`,
    chosenApproach:
      "Keep the main view centered on the synthesis report and move raw model output into expandable run cards.",
    rationale:
      "This preserves a high-signal default view while still giving users complete access to source runs, validation state, and telemetry details on demand.",
    resolvedConflictIds: conflictIds,
    openRisks: [
      "Real-provider latency will vary once live keys are configured.",
      "Truth Panel telemetry remains a placeholder until module 8 consumes the stored snapshot.",
    ],
  };
}

function createRegistryRecord(
  presetId: SynthesisPresetId,
  builders: Record<SynthesisSlotId, (modelId: string, provider: string) => LanguageModel>,
): MockRegistry {
  const preset = getSynthesisPreset(presetId);

  return preset.slots.reduce<MockRegistry>((registry, slot) => {
    registry[slot.id] = builders[slot.id](slot.modelId, slot.provider);
    return registry;
  }, {});
}

export function createDefaultMockRegistry(
  presetId: SynthesisPresetId = "crossVendorDefault",
): MockRegistry {
  return createRegistryRecord(presetId, {
    strong: (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 480,
        completionTokens: 168,
        buildObject: (options) => buildStrongCandidate(extractTopicFromCandidatePrompt(extractUserPromptText(options))),
      }),
    "fast-1": (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 352,
        completionTokens: 132,
        buildObject: (options) =>
          buildFastCandidateOne(extractTopicFromCandidatePrompt(extractUserPromptText(options))),
      }),
    "fast-2": (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 328,
        completionTokens: 124,
        buildObject: (options) =>
          buildFastCandidateTwo(extractTopicFromCandidatePrompt(extractUserPromptText(options))),
      }),
    judge: (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 624,
        completionTokens: 196,
        buildObject: (options) => {
          const payload = extractJudgePayload(extractUserPromptText(options));
          return buildJudgeOutput(payload.prompt, payload.conflictIds);
        },
      }),
  });
}
