import { describe, expect, it } from "vitest";

import {
  resolveContextActionPlan,
  resolveContextMenuPlacement,
  resolveMoonSelectionPatch,
  WORKSPACE_CONTEXT_ACTION,
} from "./selectionContextContract";

describe("selectionContextContract", () => {
  it("keeps moon selection lightweight unless grid is explicitly opened", () => {
    expect(resolveMoonSelectionPatch({ moonId: "moon-1" })).toEqual({
      selectedAsteroidId: "moon-1",
      quickGridOpen: false,
    });
    expect(resolveMoonSelectionPatch({ moonId: "moon-2", previousQuickGridOpen: false, openGrid: true })).toEqual({
      selectedAsteroidId: "moon-2",
      quickGridOpen: true,
    });
  });

  it("clamps context menu placement into viewport bounds", () => {
    expect(
      resolveContextMenuPlacement({
        kind: "table",
        id: "planet-1",
        x: 999,
        y: -50,
        viewportWidth: 400,
        viewportHeight: 300,
      })
    ).toMatchObject({
      open: true,
      kind: "table",
      id: "planet-1",
      x: 172,
      y: 8,
    });
  });

  it("routes table context actions through the planet selection patch", () => {
    const plan = resolveContextActionPlan({
      actionKey: WORKSPACE_CONTEXT_ACTION.OPEN_GRID,
      contextMenu: { kind: "table", id: "planet-7" },
      previousQuickGridOpen: false,
    });

    expect(plan).toEqual({
      type: "selection",
      patch: {
        selectedTableId: "planet-7",
        selectedAsteroidId: "",
        quickGridOpen: true,
        autoOpenedGrid: false,
      },
    });
  });

  it("opens the grid for civilization focus and blocks extinguish when interaction is locked", () => {
    expect(
      resolveContextActionPlan({
        actionKey: WORKSPACE_CONTEXT_ACTION.FOCUS_CIVILIZATION,
        contextMenu: { kind: "asteroid", id: "moon-9" },
      })
    ).toEqual({
      type: "selection",
      patch: {
        selectedAsteroidId: "moon-9",
        quickGridOpen: true,
      },
    });

    expect(
      resolveContextActionPlan({
        actionKey: WORKSPACE_CONTEXT_ACTION.EXTINGUISH_CIVILIZATION,
        contextMenu: { kind: "asteroid", id: "moon-9" },
        interactionLocked: true,
      })
    ).toEqual({ type: "noop" });
  });

  it("emits delete intent only for unlocked civilization extinguish", () => {
    expect(
      resolveContextActionPlan({
        actionKey: WORKSPACE_CONTEXT_ACTION.EXTINGUISH_CIVILIZATION,
        contextMenu: { kind: "asteroid", id: "moon-4" },
      })
    ).toEqual({
      type: "delete_asteroid",
      targetId: "moon-4",
    });
  });
});
