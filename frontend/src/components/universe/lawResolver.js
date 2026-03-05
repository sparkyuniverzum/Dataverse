function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const LAW_MATRIX_V1 = Object.freeze({
  domain: Object.freeze({
    activityMin: 0,
    activityMax: 1,
    pulseMin: 0,
    pulseMax: 1.5,
  }),
  planet: Object.freeze({
    stressFromDomain: 0.42,
    pulseFactorBase: 1,
    pulseFactorFromDomain: 0.85,
    pulseFactorFromPulse: 0.45,
    emissiveFromDomain: 0.58,
    emissiveFromPulse: 0.36,
    pulseFactorClamp: Object.freeze([0.9, 2.35]),
    emissiveClamp: Object.freeze([0, 1]),
    stressClamp: Object.freeze([0, 1]),
  }),
  moon: Object.freeze({
    stressFromDomain: 0.36,
    stressFromPulse: 0.32,
    pulseFactorBase: 1,
    pulseFactorFromDomain: 0.66,
    pulseFactorFromPulse: 0.72,
    emissiveFromDomain: 0.42,
    emissiveFromPulse: 0.56,
    pulseFactorClamp: Object.freeze([0.9, 2.35]),
    emissiveClamp: Object.freeze([0, 1]),
    stressClamp: Object.freeze([0, 1]),
  }),
  tableLink: Object.freeze({
    flowFromDomain: 0.9,
    flowFromPulse: 0.6,
    speedFromFlow: 0.7,
    widthFromFlow: 0.34,
    pulseSizeFromFlow: 0.42,
    opacityFromFlow: 0.12,
  }),
  moonLink: Object.freeze({
    flowFromDomain: 0.72,
    flowFromSourcePulse: 0.32,
    flowFromTargetPulse: 0.32,
    flowFromLinkPulse: 0.46,
    speedFromFlow: 1.05,
    widthFromFlow: 0.48,
    pulseSizeFromFlow: 0.7,
    opacityFromFlow: 0.16,
  }),
});

export const STAR_CORE_PROFILES = Object.freeze({
  ORIGIN: Object.freeze({
    key: "ORIGIN",
    label: "Origin Core",
    description: "Vyvazeny rezim pro bezny rust galaxie.",
    primaryColor: "#7ee8ff",
    secondaryColor: "#82ffd4",
    lawPreset: "balanced",
  }),
  FLUX: Object.freeze({
    key: "FLUX",
    label: "Flux Core",
    description: "Vysoka aktivita a rychly datovy pohyb.",
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
    description: "Klidny rezim pro stabilni katalogova data.",
    primaryColor: "#89a6c7",
    secondaryColor: "#8ad6ff",
    lawPreset: "low_activity",
  }),
});

export const STAR_PHYSICAL_PROFILES = Object.freeze({
  FORGE: Object.freeze({
    key: "FORGE",
    label: "Forge Physics",
    description: "Rychla odezva, vyssi pulzace a agrese rustu pri zatezi.",
    focus: "Transakcni toky a vysoka frekvence zapisu.",
    coefficientsHint: "Vyssi d,g,h; nizsi c,f",
    primaryColor: "#ffad57",
    secondaryColor: "#ffd184",
  }),
  BALANCE: Object.freeze({
    key: "BALANCE",
    label: "Balance Physics",
    description: "Vyvazene chovani mezi vykonem, stabilitou a citlivosti.",
    focus: "Obecny univerzalni rezim pro vetsinu galaxii.",
    coefficientsHint: "Stredni vahy vsech koeficientu",
    primaryColor: "#74d9ff",
    secondaryColor: "#8de7ff",
  }),
  ARCHIVE: Object.freeze({
    key: "ARCHIVE",
    label: "Archive Physics",
    description: "Konzervativni dynamika, pomalejsi pulz a vyssi tolerance klidu.",
    focus: "Katalogova a dlouhodobe archivni data.",
    coefficientsHint: "Nizsi d,g,h; vyssi c,f",
    primaryColor: "#9fb7d8",
    secondaryColor: "#b9dbff",
  }),
});

function safeDomainActivity(domainMetric) {
  return clamp(
    Number(domainMetric?.activity_intensity || 0),
    LAW_MATRIX_V1.domain.activityMin,
    LAW_MATRIX_V1.domain.activityMax
  );
}

function safePulseIntensity(pulse) {
  return clamp(Number(pulse?.intensity || 0), LAW_MATRIX_V1.domain.pulseMin, LAW_MATRIX_V1.domain.pulseMax);
}

function resolveStatus(domainMetric) {
  return String(domainMetric?.status || "GREEN");
}

function resolveQuality(domainMetric) {
  return Number.isFinite(Number(domainMetric?.quality_score)) ? Number(domainMetric.quality_score) : 100;
}

export function resolveEntityLaws({ kind, basePhysics = {}, domainMetric = null, pulse = null }) {
  const domainActivity = safeDomainActivity(domainMetric);
  const pulseIntensity = safePulseIntensity(pulse);
  if (kind === "planet") {
    const config = LAW_MATRIX_V1.planet;
    return {
      v1: {
        status: resolveStatus(domainMetric),
        quality_score: resolveQuality(domainMetric),
      },
      physics: {
        ...basePhysics,
        stress: clamp(domainActivity * config.stressFromDomain, config.stressClamp[0], config.stressClamp[1]),
        pulseFactor: clamp(
          config.pulseFactorBase +
            domainActivity * config.pulseFactorFromDomain +
            pulseIntensity * config.pulseFactorFromPulse,
          config.pulseFactorClamp[0],
          config.pulseFactorClamp[1]
        ),
        emissiveBoost: clamp(
          domainActivity * config.emissiveFromDomain + pulseIntensity * config.emissiveFromPulse,
          config.emissiveClamp[0],
          config.emissiveClamp[1]
        ),
      },
    };
  }

  const config = LAW_MATRIX_V1.moon;
  return {
    v1: {
      status: resolveStatus(domainMetric),
      quality_score: resolveQuality(domainMetric),
    },
    physics: {
      ...basePhysics,
      stress: clamp(
        domainActivity * config.stressFromDomain + pulseIntensity * config.stressFromPulse,
        config.stressClamp[0],
        config.stressClamp[1]
      ),
      pulseFactor: clamp(
        config.pulseFactorBase +
          domainActivity * config.pulseFactorFromDomain +
          pulseIntensity * config.pulseFactorFromPulse,
        config.pulseFactorClamp[0],
        config.pulseFactorClamp[1]
      ),
      emissiveBoost: clamp(
        domainActivity * config.emissiveFromDomain + pulseIntensity * config.emissiveFromPulse,
        config.emissiveClamp[0],
        config.emissiveClamp[1]
      ),
    },
  };
}

export function resolveLinkLaws({
  kind,
  basePhysics = {},
  sourceDomainMetric = null,
  targetDomainMetric = null,
  sourcePulse = null,
  targetPulse = null,
  linkPulse = null,
}) {
  const sourceActivity = safeDomainActivity(sourceDomainMetric);
  const targetActivity = safeDomainActivity(targetDomainMetric);
  const sourcePulseIntensity = safePulseIntensity(sourcePulse);
  const targetPulseIntensity = safePulseIntensity(targetPulse);
  const linkPulseIntensity = safePulseIntensity(linkPulse);

  if (kind === "table") {
    const config = LAW_MATRIX_V1.tableLink;
    const flow = clamp(
      Math.max(sourceActivity, targetActivity) * config.flowFromDomain + linkPulseIntensity * config.flowFromPulse,
      0,
      1
    );
    return {
      ...basePhysics,
      flow,
      speedFactor: 1 + flow * config.speedFromFlow,
      widthFactor: 1 + flow * config.widthFromFlow,
      pulseSizeFactor: 1 + flow * config.pulseSizeFromFlow,
      opacityFactor: 1 + flow * config.opacityFromFlow,
    };
  }

  const config = LAW_MATRIX_V1.moonLink;
  const flow = clamp(
    Math.max(sourceActivity, targetActivity) * config.flowFromDomain +
      sourcePulseIntensity * config.flowFromSourcePulse +
      targetPulseIntensity * config.flowFromTargetPulse +
      linkPulseIntensity * config.flowFromLinkPulse,
    0,
    1
  );
  return {
    ...basePhysics,
    flow,
    speedFactor: 1 + flow * config.speedFromFlow,
    widthFactor: 1 + flow * config.widthFromFlow,
    pulseSizeFactor: 1 + flow * config.pulseSizeFromFlow,
    opacityFactor: 1 + flow * config.opacityFromFlow,
  };
}

function averageDomainActivity(starDomains) {
  const list = Array.isArray(starDomains) ? starDomains : [];
  if (!list.length) return 0;
  const sum = list.reduce((acc, domain) => acc + safeDomainActivity(domain), 0);
  return sum / list.length;
}

function totalDomainAlerts(starDomains) {
  const list = Array.isArray(starDomains) ? starDomains : [];
  return list.reduce((acc, domain) => {
    const alerts = Number(domain?.alerted_moons_count || 0);
    const circular = Number(domain?.circular_fields_count || 0);
    return acc + Math.max(0, alerts) + Math.max(0, circular);
  }, 0);
}

function resolveProfileByKey(key) {
  const normalized = String(key || "")
    .trim()
    .toUpperCase();
  return STAR_CORE_PROFILES[normalized] || STAR_CORE_PROFILES.ORIGIN;
}

function resolvePhysicalProfileByKey(key) {
  const normalized = String(key || "")
    .trim()
    .toUpperCase();
  return STAR_PHYSICAL_PROFILES[normalized] || STAR_PHYSICAL_PROFILES.BALANCE;
}

export function resolveStarCoreProfile({
  starRuntime = null,
  starDomains = null,
  starPolicy = null,
  starPhysicsProfile = null,
} = {}) {
  const writesPerMinute = Number(starRuntime?.writes_per_minute || 0);
  const eventsCount = Number(starRuntime?.events_count || 0);
  const domains = Array.isArray(starDomains) ? starDomains : [];
  const domainActivity = averageDomainActivity(domains);
  const domainAlerts = totalDomainAlerts(domains);

  let profile = STAR_CORE_PROFILES.ORIGIN;
  if (domainAlerts >= 2) {
    profile = STAR_CORE_PROFILES.SENTINEL;
  } else if (writesPerMinute >= 10 || domainActivity >= 0.66) {
    profile = STAR_CORE_PROFILES.FLUX;
  } else if (writesPerMinute <= 1 && eventsCount <= 12) {
    profile = STAR_CORE_PROFILES.ARCHIVE;
  }

  const lockStatus = String(starPolicy?.lock_status || "draft")
    .trim()
    .toLowerCase();
  const isLocked = lockStatus === "locked";
  const policyProfile = resolveProfileByKey(starPolicy?.profile_key);
  const policyPresetRaw = String(starPolicy?.law_preset || "").trim();
  if (isLocked) {
    profile = policyProfile;
  }

  const recommendedLawPreset = policyPresetRaw || profile.lawPreset;
  const profileMode = isLocked ? "locked" : String(starPolicy?.profile_mode || "auto");
  const physicalProfileKey = String(starPhysicsProfile?.profile_key || "BALANCE").toUpperCase();
  const physicalProfile = resolvePhysicalProfileByKey(physicalProfileKey);
  const physicalProfileVersion = Math.max(1, Number(starPhysicsProfile?.profile_version || 1));

  return {
    topologyMode: "single_star_per_galaxy",
    profileMode,
    profile,
    physicalProfile,
    physicalProfileVersion,
    recommendedLawPreset,
    writesPerMinute: Number.isFinite(writesPerMinute) ? writesPerMinute : 0,
    eventsCount: Number.isFinite(eventsCount) ? eventsCount : 0,
    domainActivity: clamp(domainActivity, 0, 1),
    domainAlerts: Math.max(0, domainAlerts),
    isLocked,
    canEditCoreLaws: isLocked ? false : Boolean(starPolicy?.can_edit_core_laws ?? true),
  };
}
