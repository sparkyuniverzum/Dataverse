import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CIVILIZATION_GRID_AUTO_OPEN_SOURCES,
  resolveCivilizationSelectionPatch,
  shouldAutoOpenCivilizationGridOnPlanetSelect,
} from "./civilizationWorkspaceSelectionGate";

describe("civilizationWorkspaceSelectionGate", () => {
  it("keeps explicit sources that can auto-open civilization grid on planet select", () => {
    expect(CIVILIZATION_GRID_AUTO_OPEN_SOURCES).toEqual(["canvas", "sidebar"]);
    expect(
      shouldAutoOpenCivilizationGridOnPlanetSelect({
        source: "canvas",
        tableId: "planet-1",
        interactionLocked: false,
      })
    ).toBe(true);
    expect(
      shouldAutoOpenCivilizationGridOnPlanetSelect({
        source: "sidebar",
        tableId: "planet-1",
        interactionLocked: false,
      })
    ).toBe(true);
  });

  it("does not auto-open grid when selection is locked, empty, or programmatic", () => {
    expect(
      shouldAutoOpenCivilizationGridOnPlanetSelect({
        source: "canvas",
        tableId: "",
        interactionLocked: false,
      })
    ).toBe(false);
    expect(
      shouldAutoOpenCivilizationGridOnPlanetSelect({
        source: "canvas",
        tableId: "planet-1",
        interactionLocked: true,
      })
    ).toBe(false);
    expect(
      shouldAutoOpenCivilizationGridOnPlanetSelect({
        source: "programmatic",
        tableId: "planet-1",
        interactionLocked: false,
      })
    ).toBe(false);
  });

  it("produces deterministic workspace patch for planet selection", () => {
    const patch = resolveCivilizationSelectionPatch({
      source: "canvas",
      tableId: "planet-7",
      interactionLocked: false,
      previousQuickGridOpen: false,
    });
    expect(patch).toEqual({
      selectedTableId: "planet-7",
      selectedAsteroidId: "",
      quickGridOpen: true,
      autoOpenedGrid: true,
    });
  });

  it("closes grid when planet selection is cleared", () => {
    const patch = resolveCivilizationSelectionPatch({
      source: "sidebar",
      tableId: "",
      interactionLocked: false,
      previousQuickGridOpen: true,
    });
    expect(patch).toEqual({
      selectedTableId: "",
      selectedAsteroidId: "",
      quickGridOpen: false,
      autoOpenedGrid: false,
    });
  });

  it("guards UniverseWorkspace against ad-hoc planet selection branching regressions", () => {
    const workspacePath = fileURLToPath(new URL("../components/universe/UniverseWorkspace.jsx", import.meta.url));
    const source = readFileSync(workspacePath, "utf-8");

    expect(source).toContain("resolveCivilizationSelectionPatch");
    expect(source).toContain('source: "canvas"');
    expect(source).toContain('source: "sidebar"');
  });
});
