import {
  createDefaultLabSnapshot,
  parseLabSnapshot,
  parseLabSnapshotText,
  stringifyLabSnapshot,
} from "./labConfigSchema.js";

export const LAB_SNAPSHOT_STORAGE_KEY = "dv:r3f-lab:snapshot:v1";

function safeStorage(storage) {
  if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function") {
    return storage;
  }
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

export function loadLabSnapshot(storage = null) {
  const resolvedStorage = safeStorage(storage);
  if (!resolvedStorage) {
    return {
      snapshot: createDefaultLabSnapshot(),
      errorMessage: "",
      hadStoredSnapshot: false,
    };
  }

  const raw = resolvedStorage.getItem(LAB_SNAPSHOT_STORAGE_KEY);
  if (!raw) {
    return {
      snapshot: createDefaultLabSnapshot(),
      errorMessage: "",
      hadStoredSnapshot: false,
    };
  }

  try {
    return {
      snapshot: parseLabSnapshotText(raw),
      errorMessage: "",
      hadStoredSnapshot: true,
    };
  } catch (error) {
    return {
      snapshot: createDefaultLabSnapshot(),
      errorMessage: String(error?.message || "Preset nelze nacist."),
      hadStoredSnapshot: true,
    };
  }
}

export function saveLabSnapshot(snapshot, storage = null) {
  const resolvedStorage = safeStorage(storage);
  if (!resolvedStorage) return false;
  resolvedStorage.setItem(LAB_SNAPSHOT_STORAGE_KEY, stringifyLabSnapshot(parseLabSnapshot(snapshot)));
  return true;
}

export function clearLabSnapshot(storage = null) {
  const resolvedStorage = safeStorage(storage);
  if (!resolvedStorage) return false;
  resolvedStorage.removeItem(LAB_SNAPSHOT_STORAGE_KEY);
  return true;
}
