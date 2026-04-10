import { beforeEach, describe, expect, it } from "vitest";

import type { ExecutionPlan } from "@/features/consensus";
import {
  clearStoredWorkspaceExecutionPlan,
  clearStoredWorkspacePresetId,
  readStoredWorkspaceExecutionPlan,
  readStoredWorkspacePresetId,
  workspaceExecutionPlanStorageKey,
  workspacePresetStorageKey,
  writeStoredWorkspaceExecutionPlan,
  writeStoredWorkspacePresetId,
} from "@/features/workspace/preset-preferences";

const customExecutionPlan: ExecutionPlan = {
  version: 1,
  candidateSlots: [
    {
      id: "strong",
      provider: "openrouter",
      modelId: "openrouter/free",
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
  ],
  synthesisSlot: {
    id: "synthesis",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    role: "synthesis",
    outputType: "synthesis",
  },
  synthesisMode: "manual",
  source: {
    kind: "custom",
    label: null,
  },
};

describe("workspace preset preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and restores preset ids", () => {
    writeStoredWorkspacePresetId("crossVendorDefault");

    expect(readStoredWorkspacePresetId()).toBe("crossVendorDefault");

    clearStoredWorkspacePresetId();
    expect(readStoredWorkspacePresetId()).toBeNull();
  });

  it("stores and restores custom execution plans", () => {
    writeStoredWorkspaceExecutionPlan(customExecutionPlan);

    expect(readStoredWorkspaceExecutionPlan()).toEqual(customExecutionPlan);

    clearStoredWorkspaceExecutionPlan();
    expect(readStoredWorkspaceExecutionPlan()).toBeNull();
  });

  it("cleans up invalid stored execution plans", () => {
    window.localStorage.setItem(workspaceExecutionPlanStorageKey, "{\"bad\":true}");
    window.localStorage.setItem(workspacePresetStorageKey, "freeDefault");

    expect(readStoredWorkspaceExecutionPlan()).toBeNull();
    expect(window.localStorage.getItem(workspaceExecutionPlanStorageKey)).toBeNull();
    expect(readStoredWorkspacePresetId()).toBe("freeDefault");
  });

  it("migrates legacy judgeSlot/conflictMode to synthesisSlot/synthesisMode via schema preprocess", () => {
    // Simulate a legacy persisted plan with the old judge shape
    window.localStorage.setItem(
      workspaceExecutionPlanStorageKey,
      JSON.stringify({
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
        judgeSlot: {
          id: "judge",
          provider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          role: "judge",
          outputType: "judge",
        },
        conflictMode: "manual",
        source: { kind: "custom", label: null },
      }),
    );

    const plan = readStoredWorkspaceExecutionPlan();

    // The schema should migrate the legacy fields
    expect(plan).not.toBeNull();
    expect(plan?.synthesisSlot).not.toBeNull();
    expect(plan?.synthesisSlot?.provider).toBe("anthropic");
    expect(plan?.synthesisSlot?.role).toBe("synthesis");
    expect(plan?.synthesisMode).toBe("manual");
    // Old fields should not be present
    expect((plan as Record<string, unknown>)?.judgeSlot).toBeUndefined();
    expect((plan as Record<string, unknown>)?.conflictMode).toBeUndefined();
  });
});
