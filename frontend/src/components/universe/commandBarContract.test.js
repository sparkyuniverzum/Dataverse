import { describe, expect, it } from "vitest";

import {
  buildCommandAmbiguityHints,
  buildCommandPreviewModel,
  inferCommandAction,
  patchTaskToSelectedPlanet,
  summarizeTaskRebind,
} from "./commandBarContract";

describe("commandBarContract", () => {
  it("infers command action from user wording", () => {
    expect(inferCommandAction('"Invoice 2026"')).toBe("INGEST");
    expect(inferCommandAction("propoj A + B")).toBe("LINK");
    expect(inferCommandAction("zhasni moon-1")).toBe("EXTINGUISH");
    expect(inferCommandAction("nastav state := archived")).toBe("EXTINGUISH");
  });

  it("builds preview model with deduped quoted entities and missing-scope warning", () => {
    expect(
      buildCommandPreviewModel('"Invoice 2026" + "Invoice 2026" + "Cashflow"', {
        selectedAsteroidLabel: "Invoice 2026",
      })
    ).toMatchObject({
      action: "LINK",
      entities: ["Invoice 2026", "Cashflow"],
      selectedAsteroidLabel: "Invoice 2026",
    });
    expect(
      buildCommandPreviewModel('"Invoice 2026"', {
        selectedAsteroidLabel: "Invoice 2026",
      }).warnings
    ).toContain("Neni vybrana planeta; parser muze zvolit jiny kontext.");
  });

  it("builds warning and blocking ambiguity hints from parser tasks", () => {
    const hints = buildCommandAmbiguityHints(
      [
        { action: "INGEST", params: { table_id: "t-other", table_name: "Other Table" } },
        { action: "EXTINGUISH", params: {} },
      ],
      {
        selectedTableId: "t-1",
        selectedTableName: "Finance > Cashflow",
      }
    );

    expect(hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning" }),
        expect.objectContaining({ severity: "blocking" }),
      ])
    );
  });

  it("patches non-link tasks to the selected planet and preserves links", () => {
    expect(
      patchTaskToSelectedPlanet(
        { action: "INGEST", params: { value: "Invoice 2026", table_id: "t-old" } },
        { selectedTableId: "t-1", selectedTableName: "Finance > Cashflow" }
      )
    ).toMatchObject({
      params: {
        table_id: "t-1",
        planet_id: "t-1",
        table_name: "Finance > Cashflow",
      },
    });

    const linkTask = { action: "LINK", params: { source_id: "a-1", target_id: "a-2" } };
    expect(patchTaskToSelectedPlanet(linkTask, { selectedTableId: "t-1" })).toBe(linkTask);
  });

  it("summarizes task rebind only when task targets actually change", () => {
    expect(
      summarizeTaskRebind(
        [{ params: { table_id: "t-old" } }, { params: { table_id: "t-old" } }],
        [{ params: { table_id: "t-1" } }, { params: { table_id: "t-1" } }],
        "t-1"
      )
    ).toContain("Pregenerovano: 2 uloh");
    expect(summarizeTaskRebind([{ params: { table_id: "t-1" } }], [{ params: { table_id: "t-1" } }], "t-1")).toBe("");
  });
});
