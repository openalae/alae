import type { LanguageModel, LanguageModelV1CallOptions } from "ai";

import { getSynthesisPreset } from "@/features/consensus/presets";
import type {
  ExecutionPlan,
  MockRegistry,
  SynthesisPresetId,
  SynthesisSlotId,
} from "@/features/consensus/types";
import type { CandidateModelOutput, SynthesisModelOutput } from "@/schema";

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


function extractSynthesisPayload(promptText: string) {
  const jsonStart = promptText.indexOf("{");

  if (jsonStart < 0) {
    return {
      prompt: "the current user request",
    };
  }

  try {
    const payload = JSON.parse(promptText.slice(jsonStart)) as {
      prompt?: unknown;
    };

    return {
      prompt:
        typeof payload.prompt === "string" && payload.prompt.trim().length > 0
          ? payload.prompt.trim()
          : "the current user request",
    };
  } catch {
    return {
      prompt: "the current user request",
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

function buildStrongCandidate(): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Deliver a focused synthesis workspace for {{topic}}.`,
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

function buildFastCandidateOne(): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Use a thin workspace controller to orchestrate {{topic}}.`,
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

function buildFastCandidateTwo(): CandidateModelOutput {
  return {
    outputType: "candidate",
    summary: `Prefer deterministic demo coverage for {{topic}} when live providers are unavailable.`,
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

function buildSynthesisOutput(_promptText: string): SynthesisModelOutput {
  return {
    outputType: "synthesis",
    summary: `Use a progressive drill-down workspace for {{topic}}.`,
    chosenApproach:
      "Keep the main view centered on the synthesis report and move raw model output into expandable run cards.",
    rationale:
      "This preserves a high-signal default view while still giving users complete access to source runs, validation state, and telemetry details on demand.",
    highlights: [
      "All models agree on high-signal synthesis-first presentation.",
      "Progressive disclosure pattern preferred for raw output.",
    ],
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
        buildObject: () => buildStrongCandidate(),
      }),
    "fast-1": (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 352,
        completionTokens: 132,
        buildObject: () =>
          buildFastCandidateOne(),
      }),
    "fast-2": (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 328,
        completionTokens: 124,
        buildObject: () =>
          buildFastCandidateTwo(),
      }),
    synthesis: (modelId, provider) =>
      createMockLanguageModel({
        provider,
        modelId,
        promptTokens: 624,
        completionTokens: 196,
        buildObject: (options) => {
          const payload = extractSynthesisPayload(extractUserPromptText(options));
          return buildSynthesisOutput(payload.prompt);
        },
      }),
  });
}

export function createDefaultMockRegistryForExecutionPlan(
  executionPlan: ExecutionPlan,
): MockRegistry {
  const slots = [
    ...executionPlan.candidateSlots,
    ...(executionPlan.synthesisSlot ? [executionPlan.synthesisSlot] : []),
  ];

  return slots.reduce<MockRegistry>((registry, slot) => {
    if (slot.id === "strong") {
      registry.strong = createMockLanguageModel({
        provider: slot.provider,
        modelId: slot.modelId,
        promptTokens: 480,
        completionTokens: 168,
        buildObject: () => buildStrongCandidate(),
      });
    }

    if (slot.id === "fast-1") {
      registry["fast-1"] = createMockLanguageModel({
        provider: slot.provider,
        modelId: slot.modelId,
        promptTokens: 352,
        completionTokens: 132,
        buildObject: () => buildFastCandidateOne(),
      });
    }

    if (slot.id === "fast-2") {
      registry["fast-2"] = createMockLanguageModel({
        provider: slot.provider,
        modelId: slot.modelId,
        promptTokens: 328,
        completionTokens: 124,
        buildObject: () => buildFastCandidateTwo(),
      });
    }

    if (slot.id === "synthesis") {
      registry.synthesis = createMockLanguageModel({
        provider: slot.provider,
        modelId: slot.modelId,
        promptTokens: 624,
        completionTokens: 196,
        buildObject: (options) => {
          const payload = extractSynthesisPayload(extractUserPromptText(options));
          return buildSynthesisOutput(payload.prompt);
        },
      });
    }

    return registry;
  }, {});
}
