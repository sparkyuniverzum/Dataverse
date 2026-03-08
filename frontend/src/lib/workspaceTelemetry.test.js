import { describe, expect, it } from "vitest";

import {
  createWorkspaceTelemetryEvent,
  emitWorkspaceTelemetry,
  getWorkspaceTelemetryCatalog,
} from "./workspaceTelemetry";

describe("workspace telemetry", () => {
  it("creates event with shared fields", () => {
    const event = createWorkspaceTelemetryEvent({
      eventName: "moon_opened",
      galaxyId: "g-1",
      branchId: "br-1",
      planetId: "p-1",
      civilizationId: "c-1",
      moonId: "m-1",
      bondId: "b-1",
      clientVersion: "test-v1",
      flagPhase: "wave0",
      payload: { source: "sidebar" },
    });
    expect(event).toBeTruthy();
    expect(event.event_name).toBe("moon_opened");
    expect(event.galaxy_id).toBe("g-1");
    expect(event.branch_id).toBe("br-1");
    expect(event.planet_id).toBe("p-1");
    expect(event.civilization_id).toBe("c-1");
    expect(event.moon_id).toBe("m-1");
    expect(event.bond_id).toBe("b-1");
    expect(event.client_version).toBe("test-v1");
    expect(event.flag_phase).toBe("wave0");
    expect(typeof event.occurred_at).toBe("string");
  });

  it("normalizes event-specific payloads", () => {
    const rejected = createWorkspaceTelemetryEvent({
      eventName: "bond_preview_rejected",
      galaxyId: "g-1",
      payload: { reject_codes: ["CROSS_PLANET"], blocking_count: 2, cross_planet: true },
    });
    expect(rejected.payload.reject_codes).toEqual(["CROSS_PLANET"]);
    expect(rejected.payload.blocking_count).toBe(2);
    expect(rejected.payload.cross_planet).toBe(true);

    const repair = createWorkspaceTelemetryEvent({
      eventName: "guided_repair_failed",
      galaxyId: "g-1",
      payload: { strategy_key: "auto", repair_id: "r-1" },
    });
    expect(repair.payload.strategy_key).toBe("auto");
    expect(repair.payload.repair_id).toBe("r-1");
    expect(repair.payload.result).toBe("failed");
  });

  it("rejects unknown event names", () => {
    const event = createWorkspaceTelemetryEvent({
      eventName: "unknown_event",
      galaxyId: "g-1",
    });
    expect(event).toBeNull();
  });

  it("emits via sink callback", () => {
    const events = [];
    const ok = emitWorkspaceTelemetry({ event_name: "moon_opened", galaxy_id: "g-1" }, (event) => events.push(event));
    expect(ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].event_name).toBe("moon_opened");
  });

  it("exposes required telemetry catalog entries", () => {
    const catalog = getWorkspaceTelemetryCatalog();
    expect(catalog).toContain("moon_opened");
    expect(catalog).toContain("moon_rule_failed");
    expect(catalog).toContain("bond_preview_allowed");
    expect(catalog).toContain("bond_preview_rejected");
    expect(catalog).toContain("bond_preview_warned");
    expect(catalog).toContain("cross_planet_blocked");
    expect(catalog).toContain("guided_repair_applied");
    expect(catalog).toContain("guided_repair_failed");
  });
});
