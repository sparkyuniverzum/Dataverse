import { describe, expect, it } from "vitest";

import {
  WORKSPACE_UI_STORAGE_PREFIX,
  buildWorkspaceUiStorageKey,
  normalizeWorkspaceUiState,
  readWorkspaceUiState,
  writeWorkspaceUiState,
} from "./workspaceUiPersistence";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
  };
}

describe("workspaceUiPersistence", () => {
  it("builds stable galaxy-scoped key", () => {
    const key = buildWorkspaceUiStorageKey("g-42");
    expect(key).toBe(`${WORKSPACE_UI_STORAGE_PREFIX}:g-42`);
  });

  it("normalizes persisted payload safely", () => {
    const normalized = normalizeWorkspaceUiState({
      selected_table_id: "table-1",
      quick_grid_open: "true",
    });
    expect(normalized).toEqual({
      selectedTableId: "table-1",
      quickGridOpen: true,
    });
  });

  it("reads and writes per galaxy state via storage adapter", () => {
    const storage = createMemoryStorage();
    const galaxyId = "g-7";

    const before = readWorkspaceUiState(galaxyId, { storage });
    expect(before).toEqual({ selectedTableId: "", quickGridOpen: false });

    const ok = writeWorkspaceUiState(
      galaxyId,
      {
        selectedTableId: "table-abc",
        quickGridOpen: true,
      },
      { storage }
    );
    expect(ok).toBe(true);

    const after = readWorkspaceUiState(galaxyId, { storage });
    expect(after).toEqual({
      selectedTableId: "table-abc",
      quickGridOpen: true,
    });
  });

  it("clears persisted entry when state is empty", () => {
    const storage = createMemoryStorage();
    const galaxyId = "g-8";

    writeWorkspaceUiState(galaxyId, { selectedTableId: "table-1", quickGridOpen: true }, { storage });
    writeWorkspaceUiState(galaxyId, { selectedTableId: "", quickGridOpen: false }, { storage });

    const after = readWorkspaceUiState(galaxyId, { storage });
    expect(after).toEqual({ selectedTableId: "", quickGridOpen: false });
  });
});
