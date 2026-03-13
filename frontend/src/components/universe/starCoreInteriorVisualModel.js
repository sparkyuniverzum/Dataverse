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
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  const suffix = Math.round(safeAlpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${suffix}`;
}

function defaultTheme() {
  return {
    tonePrimary: "#7ee8ff",
    toneSecondary: "#82ffd4",
    chamberGlow: "rgba(126, 232, 255, 0.18)",
    chamberBeam: "rgba(255, 196, 116, 0.16)",
    orbitStroke: "rgba(126, 232, 255, 0.74)",
    ringStroke: "rgba(126, 232, 255, 0.42)",
    orbitFill: "rgba(126, 232, 255, 0.14)",
    coreGradient:
      "radial-gradient(circle at 50% 38%, rgba(130, 255, 212, 0.95), rgba(126, 232, 255, 0.54) 34%, rgba(5, 10, 20, 0.18) 70%)",
    shellGradient:
      "radial-gradient(circle at 50% 14%, rgba(255, 188, 107, 0.18), transparent 22%), linear-gradient(180deg, rgba(5, 12, 24, 0.98) 0%, rgba(4, 9, 19, 0.97) 58%, rgba(4, 8, 17, 0.99) 100%)",
  };
}

function resolveThemeFromConstitution(constitution) {
  const tonePrimary = normalizeHexTone(constitution?.tonePrimary, "#7ee8ff");
  const toneSecondary = normalizeHexTone(constitution?.toneSecondary, "#82ffd4");
  return {
    tonePrimary,
    toneSecondary,
    chamberGlow: withAlpha(tonePrimary, 0.18),
    chamberBeam: withAlpha(toneSecondary, 0.2),
    orbitStroke: withAlpha(tonePrimary, 0.72),
    ringStroke: withAlpha(tonePrimary, 0.38),
    orbitFill: withAlpha(toneSecondary, 0.12),
    coreGradient: `radial-gradient(circle at 50% 38%, ${withAlpha(
      toneSecondary,
      0.95
    )}, ${withAlpha(tonePrimary, 0.54)} 34%, rgba(5, 10, 20, 0.18) 70%)`,
    shellGradient: `radial-gradient(circle at 50% 14%, ${withAlpha(
      toneSecondary,
      0.18
    )}, transparent 22%), linear-gradient(180deg, rgba(5, 12, 24, 0.98) 0%, rgba(4, 9, 19, 0.97) 58%, rgba(4, 8, 17, 0.99) 100%)`,
  };
}

function createDomainSegments(items = []) {
  const domains = Array.isArray(items) ? items.slice(0, 6) : [];
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
        .slice(0, 5)
    : [];
  const count = safeTypes.length || 1;
  return safeTypes.map((eventType, index) => ({
    key: `${eventType}-${index}`,
    label: eventType.replaceAll("_", " ").toUpperCase(),
    angleDeg: (360 / count) * index - 80,
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
        .slice(0, 6)
    : [];
  const count = safePhases.length || 1;
  return safePhases.map((item, index) => ({
    key: item.phase,
    label: item.phase,
    count: item.count,
    angleDeg: (360 / count) * index + 110,
    size: clamp(0.54 + item.count * 0.08, 0.54, 0.92),
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
    (Number(pulse.peakIntensity) || 0) * 0.62 + ((Number(pulse.sampledCount) || 0) / 64) * 0.38,
    0,
    1
  );
  const domainDensity = clamp(((domains.items && domains.items.length) || 0) / 8, 0, 1);
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
  const eventHaloCount = Math.max(4, Math.min(24, Math.round(eventsCount / 6) || 4));
  const eventHaloOpacity = clamp(0.12 + runtimeTempo * 0.36 + pulseStrength * 0.26, 0.12, 0.78);
  const chamberDepth = clamp(0.24 + domainDensity * 0.48 + pulseStrength * 0.18, 0.24, 0.9);

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

function resolveStageCopy(phase, explainability) {
  if (phase === "star_core_interior_entry") {
    return {
      eyebrow: "STAR CORE INTERIOR",
      title: "Srdce hvezdy se otevira",
      body: "Komora se sklada kolem jadra a stahuje pozornost do jedineho governance ohniska.",
    };
  }
  if (phase === "policy_lock_transition") {
    return {
      eyebrow: "POLICY LOCK",
      title: explainability?.headline || "Prstenec se uzamyka",
      body: explainability?.body || "Governance vrstva se sevira a stabilizuje dalsi smer prostoru.",
    };
  }
  if (phase === "first_orbit_ready") {
    return {
      eyebrow: "FIRST ORBIT READY",
      title: explainability?.headline || "Politiky jsou uzamceny.",
      body: explainability?.body || "Prvni draha je potvrzena jako dalsi fyzicky krok prostoru.",
    };
  }
  if (phase === "policy_lock_ready") {
    return {
      eyebrow: "POLICY LOCK",
      title: explainability?.headline || "Zvoleny rezim je pripraven",
      body: explainability?.body || "Jadro se zklidnilo. Zbyva jediny krok: fyzicky uzamknout governance prstenec.",
    };
  }
  return {
    eyebrow: "CONSTITUTION SELECT",
    title: explainability?.headline || "Vyber rezim jadra",
    body: explainability?.body || "Kazdy proud meni tonalitu, puls a hustotu prvni vrstvy prostoru.",
  };
}

export function resolveStarCoreInteriorVisualModel({
  interiorModel = null,
  selectedConstitution = null,
  screenModel = null,
} = {}) {
  const phase = String(interiorModel?.phase || "constitution_select").trim() || "constitution_select";
  const theme = selectedConstitution ? resolveThemeFromConstitution(selectedConstitution) : defaultTheme();
  const phaseCopy = resolveStageCopy(phase, interiorModel?.explainability || {});
  const orbitalCount = Array.isArray(interiorModel?.availableConstitutions)
    ? interiorModel.availableConstitutions.length
    : 0;
  const telemetryProjection = resolveTelemetryProjection(interiorModel?.telemetry || {});
  const lockScaleBase = phase === "policy_lock_transition" ? 0.92 : phase === "first_orbit_ready" ? 0.88 : 1;
  const lockRingScale = clamp(lockScaleBase - telemetryProjection.criticalLoad * 0.05, 0.82, 1.06);
  const chamberOpacityBase = screenModel?.isEntering || screenModel?.isReturning ? 0.78 : 1;
  const chamberOpacity = clamp(chamberOpacityBase + telemetryProjection.runtimeTempo * 0.06, 0.78, 1);
  const chamberPulseSpeed = 0.7 + telemetryProjection.runtimeTempo * 1.8 + telemetryProjection.pulseStrength * 0.6;
  const chamberPulseScale = 1 + telemetryProjection.pulseStrength * 0.12;
  const shellGlowOpacity = clamp(
    0.28 + telemetryProjection.chamberDepth * 0.44 - telemetryProjection.criticalLoad * 0.15,
    0.2,
    0.78
  );

  return {
    phase,
    phaseCopy,
    theme,
    orbitalCount,
    showSelectionOrbit: phase === "constitution_select" || phase === "policy_lock_ready",
    showLockRing: phase === "policy_lock_ready" || phase === "policy_lock_transition" || phase === "first_orbit_ready",
    showFirstOrbit: phase === "first_orbit_ready",
    lockRingScale,
    chamberOpacity,
    chamberPulseSpeed,
    chamberPulseScale,
    shellGlowOpacity,
    stageLabel:
      phase === "policy_lock_ready"
        ? "Ritual lock"
        : phase === "policy_lock_transition"
          ? "Lock transition"
          : phase === "first_orbit_ready"
            ? "First orbit"
            : "Constitution field",
    ...telemetryProjection,
  };
}
