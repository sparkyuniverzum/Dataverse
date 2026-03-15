import { describe, it, expect } from "vitest";
import { getLabSceneById, listLabScenes } from "../labSceneRegistry";

describe("labSceneRegistry", () => {
  it("lists registered scenes without exposing mutable references", () => {
    const scenes = listLabScenes();
    scenes[0].titleCz = "mutated";

    expect(getLabSceneById("star_core_interior_core")?.titleCz).toBe("Srdce hvězdy: jádro");
    expect(scenes).toHaveLength(2);
  });

  it("returns null for unknown scene", () => {
    expect(getLabSceneById("missing")).toBeNull();
  });
});
