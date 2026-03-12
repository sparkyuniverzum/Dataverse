function formatSync(connectivity) {
  return connectivity?.isOnline === false ? "SYNC OFFLINE" : "SYNC ONLINE";
}

function formatLawPreset(lawPreset) {
  const normalized = String(lawPreset || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "UNKNOWN";
  return normalized.toUpperCase();
}

function formatGlobalStage(state) {
  if (state === "star_core_locked_ready") return "ONBOARDING_READY";
  if (state === "star_core_unlocked") return "ONBOARDING_INCOMPLETE";
  if (state === "loading") return "SYNCING_SCOPE";
  return "SCOPE_UNAVAILABLE";
}

function createPalette({ primary = "#6ee7ff", secondary = "#f5b36a", halo = "#6ee7ff", governance = "#7edbff" } = {}) {
  return {
    primary,
    secondary,
    halo,
    governance,
  };
}

export function resolveStarCoreSpatialLoadingModel({ galaxyName = "Galaxie", isOnline = true } = {}) {
  return {
    state: "loading",
    galaxyName,
    globalStage: formatGlobalStage("loading"),
    syncLabel: isOnline ? "SYNC ONLINE" : "SYNC OFFLINE",
    hudTitle: "Inicializace hranice galaxie",
    hudSubtitle: "Srdce hvězdy se synchronizuje s backend pravdou.",
    ringLabels: [
      { key: "GOVERNANCE", value: "SYNCING" },
      { key: "PHYSICS_PROFILE", value: "LOADING" },
      { key: "PULSE", value: "STABILIZING" },
    ],
    commandPrompt: "Synchronizuji pravdu Srdce hvězdy",
    commandHint: "Scéna čeká na potvrzení governance dat z backendu.",
    errorHint: "",
    palette: createPalette({
      primary: "#9be8ff",
      secondary: "#e9c88f",
      halo: "#8bdfff",
      governance: "#94ddff",
    }),
    visual: {
      pulseSpeed: 1.05,
      pulseAmplitude: 0.12,
      showOrbitCue: false,
      ringLocked: false,
      showCommandBeacon: false,
    },
  };
}

export function resolveStarCoreSpatialStateModel(truth, { error = "" } = {}) {
  if (!truth) {
    return {
      state: "data_unavailable",
      galaxyName: "Neznámá galaxie",
      globalStage: formatGlobalStage("data_unavailable"),
      syncLabel: "SYNC DEGRADED",
      hudTitle: "Srdce hvězdy nemá potvrzený scope",
      hudSubtitle: "Workspace zatím nezná hranici galaxie ani stav governance.",
      ringLabels: [
        { key: "GOVERNANCE", value: "UNAVAILABLE" },
        { key: "PHYSICS_PROFILE", value: "UNKNOWN" },
        { key: "PULSE", value: "STALLED" },
      ],
      commandPrompt: "Čekám na aktivní galaxii",
      commandHint: "Bez scope nelze stabilizovat prostorovou ontologii.",
      errorHint: String(error || "Chybí aktivní galaxie pro načtení Star Core."),
      palette: createPalette({
        primary: "#ffcf85",
        secondary: "#ff8b6a",
        halo: "#ff9f70",
        governance: "#ffb36a",
      }),
      visual: {
        pulseSpeed: 0.62,
        pulseAmplitude: 0.05,
        showOrbitCue: false,
        ringLocked: false,
        showCommandBeacon: false,
      },
    };
  }

  const unlocked = truth.policy.lock_status !== "locked";
  const state = unlocked ? "star_core_unlocked" : "star_core_locked_ready";

  return {
    state,
    galaxyName: truth.galaxy.name,
    globalStage: formatGlobalStage(state),
    syncLabel: formatSync(truth.connectivity),
    hudTitle: unlocked ? "Srdce hvězdy čeká na uzamčení politik" : "Srdce hvězdy je uzamčeno",
    hudSubtitle: unlocked
      ? "Nejdřív potvrď ústavu prostoru. Teprve potom se smí objevit první planeta."
      : "Governance je stabilní. První oběžná dráha je připravená pro vznik planety.",
    ringLabels: unlocked
      ? [
          { key: "GOVERNANCE", value: "UNLOCKED" },
          { key: "PHYSICS_PROFILE", value: truth.physicalProfileMeta.key },
          { key: "PULSE", value: "STABILIZING" },
        ]
      : [
          { key: "GOVERNANCE", value: "LOCKED" },
          { key: "STATUS", value: "POLICY_READY" },
          { key: "PULSE", value: "STABLE" },
        ],
    commandPrompt: unlocked ? "Potvrdit ústavu a uzamknout politiky" : "První oběžná dráha je připravená",
    commandHint: unlocked
      ? `Law preset: ${formatLawPreset(truth.policy.law_preset)}`
      : "Založení první planety naváže v dalším FE bloku.",
    errorHint: String(error || ""),
    palette: unlocked
      ? createPalette({
          primary: "#ffd88a",
          secondary: "#ff9a5a",
          halo: "#7fe9ff",
          governance: "#ffbf6b",
        })
      : createPalette({
          primary: "#c7f4ff",
          secondary: "#69d2ff",
          halo: "#71dbff",
          governance: "#7cd9ff",
        }),
    visual: {
      pulseSpeed: unlocked ? 1.28 : 0.72,
      pulseAmplitude: unlocked ? 0.18 : 0.08,
      showOrbitCue: !unlocked,
      ringLocked: !unlocked,
      showCommandBeacon: unlocked,
      profileLabel: truth.profileMeta.label,
      policyVersion: truth.policy.policy_version,
      lockedAt: truth.policy.locked_at,
      haloIntensity: truth.halo.intensity,
      orbitOpacity: truth.halo.orbitOpacity,
    },
  };
}
