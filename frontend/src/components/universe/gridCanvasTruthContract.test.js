import { describe, expect, it } from "vitest";

import { resolveGridCanvasTruthModel } from "./gridCanvasTruthContract";

describe("gridCanvasTruthContract", () => {
  it("keeps civilization focus only when it belongs to the selected table scope", () => {
    expect(
      resolveGridCanvasTruthModel({
        selectedTableId: "planet-1",
        selectedCivilizationId: "moon-9",
        tableRows: [{ id: "moon-1" }, { id: "moon-2" }],
      })
    ).toMatchObject({
      selectedCivilizationId: "",
      shouldClearScopedCivilization: true,
      focusMode: "canvas_planet",
    });
  });

  it("auto-selects the first civilization only when grid is open and scope has rows", () => {
    expect(
      resolveGridCanvasTruthModel({
        selectedTableId: "planet-1",
        tableRows: [{ id: "moon-1" }, { id: "moon-2" }],
        quickGridOpen: true,
      })
    ).toMatchObject({
      firstSelectableCivilizationId: "moon-1",
      shouldAutoSelectFirstCivilization: true,
      focusMode: "grid_planet",
    });
  });

  it("preserves valid civilization focus across grid and canvas modes", () => {
    expect(
      resolveGridCanvasTruthModel({
        selectedTableId: "planet-1",
        selectedCivilizationId: "moon-2",
        tableRows: [{ id: "moon-1" }, { id: "moon-2" }],
        quickGridOpen: true,
      })
    ).toMatchObject({
      selectedCivilizationId: "moon-2",
      shouldClearScopedCivilization: false,
      shouldAutoSelectFirstCivilization: false,
      focusMode: "grid_civilization",
    });
  });
});
