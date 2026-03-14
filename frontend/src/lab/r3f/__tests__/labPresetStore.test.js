import { describe, expect, it } from "vitest";

import { createLabPresetStore } from "../labPresetStore.js";
import { LAB_SNAPSHOT_STORAGE_KEY } from "../labPersistence.js";

function createStorage() {
  const state = new Map();
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, value);
    },
    removeItem(key) {
      state.delete(key);
    },
  };
}

describe("labPresetStore", () => {
  it("persists selected scene and view mode", () => {
    const storage = createStorage();
    const store = createLabPresetStore({ storage });

    store.getState().selectScene("star_core_exterior");
    store.getState().setViewMode("debug");

    const state = store.getState();
    expect(state.snapshot.selectedSceneId).toBe("star_core_exterior");
    expect(state.snapshot.viewMode).toBe("debug");
    expect(state.hadStoredSnapshot).toBe(true);
    expect(storage.getItem(LAB_SNAPSHOT_STORAGE_KEY)).toContain('"selectedSceneId": "star_core_exterior"');
  });

  it("falls back to invalid preset state without crashing the shell", () => {
    const store = createLabPresetStore({ storage: createStorage() });

    store.getState().importSnapshotText("{invalid json");

    const state = store.getState();
    expect(state.status).toBe("lab_invalid_preset");
    expect(state.errorMessage).toContain("validni JSON");
  });
});
