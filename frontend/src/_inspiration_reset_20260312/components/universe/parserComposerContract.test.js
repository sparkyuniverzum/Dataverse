import { describe, expect, it } from "vitest";

import { resolveParserComposerModel } from "./parserComposerContract";

describe("parserComposerContract", () => {
  it("builds preview counts and resolve options from draft state", () => {
    const model = resolveParserComposerModel({
      draftState: {
        command: {
          open: true,
          canPreview: true,
          canExecute: false,
          previewBusy: false,
          executeBusy: false,
          preview: {
            action: "INGEST",
            selectedTableLabel: "Tabulka: Finance > Cashflow",
            tasks: [{}, {}],
            entities: ["Invoice 2026"],
            warnings: ["warn"],
            ambiguityHints: [{ severity: "blocking", message: "pick planet" }],
            previewExecution: { result: { civilizations: [{}, {}], bonds: [{}] } },
          },
          showResolveAction: true,
          showResolvePlanetPicker: true,
        },
      },
      tableNodes: [{ id: "planet-1", entityName: "Finance", label: "Cashflow" }],
      commandResolveTableId: "planet-1",
    });

    expect(model.preview).toMatchObject({
      action: "INGEST",
      taskCount: 2,
      civilizationsCount: 2,
      bondsCount: 1,
    });
    expect(model.resolve).toMatchObject({
      showAction: true,
      showResolvePlanetPicker: true,
      canPickPlanet: true,
    });
    expect(model.resolve.options).toEqual([{ id: "planet-1", label: "Finance > Cashflow" }]);
  });

  it("returns empty preview state when no preview exists", () => {
    const model = resolveParserComposerModel({
      draftState: {
        command: {
          open: true,
          input: '"Invoice 2026"',
          canPreview: true,
        },
      },
    });

    expect(model.preview).toBeNull();
    expect(model.emptyStateMessage).toBe("Vloz prikaz a klikni na Nahled.");
  });
});
