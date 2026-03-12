import { resolveStarCoreProfileMeta, resolveStarPhysicalProfileMeta } from "./lawResolver.js";

export const STAR_CORE_CONSTITUTIONS = Object.freeze([
  Object.freeze({
    id: "rust",
    title: "Růst",
    subtitle: "Živější expanze a rychlý tok změn.",
    effectHint: "Vyšší puls, svižnější reakce a odvážnější rozpínání prostoru.",
    profileKey: "FLUX",
    physicalProfileKey: "FORGE",
    tonePrimary: "#8cb5ff",
    toneSecondary: "#6ff3ff",
  }),
  Object.freeze({
    id: "rovnovaha",
    title: "Rovnováha",
    subtitle: "Stabilní režim pro první růst galaxie.",
    effectHint: "Vyvážené chování mezi stabilitou, výkonem a čitelností prostoru.",
    profileKey: "ORIGIN",
    physicalProfileKey: "BALANCE",
    tonePrimary: "#7ee8ff",
    toneSecondary: "#82ffd4",
  }),
  Object.freeze({
    id: "straz",
    title: "Stráž",
    subtitle: "Silnější ochrana integrity a konzistence.",
    effectHint: "Přísnější governance, klidnější kroky a menší tolerance k chaosu.",
    profileKey: "SENTINEL",
    physicalProfileKey: "BALANCE",
    tonePrimary: "#ff9a7a",
    toneSecondary: "#ffd27f",
  }),
  Object.freeze({
    id: "archiv",
    title: "Archiv",
    subtitle: "Konzervativní režim pro klidná katalogová data.",
    effectHint: "Pomalejší vesmír, měkký puls a důraz na dlouhodobou stabilitu.",
    profileKey: "ARCHIVE",
    physicalProfileKey: "ARCHIVE",
    tonePrimary: "#89a6c7",
    toneSecondary: "#8ad6ff",
  }),
]);

export function resolveStarCoreConstitutionOptions() {
  return STAR_CORE_CONSTITUTIONS.map((item) => ({
    ...item,
    profileMeta: resolveStarCoreProfileMeta(item.profileKey),
    physicalProfileMeta: resolveStarPhysicalProfileMeta(item.physicalProfileKey),
  }));
}

export function findStarCoreConstitutionOption(constitutionId) {
  const normalized = String(constitutionId || "")
    .trim()
    .toLowerCase();
  return resolveStarCoreConstitutionOptions().find((item) => item.id === normalized) || null;
}

export function buildStarCorePolicyLockPayload(constitutionId, { physicalProfileVersion = 1 } = {}) {
  const option = findStarCoreConstitutionOption(constitutionId);
  if (!option) return null;
  return {
    profile_key: option.profileKey,
    lock_after_apply: true,
    physical_profile_key: option.physicalProfileKey,
    physical_profile_version: Number.isFinite(Number(physicalProfileVersion))
      ? Math.max(1, Number(physicalProfileVersion))
      : 1,
  };
}
