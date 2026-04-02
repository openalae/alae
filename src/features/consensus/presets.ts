import type { SynthesisPreset, SynthesisPresetId } from "@/features/consensus/types";

export type SynthesisPresetDefinition = {
  id: SynthesisPresetId;
  label: string;
  description: string;
  providerSummary: string;
};

export const crossVendorDefaultPreset: SynthesisPreset = {
  id: "crossVendorDefault",
  slots: [
    {
      id: "strong",
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      role: "strong",
      outputType: "candidate",
    },
    {
      id: "fast-1",
      provider: "openai",
      modelId: "gpt-5-mini",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "fast-2",
      provider: "google",
      modelId: "gemini-2.5-flash",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "judge",
      provider: "openai",
      modelId: "gpt-5.2",
      role: "judge",
      outputType: "judge",
    },
  ],
};

export const freeDefaultPreset: SynthesisPreset = {
  id: "freeDefault",
  slots: [
    {
      id: "strong",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "strong",
      outputType: "candidate",
    },
    {
      id: "fast-1",
      provider: "ollama",
      modelId: "qwen3:8b",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "fast-2",
      provider: "ollama",
      modelId: "gemma3:4b",
      role: "fast",
      outputType: "candidate",
    },
    {
      id: "judge",
      provider: "openrouter",
      modelId: "openrouter/free",
      role: "judge",
      outputType: "judge",
    },
  ],
};

export const synthesisPresetDefinitions: SynthesisPresetDefinition[] = [
  {
    id: "freeDefault",
    label: "Free-first",
    description: "Use OpenRouter's free router with local Ollama candidates for the lowest-cost path.",
    providerSummary: "OpenRouter + Ollama",
  },
  {
    id: "crossVendorDefault",
    label: "Cross-vendor",
    description: "Use OpenAI, Anthropic, and Google together for stronger disagreement detection.",
    providerSummary: "Anthropic + OpenAI + Google",
  },
];

export const synthesisPresets: Record<SynthesisPresetId, SynthesisPreset> = {
  crossVendorDefault: crossVendorDefaultPreset,
  freeDefault: freeDefaultPreset,
};

const synthesisPresetDefinitionMap = Object.fromEntries(
  synthesisPresetDefinitions.map((preset) => [preset.id, preset]),
) as Record<SynthesisPresetId, SynthesisPresetDefinition>;

export function getSynthesisPreset(
  presetId: SynthesisPresetId = "crossVendorDefault",
): SynthesisPreset {
  return synthesisPresets[presetId];
}

export function getSynthesisPresetDefinition(
  presetId: SynthesisPresetId = "crossVendorDefault",
): SynthesisPresetDefinition {
  return synthesisPresetDefinitionMap[presetId];
}
