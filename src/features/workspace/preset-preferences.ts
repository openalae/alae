import type { ExecutionPlan, SynthesisPresetId } from "@/features/consensus";
import { synthesisPresetIds } from "@/features/consensus";
import { ExecutionPlanSchema } from "@/schema";

const workspacePresetStorageKey = "alae.workspace.selectedPresetId";
const workspaceExecutionPlanStorageKey = "alae.workspace.selectedExecutionPlan";
const supportedPresetIds = new Set<SynthesisPresetId>(synthesisPresetIds);

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredWorkspacePresetId(): SynthesisPresetId | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(workspacePresetStorageKey);

  if (value && supportedPresetIds.has(value as SynthesisPresetId)) {
    return value as SynthesisPresetId;
  }

  return null;
}

export function writeStoredWorkspacePresetId(presetId: SynthesisPresetId) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(workspacePresetStorageKey, presetId);
}

export function clearStoredWorkspacePresetId() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(workspacePresetStorageKey);
}

export function readStoredWorkspaceExecutionPlan(): ExecutionPlan | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(workspaceExecutionPlanStorageKey);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = ExecutionPlanSchema.safeParse(parsed);

    if (result.success) {
      return result.data as ExecutionPlan;
    }
  } catch {
    // fall through to cleanup
  }

  storage.removeItem(workspaceExecutionPlanStorageKey);
  return null;
}

export function writeStoredWorkspaceExecutionPlan(executionPlan: ExecutionPlan) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(workspaceExecutionPlanStorageKey, JSON.stringify(executionPlan));
}

export function clearStoredWorkspaceExecutionPlan() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(workspaceExecutionPlanStorageKey);
}

export { workspaceExecutionPlanStorageKey, workspacePresetStorageKey };
