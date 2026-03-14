import { describe, expect, it } from "vitest";

import {
  R3F_LAB_QUERY_KEY,
  R3F_LAB_QUERY_VALUE,
  R3F_LAB_STORAGE_KEY,
  isR3FLabQueryEnabled,
  isR3FLabStorageEnabled,
  shouldOpenR3FLab,
} from "../labActivation.js";

function createStorage(initialValue = null) {
  const state = new Map();
  if (initialValue !== null) {
    state.set(R3F_LAB_STORAGE_KEY, initialValue);
  }
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

describe("labActivation", () => {
  it("opens lab only in dev mode when query or storage enables it", () => {
    expect(shouldOpenR3FLab({ isDev: false, search: `?${R3F_LAB_QUERY_KEY}=${R3F_LAB_QUERY_VALUE}` })).toBe(false);
    expect(shouldOpenR3FLab({ isDev: true, search: `?${R3F_LAB_QUERY_KEY}=${R3F_LAB_QUERY_VALUE}` })).toBe(true);
    expect(shouldOpenR3FLab({ isDev: true, storage: createStorage(R3F_LAB_QUERY_VALUE) })).toBe(true);
  });

  it("keeps query and storage parsing strict", () => {
    expect(isR3FLabQueryEnabled("?lab=other")).toBe(false);
    expect(isR3FLabQueryEnabled("?lab=r3f")).toBe(true);
    expect(isR3FLabStorageEnabled(createStorage("other"))).toBe(false);
    expect(isR3FLabStorageEnabled(createStorage("r3f"))).toBe(true);
  });
});
