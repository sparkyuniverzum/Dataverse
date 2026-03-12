import { describe, expect, it } from "vitest";

import {
  resolveCompareTimeTravelModel,
  resolveHistoricalInspectActivation,
  resolveScopedRuntimeConnectivity,
} from "./compareTimeTravelContract";

describe("compareTimeTravelContract", () => {
  it("activates historical inspect only for valid as_of values", () => {
    expect(resolveHistoricalInspectActivation({ draftAsOf: "invalid-date" })).toEqual({
      nextAsOf: "",
      asOfIso: null,
      error: "Time travel vyzaduje validni datum a cas.",
    });

    const valid = resolveHistoricalInspectActivation({ draftAsOf: "2026-03-10T18:30" });
    expect(valid.asOfIso).toContain("2026-03-10T");
    expect(valid.error).toBe("");
  });

  it("resolves compare target against visible branch inventory", () => {
    const model = resolveCompareTimeTravelModel({
      selectedBranchId: "br-main-x",
      branches: [
        { id: "br-main-x", name: "Current", deleted_at: null },
        { id: "br-2", name: "Feature B", deleted_at: null },
      ],
      compareBranchId: "br-2",
      historicalAsOf: "2026-03-10T18:30",
    });

    expect(model.historicalMode).toBe(true);
    expect(model.compareMode).toBe(true);
    expect(model.compareBranchId).toBe("br-2");
    expect(model.compareSummary).toContain("Feature B");
  });

  it("forces write guard messaging while historical inspect is active", () => {
    const scoped = resolveScopedRuntimeConnectivity(
      { badgeLabel: "online", writeBlocked: false, sidebarMessage: "" },
      { historicalMode: true, asOfIso: "2026-03-10T17:30:00.000Z" }
    );
    expect(scoped.writeBlocked).toBe(true);
    expect(scoped.badgeLabel).toContain("historical");
    expect(scoped.sidebarMessage).toContain("pouze pro cteni");
  });
});
