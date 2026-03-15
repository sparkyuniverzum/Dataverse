import { StarCoreInteriorCoreLabScene } from "./scenes/StarCoreInteriorCoreLabScene";

/**
 * Registr scén pro R3F Lab
 * Definuje mapování mezi ID scény a React komponentou.
 */
export const LAB_SCENE_REGISTRY = {
  star_core_interior_core: {
    id: "star_core_interior_core",
    titleCz: "Srdce hvězdy: jádro",
    summaryCz: "Interiér jádra hvězdy, volba ústavy a policy lock.",
    component: StarCoreInteriorCoreLabScene,
    implemented: true,
  },
  star_core_exterior: {
    id: "star_core_exterior",
    titleCz: "Srdce hvězdy: exteriér",
    summaryCz: "Pohled na hvězdu z Galaxy Space, příprava na vstup.",
    component: null, // Placeholder pro Spike C
    implemented: false,
  },
};

export function getLabSceneById(id) {
  return LAB_SCENE_REGISTRY[id] || null;
}

export function listLabScenes() {
  // Vracíme kopie, aby nedošlo k nechtěné mutaci registru
  return Object.values(LAB_SCENE_REGISTRY).map((scene) => ({ ...scene }));
}
