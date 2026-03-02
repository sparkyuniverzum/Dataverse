import { create } from "zustand";

const DEFAULT_LEVEL = 1;
const DEFAULT_CAMERA = {
  position: [0, 120, 420],
  target: [0, 0, 0],
  minDistance: 20,
  maxDistance: 3000,
};

const DEFAULT_PANELS = {
  command: {
    title: "Navigace a Akce",
    rect: { x: 28, y: 28, width: 460, height: 460 },
    collapsed: false,
  },
  inspector: {
    title: "Detail Mesice a Nerosty",
    rect: { x: 28, y: 236, width: 420, height: 330 },
    collapsed: false,
  },
  grid: {
    title: "Tabulka Planety",
    rect: { x: 28, y: 586, width: 700, height: 260 },
    collapsed: true,
  },
  constellations: {
    title: "Souhvezdi (V1)",
    rect: { x: 460, y: 28, width: 360, height: 340 },
    collapsed: true,
  },
  planets: {
    title: "Planety (V1)",
    rect: { x: 840, y: 28, width: 360, height: 340 },
    collapsed: true,
  },
  moons: {
    title: "Mesice (V1)",
    rect: { x: 1220, y: 28, width: 340, height: 340 },
    collapsed: true,
  },
  bonds: {
    title: "Vazby (V1)",
    rect: { x: 1560, y: 28, width: 360, height: 340 },
    collapsed: true,
  },
};

export const useUniverseStore = create((set) => ({
  level: DEFAULT_LEVEL,
  selectedGalaxyId: "",
  selectedTableId: "",
  selectedAsteroidId: "",
  camera: DEFAULT_CAMERA,
  panels: DEFAULT_PANELS,
  contextMenu: null,
  linkDraft: null,

  setLevel: (level) => set({ level }),

  setCamera: (cameraPatch) =>
    set((state) => ({
      camera: { ...state.camera, ...cameraPatch },
    })),

  selectGalaxy: (galaxyId) =>
    set({
      selectedGalaxyId: galaxyId,
      selectedTableId: "",
      selectedAsteroidId: "",
      level: galaxyId ? 2 : 1,
      contextMenu: null,
      linkDraft: null,
    }),

  focusTable: ({ tableId, cameraTarget = [0, 0, 0], cameraDistance = 210 }) =>
    set((state) => ({
      level: 3,
      selectedTableId: tableId,
      selectedAsteroidId: "",
      camera: {
        ...state.camera,
        target: [...cameraTarget],
        position: [cameraTarget[0] + 0.24 * cameraDistance, cameraTarget[1] + 0.18 * cameraDistance, cameraTarget[2] + cameraDistance],
        minDistance: Math.max(16, cameraDistance * 0.25),
        maxDistance: Math.max(1200, cameraDistance * 7),
      },
    })),

  focusAsteroid: ({ asteroidId, cameraTarget = [0, 0, 0], cameraDistance = 52 }) =>
    set((state) => ({
      level: 3,
      selectedAsteroidId: asteroidId,
      camera: {
        ...state.camera,
        target: [...cameraTarget],
        position: [cameraTarget[0] + 0.22 * cameraDistance, cameraTarget[1] + 0.16 * cameraDistance, cameraTarget[2] + cameraDistance],
        minDistance: Math.max(8, cameraDistance * 0.42),
        maxDistance: Math.max(620, cameraDistance * 12),
      },
    })),

  clearSelectedAsteroid: () =>
    set({
      selectedAsteroidId: "",
    }),

  backToTables: () =>
    set((state) => ({
      level: 2,
      selectedAsteroidId: "",
      camera: {
        ...state.camera,
        target: [0, 0, 0],
        position: [0, 120, 420],
        minDistance: 20,
        maxDistance: 3000,
      },
    })),

  openContextMenu: (payload) => set({ contextMenu: payload }),
  closeContextMenu: () => set({ contextMenu: null }),

  startLinkDraft: (payload) => set({ linkDraft: payload }),
  updateLinkDraft: (to) =>
    set((state) => ({
      linkDraft: state.linkDraft ? { ...state.linkDraft, to } : null,
    })),
  clearLinkDraft: () => set({ linkDraft: null }),

  patchPanel: (panelId, patch) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [panelId]: {
          ...state.panels[panelId],
          ...patch,
        },
      },
    })),
}));

export function normalizePanelRect(rect) {
  const next = rect || {};
  return {
    x: Number.isFinite(next.x) ? next.x : 24,
    y: Number.isFinite(next.y) ? next.y : 24,
    width: Math.max(240, Number.isFinite(next.width) ? next.width : 360),
    height: Math.max(160, Number.isFinite(next.height) ? next.height : 240),
  };
}
