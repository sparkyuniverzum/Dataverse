import { describe, expect, it } from "vitest";

import { classifyRuntimeDeltaFrame, createBoundedStreamDedupe } from "./runtimeDeltaSync";

describe("runtimeDeltaSync", () => {
  it("keeps stream dedupe memory bounded", () => {
    const dedupe = createBoundedStreamDedupe(3);

    expect(dedupe.remember("a")).toBe(true);
    expect(dedupe.remember("b")).toBe(true);
    expect(dedupe.remember("c")).toBe(true);
    expect(dedupe.size()).toBe(3);
    expect(dedupe.remember("a")).toBe(false);

    expect(dedupe.remember("d")).toBe(true);
    expect(dedupe.size()).toBe(3);
    expect(dedupe.remember("a")).toBe(true);
  });

  it("skips projection refresh for empty update batch", () => {
    const decision = classifyRuntimeDeltaFrame(
      { event: "update", data: { last_event_seq: 21, events_count: 0, events: [] } },
      { shouldRefresh: true }
    );

    expect(decision).toEqual({
      shouldRefreshProjection: false,
      shouldRefreshTelemetry: false,
      shouldRequestPulse: false,
      reason: "empty_update_batch",
    });
  });

  it("routes telemetry-only batch to pulse/telemetry without projection refresh", () => {
    const decision = classifyRuntimeDeltaFrame(
      {
        event: "update",
        data: {
          last_event_seq: 22,
          events_count: 1,
          events: [{ event_type: "STAR_POLICY_LOCKED" }],
        },
      },
      { shouldRefresh: true }
    );

    expect(decision).toEqual({
      shouldRefreshProjection: false,
      shouldRefreshTelemetry: true,
      shouldRequestPulse: true,
      reason: "telemetry_only_batch",
    });
  });

  it("keeps projection refresh for entity-changing batches", () => {
    const decision = classifyRuntimeDeltaFrame(
      {
        event: "update",
        data: {
          last_event_seq: 23,
          events_count: 2,
          events: [{ event_type: "ASTEROID_CREATED" }, { event_type: "METADATA_UPDATED" }],
        },
      },
      { shouldRefresh: true }
    );

    expect(decision.shouldRefreshProjection).toBe(true);
    expect(decision.reason).toBe("projection_batch");
  });
});
