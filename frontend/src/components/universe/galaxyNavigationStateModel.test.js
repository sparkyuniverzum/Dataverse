import { describe, expect, it } from "vitest";

import {
  beginGalaxyApproach,
  createInitialGalaxyNavigationState,
  resolveGalaxyEscape,
  resolveGalaxyNavigationModel,
  selectGalaxyObject,
} from "./galaxyNavigationStateModel.js";

const spaceObjects = [
  { id: "star-core", type: "star", label: "Srdce hvězdy", position: [0, 0, 0] },
  { id: "planet-a", type: "planet", label: "Planeta A", position: [5, 0, 1] },
];

describe("galaxyNavigationStateModel", () => {
  it("starts in idle mode", () => {
    expect(createInitialGalaxyNavigationState()).toEqual({
      mode: "space_idle",
      selectedObjectId: "",
      approachTargetId: "",
    });
  });

  it("selects object on click", () => {
    const state = selectGalaxyObject(createInitialGalaxyNavigationState(), "planet-a");
    const model = resolveGalaxyNavigationModel({ navigationState: state, spaceObjects });

    expect(model.mode).toBe("object_selected");
    expect(model.selectedObjectId).toBe("planet-a");
    expect(model.selectedObject?.label).toBe("Planeta A");
  });

  it("approaches selected object on double click", () => {
    const selected = selectGalaxyObject(createInitialGalaxyNavigationState(), "star-core");
    const state = beginGalaxyApproach(selected);
    const model = resolveGalaxyNavigationModel({ navigationState: state, spaceObjects });

    expect(model.mode).toBe("approach_active");
    expect(model.approachTargetId).toBe("star-core");
    expect(model.isApproachActive).toBe(true);
  });

  it("escape returns from approach to selected and then to idle", () => {
    const approach = beginGalaxyApproach(selectGalaxyObject(createInitialGalaxyNavigationState(), "planet-a"));
    const selected = resolveGalaxyEscape(approach);
    const idle = resolveGalaxyEscape(selected);

    expect(selected).toEqual({
      mode: "object_selected",
      selectedObjectId: "planet-a",
      approachTargetId: "",
    });
    expect(idle).toEqual({
      mode: "space_idle",
      selectedObjectId: "",
      approachTargetId: "",
    });
  });
});
