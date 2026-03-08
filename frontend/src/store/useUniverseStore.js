import { create } from "zustand";

const DEFAULT_LEVEL = 1;

export const useUniverseStore = create((set) => ({
  level: DEFAULT_LEVEL,
  selectedGalaxyId: "",
  selectedBranchId: "",

  setLevel: (level) => set({ level }),
  selectBranch: (branchId) => set({ selectedBranchId: String(branchId || "") }),

  selectGalaxy: (galaxyId) =>
    set({
      selectedGalaxyId: galaxyId,
      selectedBranchId: "",
      level: galaxyId ? 2 : 1,
    }),
  reset: () =>
    set({
      level: DEFAULT_LEVEL,
      selectedGalaxyId: "",
      selectedBranchId: "",
    }),
}));
