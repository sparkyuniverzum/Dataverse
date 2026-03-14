import { describe, expect, it } from "vitest";

import { getLabSceneDefinition, listLabScenes } from "../labSceneRegistry.js";

describe("labSceneRegistry", () => {
  it("lists registered scenes without exposing mutable references", () => {
    const scenes = listLabScenes();
    scenes[0].titleCz = "mutated";

    expect(getLabSceneDefinition("star_core_interior_core")?.titleCz).toBe("Srdce hvezdy: jadro");
    expect(scenes).toHaveLength(2);
  });

  it("returns null for unknown scene", () => {
    expect(getLabSceneDefinition("missing")).toBeNull();
  });
});
