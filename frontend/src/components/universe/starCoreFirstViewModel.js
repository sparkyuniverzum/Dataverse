function formatLawPreset(lawPreset) {
  const normalized = String(lawPreset || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Není připraveno";
  if (normalized === "balanced") return "Balanced";
  if (normalized === "integrity_first") return "Integrity first";
  if (normalized === "high_throughput") return "High throughput";
  if (normalized === "low_activity") return "Low activity";
  return normalized.replaceAll("_", " ");
}

function formatConnectivity(isOnline) {
  return isOnline ? "Sync online" : "Offline režim";
}

export function resolveStarCoreLoadingModel({ galaxyName = "Galaxie", isOnline = true } = {}) {
  return {
    state: "loading",
    title: "Načítám pravdu Srdce hvězdy",
    description: "Workspace čeká na potvrzení governance dat z backendu, aby první krok nevznikl z odhadu.",
    primaryActionLabel: "Načítám Star Core",
    secondaryActionLabel: "Backend potvrzuje policy a fyziku hvězdy",
    rows: [
      { label: "Policy status", value: "Čeká na odpověď" },
      { label: "Law preset", value: "Čeká na odpověď" },
      { label: "Lock status", value: "Čeká na odpověď" },
    ],
    badges: [
      { label: `Scope: ${galaxyName}` },
      { label: "Mode: Star Core first" },
      { label: formatConnectivity(isOnline) },
    ],
    tone: {
      accent: "#7ee8ff",
      accentSoft: "#82ffd4",
      glow: "rgba(126, 232, 255, 0.24)",
    },
  };
}

export function resolveStarCoreFirstViewModel(truth) {
  if (!truth) {
    return {
      state: "data_unavailable",
      title: "Nepodařilo se načíst pravdu Srdce hvězdy",
      description: "Workspace zatím nemá potvrzená data pro první governance krok.",
      primaryActionLabel: null,
      secondaryActionLabel: "Zkusit znovu po načtení dat",
      rows: [],
      badges: [],
      tone: {
        accent: "#ffb36b",
        glow: "rgba(255, 164, 79, 0.28)",
      },
    };
  }

  const { galaxy, connectivity, policy, physicsProfile, profileMeta, physicalProfileMeta } = truth;
  const unlocked = policy.lock_status !== "locked";
  const state = unlocked ? "star_core_unlocked" : "star_core_locked_ready";

  return {
    state,
    title: unlocked ? "Nejdřív nastav zákony hvězdy" : "Hvězda je uzamčena. Můžeš založit první planetu",
    description: unlocked
      ? "Bez uzamčení Star Core nemá galaxie pevná pravidla pro první bezpečný zápis."
      : "Governance základ je potvrzený. Prostor je připravený pro vznik první planety.",
    primaryActionLabel: unlocked ? "Otevřít Srdce hvězdy" : "Založit první planetu",
    secondaryActionLabel: unlocked ? "Proč je to první krok" : "Co se odemklo po uzamčení",
    rows: [
      { label: "Policy status", value: `${policy.lock_status.toUpperCase()} / v${policy.policy_version}` },
      { label: "Law preset", value: formatLawPreset(policy.law_preset) },
      {
        label: "Lock status",
        value: unlocked ? "Čeká na potvrzení governance" : `Uzamčeno (${policy.locked_at ? "potvrzeno" : "ready"})`,
      },
      { label: "Profil jádra", value: profileMeta.label },
      { label: "Fyzika hvězdy", value: `${physicalProfileMeta.label} / v${physicsProfile.profile_version}` },
    ],
    badges: [
      { label: `Scope: ${galaxy.name}` },
      { label: "Mode: Star Core first" },
      { label: formatConnectivity(connectivity.isOnline) },
    ],
    tone: {
      accent: profileMeta.primaryColor,
      accentSoft: profileMeta.secondaryColor,
      glow: unlocked ? "rgba(255, 170, 84, 0.28)" : "rgba(126, 232, 255, 0.24)",
    },
    orbState: {
      unlocked,
      policyLocked: !unlocked,
    },
  };
}
