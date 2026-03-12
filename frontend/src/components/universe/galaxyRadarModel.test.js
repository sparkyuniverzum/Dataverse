import { describe, expect, it } from "vitest";

import { buildGalaxySpaceObjects, resolveGalaxyRadarModel } from "./galaxyRadarModel.js";

describe("galaxyRadarModel", () => {
  it("builds star and planet objects from tables", () => {
    const objects = buildGalaxySpaceObjects({
      starModel: { galaxyName: "Moje Galaxie" },
      tableRows: [
        {
          table_id: "t-1",
          planet_name: "Planeta A",
          constellation_name: "Orion",
          sector: { center: { x: 6, z: -2 }, size: 2 },
        },
      ],
    });

    expect(objects).toHaveLength(2);
    expect(objects[0].id).toBe("star-core");
    expect(objects[1].label).toBe("Planeta A");
    expect(objects[1].position).toEqual([6, 0, -2]);
  });

  it("marks selected object in radar output", () => {
    const radar = resolveGalaxyRadarModel({
      galaxyName: "Moje Galaxie",
      headingDegrees: 32,
      selectedObjectId: "t-1",
      spaceObjects: [
        { id: "star-core", type: "star", label: "Srdce hvězdy", position: [0, 0, 0] },
        { id: "t-1", type: "planet", label: "Planeta A", position: [6, 0, -2] },
      ],
    });

    expect(radar.headingDegrees).toBe(32);
    expect(radar.markers.find((marker) => marker.id === "t-1")?.selected).toBe(true);
    expect(radar.markers.find((marker) => marker.id === "star-core")?.type).toBe("star");
  });
});
