export const LAB_SCENE_REGISTRY = Object.freeze([
  {
    id: "star_core_interior_core",
    titleCz: "Srdce hvezdy: jadro",
    summaryCz: "Prvni cil pro harness a preset boundary interieru.",
    implemented: false,
    scopePath: "frontend/src/lab/r3f/scenes/StarCoreInteriorCoreLabScene.jsx",
  },
  {
    id: "star_core_exterior",
    titleCz: "Srdce hvezdy: exterior",
    summaryCz: "Navazna scena pro druhy spike a rozsirenou registry vrstvu.",
    implemented: false,
    scopePath: "frontend/src/lab/r3f/scenes/StarCoreExteriorLabScene.jsx",
  },
]);

export function listLabScenes() {
  return LAB_SCENE_REGISTRY.map((scene) => ({ ...scene }));
}

export function getLabSceneDefinition(sceneId) {
  return LAB_SCENE_REGISTRY.find((scene) => scene.id === sceneId) || null;
}
