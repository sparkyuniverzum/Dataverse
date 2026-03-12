export const STAR_CORE_PROFILES = Object.freeze({
  ORIGIN: Object.freeze({
    key: "ORIGIN",
    label: "Origin Core",
    description: "Vyvážený režim pro první růst galaxie.",
    primaryColor: "#7ee8ff",
    secondaryColor: "#82ffd4",
    lawPreset: "balanced",
  }),
  FLUX: Object.freeze({
    key: "FLUX",
    label: "Flux Core",
    description: "Vysoká aktivita a rychlý datový pohyb.",
    primaryColor: "#8cb5ff",
    secondaryColor: "#6ff3ff",
    lawPreset: "high_throughput",
  }),
  SENTINEL: Object.freeze({
    key: "SENTINEL",
    label: "Sentinel Core",
    description: "Priorita integrity a ochrany konzistence.",
    primaryColor: "#ff9a7a",
    secondaryColor: "#ffd27f",
    lawPreset: "integrity_first",
  }),
  ARCHIVE: Object.freeze({
    key: "ARCHIVE",
    label: "Archive Core",
    description: "Klidný režim pro stabilní katalogová data.",
    primaryColor: "#89a6c7",
    secondaryColor: "#8ad6ff",
    lawPreset: "low_activity",
  }),
});

export const STAR_PHYSICAL_PROFILES = Object.freeze({
  FORGE: Object.freeze({
    key: "FORGE",
    label: "Forge Physics",
    description: "Rychlá odezva a vyšší pulzace při zátěži.",
  }),
  BALANCE: Object.freeze({
    key: "BALANCE",
    label: "Balance Physics",
    description: "Vyvážené chování mezi výkonem a stabilitou.",
  }),
  ARCHIVE: Object.freeze({
    key: "ARCHIVE",
    label: "Archive Physics",
    description: "Konzervativní dynamika a klidnější pulz.",
  }),
});

export function resolveStarCoreProfileMeta(profileKey) {
  const normalized =
    String(profileKey || "ORIGIN")
      .trim()
      .toUpperCase() || "ORIGIN";
  return STAR_CORE_PROFILES[normalized] || STAR_CORE_PROFILES.ORIGIN;
}

export function resolveStarPhysicalProfileMeta(profileKey) {
  const normalized =
    String(profileKey || "BALANCE")
      .trim()
      .toUpperCase() || "BALANCE";
  return STAR_PHYSICAL_PROFILES[normalized] || STAR_PHYSICAL_PROFILES.BALANCE;
}
