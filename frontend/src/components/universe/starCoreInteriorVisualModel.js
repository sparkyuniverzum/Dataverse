function normalizeHexTone(value, fallback) {
  const tone = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(tone)) return tone;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function withAlpha(hex, alpha) {
  const normalized = normalizeHexTone(hex, "#7ee8ff");
  const safeAlpha = clamp(Number(alpha) || 0, 0, 1);
  const suffix = Math.round(safeAlpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${suffix}`;
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(numeric)));
}

function formatRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.0";
  return numeric.toFixed(1);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.round(clamp(numeric, 0, 1) * 100));
}

function defaultTheme() {
  return {
    tonePrimary: "#a6d6f4",
    toneSecondary: "#f6ebcf",
    toneAccent: "#e7b56d",
    chamberGlow: "rgba(166, 214, 244, 0.22)",
    chamberBeam: "rgba(231, 181, 109, 0.18)",
    orbitStroke: "rgba(166, 214, 244, 0.54)",
    ringStroke: "rgba(246, 235, 207, 0.2)",
    orbitFill: "rgba(246, 235, 207, 0.08)",
    shellGradient:
      "radial-gradient(circle at 50% 18%, rgba(246, 235, 207, 0.08), transparent 20%), radial-gradient(circle at 50% 44%, rgba(166, 214, 244, 0.1), rgba(4, 9, 18, 0.82) 36%, rgba(2, 4, 10, 0.98) 100%)",
  };
}

function resolveThemeFromConstitution(constitution) {
  const tonePrimary = normalizeHexTone(constitution?.tonePrimary, "#7ee8ff");
  const toneSecondary = normalizeHexTone(constitution?.toneSecondary, "#82ffd4");
  return {
    tonePrimary,
    toneSecondary,
    toneAccent: withAlpha(toneSecondary, 0.84).slice(0, 7),
    chamberGlow: withAlpha(tonePrimary, 0.2),
    chamberBeam: withAlpha(toneSecondary, 0.22),
    orbitStroke: withAlpha(tonePrimary, 0.72),
    ringStroke: withAlpha(tonePrimary, 0.38),
    orbitFill: withAlpha(toneSecondary, 0.12),
    shellGradient: `radial-gradient(circle at 50% 45%, ${withAlpha(
      toneSecondary,
      0.15
    )}, rgba(4, 9, 18, 0.82) 36%, rgba(2, 4, 10, 0.98) 100%)`,
  };
}

function createDomainSegments(items = []) {
  const domains = Array.isArray(items) ? items.slice(0, 8) : [];
  const count = domains.length || 1;
  return domains.map((item, index) => ({
    key: String(item.domainName || `domain-${index}`),
    angleDeg: (360 / count) * index - 90,
    status: String(item.status || "stable").toLowerCase(),
    intensity: clamp(Number(item.activityIntensity) || 0, 0, 1),
  }));
}

function createPulseBeacons(eventTypes = []) {
  const safeTypes = Array.isArray(eventTypes)
    ? eventTypes
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const count = safeTypes.length || 1;
  return safeTypes.map((eventType, index) => ({
    key: `${eventType}-${index}`,
    label: eventType.replaceAll("_", " ").toUpperCase(),
    angleDeg: (360 / count) * index - 90,
  }));
}

function createPlanetaryNodes(phaseCounts = []) {
  const safePhases = Array.isArray(phaseCounts)
    ? phaseCounts
        .map((item) => ({
          phase: String(item?.phase || "CALM")
            .trim()
            .toUpperCase(),
          count: Math.max(0, Math.floor(Number(item?.count) || 0)),
        }))
        .filter((item) => item.count > 0)
        .slice(0, 8)
    : [];
  const count = safePhases.length || 1;
  return safePhases.map((item, index) => ({
    key: item.phase,
    label: item.phase,
    count: item.count,
    angleDeg: (360 / count) * index + 120,
    size: clamp(0.34 + item.count * 0.06, 0.34, 0.72),
  }));
}

function createConstitutionGlyphs(options = [], selectedId = "") {
  const safeOptions = Array.isArray(options) ? options : [];
  const count = safeOptions.length || 1;
  return safeOptions.map((option, index) => ({
    id: option.id,
    title: option.title,
    selected: option.id === selectedId,
    angleDeg: (360 / count) * index - 90,
    tonePrimary: normalizeHexTone(option.tonePrimary, "#7ee8ff"),
    toneSecondary: normalizeHexTone(option.toneSecondary, "#82ffd4"),
  }));
}

function resolveTelemetryProjection(telemetry) {
  const runtime = telemetry?.runtime || {};
  const pulse = telemetry?.pulse || {};
  const domains = telemetry?.domains || {};
  const planetPhysics = telemetry?.planetPhysics || {};
  const eventsCount = Math.max(0, Number(runtime.eventsCount) || 0);
  const runtimeTempo = clamp((Number(runtime.writesPerMinute) || 0) / 120, 0, 1);
  const pulseStrength = clamp(
    (Number(pulse.peakIntensity) || 0) * 0.65 + ((Number(pulse.sampledCount) || 0) / 96) * 0.35,
    0,
    1
  );
  const domainDensity = clamp(((domains.items && domains.items.length) || 0) / 10, 0, 1);
  const planetActivity = clamp(
    (Number(planetPhysics.activeCount) || 0) / Math.max(1, Number(planetPhysics.itemCount) || 0),
    0,
    1
  );
  const criticalLoad = clamp(
    (Number(planetPhysics.criticalCount) || 0) / Math.max(1, Number(planetPhysics.itemCount) || 0),
    0,
    1
  );
  const eventHaloCount = Math.max(8, Math.min(64, Math.round(eventsCount / 2) || 8));
  const eventHaloOpacity = clamp(0.16 + runtimeTempo * 0.3 + pulseStrength * 0.22, 0.16, 0.82);
  const chamberDepth = clamp(0.25 + domainDensity * 0.46 + pulseStrength * 0.2, 0.25, 0.92);

  return {
    eventsCount,
    runtimeTempo,
    pulseStrength,
    domainDensity,
    planetActivity,
    criticalLoad,
    eventHaloCount,
    eventHaloOpacity,
    chamberDepth,
    domainSegments: createDomainSegments(domains.items),
    pulseBeacons: createPulseBeacons(pulse.eventTypes),
    planetaryNodes: createPlanetaryNodes(planetPhysics.phaseCounts),
  };
}

function buildMetricStreams({ telemetryProjection, telemetry }) {
  const runtime = telemetry?.runtime || {};
  const domains = telemetry?.domains || {};
  const planetPhysics = telemetry?.planetPhysics || {};
  const pulse = telemetry?.pulse || {};

  return [
    {
      key: "tok",
      label: "Tok",
      value: `${formatRate(runtime.writesPerMinute)}/min`,
      intensity: telemetryProjection.runtimeTempo,
      angleDeg: -110,
    },
    {
      key: "udalosti",
      label: "Udalosti",
      value: formatCount(telemetryProjection.eventsCount),
      intensity: telemetryProjection.eventHaloOpacity,
      angleDeg: -45,
    },
    {
      key: "domeny",
      label: "Domeny",
      value: formatCount(domains.items?.length || 0),
      intensity: telemetryProjection.domainDensity,
      angleDeg: 22,
    },
    {
      key: "planety",
      label: "Planety",
      value: formatCount(planetPhysics.itemCount),
      intensity: telemetryProjection.planetActivity,
      angleDeg: 158,
    },
    {
      key: "aktivita",
      label: "Aktivita",
      value: `${formatPercent(telemetryProjection.planetActivity)}%`,
      intensity: telemetryProjection.pulseStrength,
      angleDeg: 212,
    },
    {
      key: "seq",
      label: "Event seq",
      value: formatCount(pulse.lastEventSeq),
      intensity: telemetryProjection.chamberDepth,
      angleDeg: 258,
    },
  ];
}

function resolveStageCopy(phase, explainability) {
  if (phase === "star_core_interior_entry") {
    return {
      eyebrow: "THE DIVE",
      title: "Prunik do srdce hvezdy",
      body: "Povrchove vrstvy ustupuji a odhaluji centralni komoru, kde se ustavuje rad galaxie.",
    };
  }
  if (phase === "policy_lock_transition") {
    return {
      eyebrow: "SEALING THE CORE",
      title: explainability?.headline || "Jadro se stabilizuje",
      body: explainability?.body || "Chaoticke pole se stahuje a architektura prechazi do canonical rytmu.",
    };
  }
  if (phase === "first_orbit_ready") {
    return {
      eyebrow: "CANONICAL ORDER",
      title: explainability?.headline || "Prvni orbita je potvrzena",
      body: explainability?.body || "Jadro je stabilni a pripraveno drzet zakonitosti galaxie bez dalsich mutaci.",
    };
  }
  if (phase === "policy_lock_ready") {
    return {
      eyebrow: "RITUAL OF FORMATION",
      title: explainability?.headline || "Jadro ceka na zakon",
      body: explainability?.body || "Vyber ustavu a potvrd vznik radu, ktery bude drzet celou galaxii pohromade.",
    };
  }
  return {
    eyebrow: "PRIMORDIAL FIELD",
    title: explainability?.headline || "Nastav fyziku jadra",
    body: explainability?.body || "Kazda ustava okamzite meni puls, hustotu a rytmus celeho prostoru.",
  };
}

function resolveGovernanceLockStrength(phase) {
  if (phase === "policy_lock_transition") return 0.92;
  if (phase === "first_orbit_ready") return 0.82;
  if (phase === "policy_lock_ready") return 0.58;
  return 0.22;
}

function resolveStability(phase, mode) {
  if (mode === "observatory") return 0.96;
  if (phase === "policy_lock_transition") return 0.7;
  if (phase === "policy_lock_ready") return 0.46;
  return 0.18;
}

function buildAstrolabeRings(telemetryProjection, governanceLockStrength) {
  return [
    {
      key: "governance",
      radius: 2.64 - governanceLockStrength * 0.22,
      tube: 0.07 + governanceLockStrength * 0.02,
      speed: 0.18 + telemetryProjection.runtimeTempo * 0.18,
      opacity: 0.2 + telemetryProjection.domainDensity * 0.18 + governanceLockStrength * 0.12,
      tilt: [1.04, 0.2, 0.08],
    },
    {
      key: "runtime",
      radius: 3.24 - governanceLockStrength * 0.12,
      tube: 0.04,
      speed: -0.22 - telemetryProjection.pulseStrength * 0.26,
      opacity: 0.16 + telemetryProjection.runtimeTempo * 0.22 + governanceLockStrength * 0.08,
      tilt: [1.34, -0.22, 0.18],
    },
    {
      key: "planetary",
      radius: 3.58,
      tube: 0.024,
      speed: 0.16 + telemetryProjection.planetActivity * 0.24,
      opacity: 0.06 + telemetryProjection.planetActivity * 0.08,
      tilt: [1.54, 0.16, -0.12],
    },
  ];
}

export function resolveStarCoreInteriorVisualModel({
  interiorModel = null,
  selectedConstitution = null,
  screenModel = null,
} = {}) {
  const phase = String(interiorModel?.phase || "constitution_select").trim() || "constitution_select";
  const telemetry = interiorModel?.telemetry || {};
  const mode = String(interiorModel?.mode || "ritual").trim() || "ritual";
  const telemetryProjection = resolveTelemetryProjection(telemetry);
  const theme = selectedConstitution ? resolveThemeFromConstitution(selectedConstitution) : defaultTheme();
  const phaseCopy = resolveStageCopy(phase, interiorModel?.explainability || {});
  const governanceLockStrength = resolveGovernanceLockStrength(phase);
  const stability = resolveStability(phase, mode);
  const chaosIntensity = clamp(1 - stability, 0.04, 1);
  const lockScaleBase = phase === "policy_lock_transition" ? 0.92 : phase === "first_orbit_ready" ? 0.88 : 1;
  const lockRingScale = clamp(lockScaleBase - telemetryProjection.criticalLoad * 0.05, 0.82, 1.06);
  const chamberOpacityBase = screenModel?.isEntering || screenModel?.isReturning ? 0.78 : 1;
  const chamberOpacity = clamp(chamberOpacityBase + telemetryProjection.runtimeTempo * 0.06, 0.78, 1);
  const chamberPulseSpeed = 0.75 + telemetryProjection.runtimeTempo * 1.6 + telemetryProjection.pulseStrength * 0.7;
  const chamberPulseScale = 1 + telemetryProjection.pulseStrength * 0.14;
  const shellGlowOpacity = clamp(
    0.24 + telemetryProjection.chamberDepth * 0.42 - telemetryProjection.criticalLoad * 0.14,
    0.2,
    0.78
  );
  const constitutionOptions = Array.isArray(interiorModel?.availableConstitutions)
    ? interiorModel.availableConstitutions
    : [];

  return {
    phase,
    mode,
    phaseCopy,
    theme,
    stability,
    chaosIntensity,
    orbitalCount: constitutionOptions.length,
    showSelectionOrbit: phase === "constitution_select" || phase === "policy_lock_ready",
    showConstitutionField: phase === "constitution_select" || phase === "policy_lock_ready",
    showLockRing: phase === "policy_lock_ready" || phase === "policy_lock_transition" || phase === "first_orbit_ready",
    showFirstOrbit: phase === "first_orbit_ready",
    governanceLockStrength,
    lockRingScale,
    chamberOpacity,
    chamberPulseSpeed,
    chamberPulseScale,
    shellGlowOpacity,
    stageLabel:
      phase === "policy_lock_ready"
        ? "Governance astrolabe"
        : phase === "policy_lock_transition"
          ? "Lock transition"
          : phase === "first_orbit_ready"
            ? "First orbit"
            : "Core alignment",
    hudCoreStatus: telemetryProjection.criticalLoad >= 0.45 ? "CORE STATUS: ELEVATED" : "CORE STATUS: NOMINAL",
    hudPolicyStatus:
      phase === "first_orbit_ready" || String(interiorModel?.governanceSignal?.lockStatus || "") === "locked"
        ? "POLICY: LOCKED"
        : phase === "policy_lock_transition"
          ? "POLICY: LOCKING"
          : "POLICY: DRAFT",
    astrolabeRings: buildAstrolabeRings(telemetryProjection, governanceLockStrength),
    constitutionGlyphs: createConstitutionGlyphs(constitutionOptions, selectedConstitution?.id || ""),
    metricStreams: buildMetricStreams({ telemetryProjection, telemetry }),
    eventSwarmCount: telemetryProjection.eventHaloCount,
    ...telemetryProjection,
  };
}
