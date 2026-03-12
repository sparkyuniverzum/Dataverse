import { describe, expect, it } from "vitest";

import {
  buildBranchTimelineSummary,
  filterTimelineEntries,
  mapBackendStreamEventToTimelineEntry,
  mapRuntimeWorkflowEventToTimelineEntry,
} from "./timelineRewriteContract";

describe("timelineRewriteContract", () => {
  it("builds branch summaries for promote and create flows", () => {
    expect(buildBranchTimelineSummary({ mode: "promote", promotedEventsCount: 3 })).toBe(
      "Branch byl promotnut (3 eventů)."
    );
    expect(buildBranchTimelineSummary({ mode: "create", createdBranchId: "br-1" })).toBe(
      "Branch byl vytvořen a aktivován."
    );
  });

  it("maps backend and runtime events into normalized timeline entries", () => {
    expect(
      mapBackendStreamEventToTimelineEntry({
        id: "evt-1",
        eventType: "update",
        code: "CONFLICT",
        cursor: 7,
        message: "Projection drift",
      })
    ).toMatchObject({
      id: "evt-1",
      action: "BE_STREAM",
      tone: "warn",
    });

    expect(
      mapRuntimeWorkflowEventToTimelineEntry({
        id: "wf-1",
        action: "moon_impact_ready",
        tone: "info",
        message: "Moon impact loaded",
      })
    ).toMatchObject({
      id: "wf-1",
      action: "MOON_IMPACT_READY",
      tone: "info",
      message: "Moon impact loaded",
    });
  });

  it("filters timeline entries by source, repair group, error, and search query", () => {
    const entries = [
      { action: "BE_STREAM", tone: "info", message: "cursor update" },
      { action: "MOON_IMPACT_READY", tone: "info", message: "impact loaded" },
      { action: "REPAIR_APPLY_FAIL", tone: "error", message: "repair failed" },
    ];

    expect(filterTimelineEntries(entries, { filter: "BE_STREAM" })).toHaveLength(1);
    expect(filterTimelineEntries(entries, { filter: "IMPACT_REPAIR" })).toHaveLength(2);
    expect(filterTimelineEntries(entries, { filter: "ERROR" })).toEqual([entries[2]]);
    expect(filterTimelineEntries(entries, { query: "impact" })).toEqual([entries[1]]);
  });
});
