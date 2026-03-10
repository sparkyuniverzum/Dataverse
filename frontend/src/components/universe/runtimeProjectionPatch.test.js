import { describe, expect, it } from "vitest";

import { applyRuntimeEventBatchToSnapshot } from "./runtimeProjectionPatch";

function buildSnapshot() {
  return {
    asteroids: [
      {
        id: "moon-1",
        value: "Moon 1",
        metadata: { state: "active", amount: 10, segment: "core" },
        minerals: { state: "active", amount: 10, segment: "core" },
        current_event_seq: 1,
      },
      {
        id: "moon-2",
        value: "Moon 2",
        metadata: { state: "active" },
        minerals: { state: "active" },
        current_event_seq: 1,
      },
    ],
    bonds: [],
  };
}

describe("runtimeProjectionPatch", () => {
  it("patches metadata update and metadata remove locally", () => {
    const result = applyRuntimeEventBatchToSnapshot(buildSnapshot(), [
      {
        entity_id: "moon-1",
        event_type: "METADATA_UPDATED",
        event_seq: 2,
        payload: {
          metadata: { amount: 42, kind: "patched" },
          metadata_remove: ["segment"],
        },
      },
    ]);

    expect(result.requiresRefresh).toBe(false);
    expect(result.applied).toBe(true);
    expect(result.snapshot.asteroids[0].metadata).toEqual({ state: "active", amount: 42, kind: "patched" });
    expect(result.snapshot.asteroids[0].minerals).toEqual({ state: "active", amount: 42, kind: "patched" });
  });

  it("patches asteroid value update locally", () => {
    const result = applyRuntimeEventBatchToSnapshot(buildSnapshot(), [
      {
        entity_id: "moon-1",
        event_type: "ASTEROID_VALUE_UPDATED",
        event_seq: 3,
        payload: { value: "Moon 1 v2" },
      },
    ]);

    expect(result.requiresRefresh).toBe(false);
    expect(result.snapshot.asteroids[0].value).toBe("Moon 1 v2");
    expect(result.snapshot.asteroids[0].current_event_seq).toBe(3);
  });

  it("patches bond form and soft delete locally", () => {
    const formed = applyRuntimeEventBatchToSnapshot(buildSnapshot(), [
      {
        entity_id: "bond-1",
        event_type: "BOND_FORMED",
        event_seq: 4,
        payload: {
          source_civilization_id: "moon-1",
          target_civilization_id: "moon-2",
          type: "RELATION",
        },
      },
    ]);

    expect(formed.requiresRefresh).toBe(false);
    expect(formed.snapshot.bonds).toHaveLength(1);
    expect(formed.snapshot.bonds[0]).toMatchObject({
      id: "bond-1",
      source_id: "moon-1",
      target_id: "moon-2",
      type: "RELATION",
    });

    const deleted = applyRuntimeEventBatchToSnapshot(formed.snapshot, [
      {
        entity_id: "bond-1",
        event_type: "BOND_SOFT_DELETED",
        event_seq: 5,
        payload: {},
      },
    ]);
    expect(deleted.requiresRefresh).toBe(false);
    expect(deleted.snapshot.bonds).toHaveLength(0);
  });

  it("falls back to refresh for unsupported or unsafe batches", () => {
    const unsupported = applyRuntimeEventBatchToSnapshot(buildSnapshot(), [
      {
        entity_id: "moon-3",
        event_type: "ASTEROID_CREATED",
        event_seq: 4,
        payload: { value: "New moon" },
      },
    ]);
    expect(unsupported.requiresRefresh).toBe(true);
    expect(unsupported.applied).toBe(false);
  });
});
