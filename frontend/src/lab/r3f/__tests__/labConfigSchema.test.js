import { describe, expect, it } from "vitest";

import {
  LabConfigError,
  createDefaultLabSnapshot,
  parseInteriorSceneConfig,
  parseLabSnapshot,
} from "../labConfigSchema.js";

describe("labConfigSchema", () => {
  it("creates canonical default snapshot", () => {
    const snapshot = createDefaultLabSnapshot();

    expect(snapshot.selectedSceneId).toBe("star_core_interior_core");
    expect(snapshot.viewMode).toBe("cinematic");
    expect(snapshot.scenes.star_core_interior_core.phase).toBe("constitution_select");
  });

  it("parses and clamps interior telemetry values", () => {
    const config = parseInteriorSceneConfig({
      phase: "policy_lock_transition",
      telemetryProfile: {
        pulseStrength: 4,
        domainIntensity: -1,
        eventDensity: 0.7,
        planetActivity: 0.3,
      },
    });

    expect(config.phase).toBe("policy_lock_transition");
    expect(config.telemetryProfile).toEqual({
      pulseStrength: 1,
      domainIntensity: 0,
      eventDensity: 0.7,
      planetActivity: 0.3,
    });
  });

  it("rejects invalid snapshot enums", () => {
    expect(() =>
      parseLabSnapshot({
        version: 1,
        selectedSceneId: "invalid",
        viewMode: "debug",
        scenes: {},
      })
    ).toThrow(LabConfigError);
  });
});
