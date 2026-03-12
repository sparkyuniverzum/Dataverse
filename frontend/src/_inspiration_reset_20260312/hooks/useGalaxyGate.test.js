import { describe, expect, it } from "vitest";

import {
  buildSelectedGalaxyStorageKey,
  clearPersistedSelectedGalaxyId,
  readPersistedSelectedGalaxyId,
  writePersistedSelectedGalaxyId,
} from "./galaxyGateStorage";

function createStorageMock() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
  };
}

describe("galaxyGateStorage", () => {
  it("namespaces selected galaxy key by authenticated user id", () => {
    expect(buildSelectedGalaxyStorageKey("user-1")).toBe("dataverse_selected_galaxy_id:user-1");
    expect(buildSelectedGalaxyStorageKey("")).toBe("dataverse_selected_galaxy_id");
  });

  it("prefers scoped value and removes legacy key on write", () => {
    const storage = createStorageMock();
    storage.setItem("dataverse_selected_galaxy_id", "legacy-galaxy");

    writePersistedSelectedGalaxyId(storage, "user-1", "galaxy-1");

    expect(readPersistedSelectedGalaxyId(storage, "user-1")).toBe("galaxy-1");
    expect(storage.getItem("dataverse_selected_galaxy_id")).toBeNull();
  });

  it("falls back to legacy value once for migration-safe restore", () => {
    const storage = createStorageMock();
    storage.setItem("dataverse_selected_galaxy_id", "legacy-galaxy");

    expect(readPersistedSelectedGalaxyId(storage, "user-2")).toBe("legacy-galaxy");
  });

  it("clears scoped and legacy keys on logout/reset", () => {
    const storage = createStorageMock();
    storage.setItem("dataverse_selected_galaxy_id:user-1", "galaxy-1");
    storage.setItem("dataverse_selected_galaxy_id", "legacy-galaxy");

    clearPersistedSelectedGalaxyId(storage, "user-1");

    expect(storage.getItem("dataverse_selected_galaxy_id:user-1")).toBeNull();
    expect(storage.getItem("dataverse_selected_galaxy_id")).toBeNull();
  });
});
