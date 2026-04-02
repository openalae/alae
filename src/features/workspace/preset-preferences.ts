import { synthesisPresetIds, type SynthesisPresetId } from "@/features/consensus";

const workspacePresetStorageKey = "alae.workspace.selectedPresetId";
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

export { workspacePresetStorageKey };
