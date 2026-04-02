import type { SynthesisPreset, SynthesisPresetId } from "@/features/consensus/types";

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

export const synthesisPresets: Record<SynthesisPresetId, SynthesisPreset> = {
  crossVendorDefault: crossVendorDefaultPreset,
  freeDefault: freeDefaultPreset,
};

export function getSynthesisPreset(
  presetId: SynthesisPresetId = "crossVendorDefault",
): SynthesisPreset {
  return synthesisPresets[presetId];
}
