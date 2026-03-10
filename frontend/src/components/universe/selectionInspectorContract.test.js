import { describe, expect, it } from "vitest";

import {
  formatSelectedTableLabel,
  resolveSelectedCivilizationLabel,
  resolveSelectionInspectorModel,
} from "./selectionInspectorContract";

describe("selectionInspectorContract", () => {
  it("formats selected table and civilization labels through shared helpers", () => {
    expect(formatSelectedTableLabel({ table_id: "planet-1", name: "Finance > Cashflow" })).toBe(
      "Tabulka: Finance > Cashflow"
    );
    expect(resolveSelectedCivilizationLabel({ value: "Moon-1" })).toBe("Moon-1");
  });

  it("builds sidebar selection model with selected orbit item and inspector summary", () => {
    const model = resolveSelectionInspectorModel({
      selectedTable: { table_id: "planet-1", name: "Finance > Cashflow" },
      selectedCivilizationId: "moon-2",
      civilizationRows: [
        { id: "moon-1", value: "Ops" },
        { id: "moon-2", value: "Ledger", facts: [{ key: "state", typed_value: "invalid", status: "invalid" }] },
      ],
    });

    expect(model.selectedTableLabel).toBe("Tabulka: Finance > Cashflow");
    expect(model.selectedCivilizationLabel).toBe("Ledger");
    expect(model.civilizationCount).toBe(2);
    expect(model.orbitCivilizations).toEqual([
      { id: "moon-1", label: "Ops", selected: false },
      { id: "moon-2", label: "Ledger", selected: true },
    ]);
    expect(model.inspector.state).toBe("ACTIVE");
    expect(model.inspector.impactedMinerals.join(" ")).toContain("state");
  });

  it("falls back to civilization map when selected row is not present in current orbit rows", () => {
    const civilizationById = new Map([
      ["moon-9", { id: "moon-9", value: "Archive", state: "ARCHIVED", is_deleted: true }],
    ]);

    const model = resolveSelectionInspectorModel({
      selectedTable: { table_id: "planet-1", name: "Finance > Cashflow" },
      selectedCivilizationId: "moon-9",
      civilizationRows: [],
      civilizationById,
    });

    expect(model.selectedCivilizationLabel).toBe("Archive");
    expect(model.inspector.archived).toBe(true);
  });
});
