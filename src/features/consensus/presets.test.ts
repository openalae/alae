import { describe, expect, it } from "vitest";

import {
  buildExecutionPlanFromModelSelection,
  normalizeModelSelection,
  resolveModelSelectionFromPreset,
} from "@/features/consensus/presets";
import { buildModelCatalogRecord } from "@/features/settings/providers";

describe("consensus preset helpers", () => {
  it("resolves preset templates against the current catalog instead of hardcoded local model names", () => {
    const catalog = buildModelCatalogRecord({
      providerConfiguredMap: {
        openrouter: true,
        ollama: true,
      },
      discoveredModels: {
        ollama: [
          {
            id: "ollama:deepseek-r1:8b",
            modelId: "deepseek-r1:8b",
            label: "deepseek-r1:8b",
            sizeBytes: 123,
            modifiedAt: "2026-03-18T00:00:00.000Z",
          },
          {
            id: "ollama:llama3.2:latest",
            modelId: "llama3.2:latest",
            label: "llama3.2:latest",
            sizeBytes: 456,
            modifiedAt: "2026-03-18T00:05:00.000Z",
          },
        ],
      },
    });

    expect(resolveModelSelectionFromPreset("freeDefault", catalog)).toEqual({
      candidateModelIds: [
        "openrouter:openrouter/free",
        "ollama:deepseek-r1:8b",
        "ollama:llama3.2:latest",
      ],
      synthesisModelId: "openrouter:openrouter/free",
    });
  });

  it("normalizes duplicate or missing selections before building a custom plan", () => {
    const catalog = buildModelCatalogRecord({
      providerConfiguredMap: {
        openrouter: true,
        ollama: true,
      },
      discoveredModels: {
        ollama: [
          {
            id: "ollama:qwen3:8b",
            modelId: "qwen3:8b",
            label: "qwen3:8b",
            sizeBytes: 123,
            modifiedAt: "2026-03-18T00:00:00.000Z",
          },
        ],
      },
    });

    const selection = normalizeModelSelection({
      modelCatalog: catalog,
      selection: {
        candidateModelIds: [
          "openrouter:openrouter/free",
          "openrouter:openrouter/free",
          "missing:model",
        ],
        synthesisModelId: "missing:synthesis",
      },
      fallbackPresetId: "dual",
    });

    expect(selection).toEqual({
      candidateModelIds: ["openrouter:openrouter/free"],
      synthesisModelId: null,
    });

    expect(
      buildExecutionPlanFromModelSelection({
        modelCatalog: catalog,
        selection,
        synthesisMode: "manual",
        label: "Custom",
      }),
    ).toEqual({
      version: 1,
      candidateSlots: [
        {
          id: "strong",
          provider: "openrouter",
          modelId: "openrouter/free",
          role: "strong",
          outputType: "candidate",
        },
      ],
      synthesisSlot: null,
      synthesisMode: "manual",
      source: {
        kind: "custom",
        label: "Custom",
      },
    });
  });
});
