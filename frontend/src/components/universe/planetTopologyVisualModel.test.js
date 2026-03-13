import { describe, expect, it } from "vitest";

import { buildGalaxyPlanetObjects } from "./planetTopologyVisualModel.js";

describe("planetTopologyVisualModel", () => {
  it("projects tables and runtime physics into visible planet objects", () => {
    const planets = buildGalaxyPlanetObjects({
      tableRows: [
        {
          table_id: "t-1",
          planet_name: "Planeta A",
          constellation_name: "Orion",
          members: 9,
          schema_fields: ["a", "b"],
          formula_fields: ["sum_a"],
          internal_bonds: 2,
          external_bonds: 1,
          sector: { center: { x: 6, z: -2 }, size: 2.4, mode: "active" },
        },
      ],
      planetPhysicsPayload: {
        items: [
          {
            table_id: "t-1",
            phase: "ACTIVE",
            metrics: { rows: 14, stress: 0.2, health: 0.92, corrosion: 0.1 },
            visual: {
              size_factor: 1.6,
              luminosity: 0.45,
              pulse_rate: 1.4,
              hue: 0.62,
              saturation: 0.54,
              corrosion_level: 0.14,
              crack_intensity: 0.08,
            },
          },
        ],
      },
    });

    expect(planets).toHaveLength(1);
    expect(planets[0].id).toBe("t-1");
    expect(planets[0].label).toBe("Planeta A");
    expect(planets[0].position).toEqual([6, 0, -2]);
    expect(planets[0].statusLabel).toBe("ACTIVE");
    expect(planets[0].size).toBeGreaterThan(1.6);
    expect(planets[0].rows).toBe(14);
    expect(planets[0].palette.primary).toContain("hsl(");
  });

  it("falls back to deterministic orbit placement when table sector data is missing", () => {
    const planets = buildGalaxyPlanetObjects({
      tableRows: [{ table_id: "t-2", planet_name: "Planeta B" }],
    });

    expect(planets).toHaveLength(1);
    expect(planets[0].position[0]).not.toBe(0);
    expect(planets[0].position[2]).toBe(0);
    expect(planets[0].statusLabel).toBe("CALM");
  });
});
