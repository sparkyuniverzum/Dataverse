import { describe, expect, it } from "vitest";

import { resolveStarCoreSpatialLoadingModel, resolveStarCoreSpatialStateModel } from "./starCoreSpatialStateModel.js";

describe("starCoreSpatialStateModel", () => {
  it("creates loading state without fake lock semantics", () => {
    const model = resolveStarCoreSpatialLoadingModel({ galaxyName: "Moje Galaxie", isOnline: true });

    expect(model.state).toBe("loading");
    expect(model.ringLabels[0].value).toBe("SYNCING");
    expect(model.commandPrompt).toMatch(/Synchronizuji/);
  });

  it("creates unlocked spatial governance state", () => {
    const model = resolveStarCoreSpatialStateModel({
      galaxy: { id: "g-1", name: "Moje Galaxie" },
      connectivity: { isOnline: true },
      policy: {
        lock_status: "draft",
        law_preset: "balanced",
        policy_version: 1,
      },
      physicsProfile: {},
      profileMeta: { label: "Origin Core" },
      physicalProfileMeta: { key: "BALANCE" },
      halo: { intensity: 0.4, orbitOpacity: 0.5 },
      runtime: { writes_per_minute: 18 },
      pulse: { sampled_count: 4 },
      domainMetrics: { domains: [{ domain_name: "governance" }] },
    });

    expect(model.state).toBe("star_core_unlocked");
    expect(model.ringLabels[0]).toEqual({ key: "GOVERNANCE", value: "UNLOCKED" });
    expect(model.visual.showCommandBeacon).toBe(true);
    expect(model.visual.runtimeTempo).toBeGreaterThan(0);
  });

  it("creates locked ready state with orbital cue", () => {
    const model = resolveStarCoreSpatialStateModel({
      galaxy: { id: "g-1", name: "Moje Galaxie" },
      connectivity: { isOnline: true },
      policy: {
        lock_status: "locked",
        law_preset: "integrity_first",
        policy_version: 2,
        locked_at: "2026-03-12T10:00:00Z",
      },
      physicsProfile: {},
      profileMeta: { label: "Sentinel Core" },
      physicalProfileMeta: { key: "FORGE" },
      halo: { intensity: 0.48, orbitOpacity: 0.72 },
      runtime: { writes_per_minute: 48 },
      pulse: { sampled_count: 12 },
      domainMetrics: { domains: [{ domain_name: "governance" }, { domain_name: "physics" }] },
    });

    expect(model.state).toBe("star_core_locked_ready");
    expect(model.ringLabels[1]).toEqual({ key: "STATUS", value: "POLICY_READY" });
    expect(model.visual.showOrbitCue).toBe(true);
    expect(model.globalStage).toBe("ONBOARDING_READY");
    expect(model.visual.domainDensity).toBeGreaterThan(0);
  });

  it("creates unavailable state with explicit scope error", () => {
    const model = resolveStarCoreSpatialStateModel(null, { error: "Chybí aktivní galaxie." });

    expect(model.state).toBe("data_unavailable");
    expect(model.errorHint).toBe("Chybí aktivní galaxie.");
  });
});
