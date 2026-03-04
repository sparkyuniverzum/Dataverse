import { create } from "zustand";

const DEFAULT_LEVEL = 1;

export const useUniverseStore = create((set) => ({
  level: DEFAULT_LEVEL,
  selectedGalaxyId: "",

  setLevel: (level) => set({ level }),

  selectGalaxy: (galaxyId) =>
    set({
      selectedGalaxyId: galaxyId,
      level: galaxyId ? 2 : 1,
    }),
  reset: () =>
    set({
      level: DEFAULT_LEVEL,
      selectedGalaxyId: "",
    }),
}));
