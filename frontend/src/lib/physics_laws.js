function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function saturateCount(count, softness) {
  const safeCount = Math.max(0, asNumber(count, 0));
  const safeSoftness = Math.max(0.001, asNumber(softness, 1));
  return 1 - Math.exp(-safeCount / safeSoftness);
}

export function normalizePhysicsKey(value) {
  return String(value || "").trim().toLowerCase();
}

export const DEFAULT_NODE_PHYSICS = Object.freeze({
  quality: 1,
  stress: 0,
  alertPressure: 0,
  bondDensity: 0,
  massFactor: 1,
  radiusFactor: 1,
  spinFactor: 1,
  emissiveBoost: 0,
  auraFactor: 1,
  pulseFactor: 1,
});

export const DEFAULT_LINK_PHYSICS = Object.freeze({
  stress: 0,
  flow: 0,
  widthFactor: 1,
  speedFactor: 1,
  opacityFactor: 1,
  pulseSizeFactor: 1,
});

export function derivePlanetPhysics({
  planetMetrics = null,
  constellationMetrics = null,
  bondDensity = 0,
}) {
  const planetQuality = clamp(asNumber(planetMetrics?.quality_score, 100) / 100, 0, 1);
  const constellationQuality = clamp(asNumber(constellationMetrics?.quality_score, 100) / 100, 0, 1);
  const quality = clamp(planetQuality * 0.72 + constellationQuality * 0.28, 0, 1);

  const alerts = asNumber(planetMetrics?.alerted_moons_count, 0) + asNumber(constellationMetrics?.alerted_moons_count, 0) * 0.5;
  const circular = asNumber(planetMetrics?.circular_fields_count, 0) + asNumber(constellationMetrics?.circular_fields_count, 0) * 0.45;
  const alertPressure = clamp(saturateCount(alerts, 3.2) * 0.58 + saturateCount(circular, 2.6) * 0.42, 0, 1);

  const safeBondDensity = clamp(asNumber(bondDensity, 0), 0, 1);
  const stress = clamp((1 - quality) * 0.62 + alertPressure * 0.28 + safeBondDensity * 0.1, 0, 1);

  return {
    quality,
    stress,
    alertPressure,
    bondDensity: safeBondDensity,
    massFactor: clamp(0.96 + safeBondDensity * 0.55 + stress * 0.24, 0.85, 1.9),
    radiusFactor: clamp(0.95 + safeBondDensity * 0.25 + stress * 0.16, 0.9, 1.32),
    spinFactor: clamp(0.82 + stress * 1.18, 0.82, 2.05),
    emissiveBoost: clamp(stress * 0.55 + alertPressure * 0.18, 0, 0.82),
    auraFactor: clamp(0.92 + stress * 0.78 + safeBondDensity * 0.22, 0.9, 2.1),
    pulseFactor: clamp(0.9 + stress * 0.95 + safeBondDensity * 0.32, 0.9, 2.25),
  };
}

export function normalizeNodePhysicsFromBackend(rawPhysics, { fallback = DEFAULT_NODE_PHYSICS } = {}) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_NODE_PHYSICS;
  const raw = rawPhysics && typeof rawPhysics === "object" && !Array.isArray(rawPhysics) ? rawPhysics : null;
  if (!raw) return base;

  const stress = clamp(asNumber(raw.stress ?? raw.stress_score, base.stress), 0, 1);
  const massFactor = clamp(asNumber(raw.massFactor ?? raw.mass_factor, base.massFactor), 0.82, 2.1);
  const radiusFactor = clamp(asNumber(raw.radiusFactor ?? raw.radius_factor, base.radiusFactor), 0.84, 1.42);
  const emissiveBoost = clamp(asNumber(raw.emissiveBoost ?? raw.emissive_boost, base.emissiveBoost), 0, 1);
  const pulseFactor = clamp(asNumber(raw.pulseFactor ?? raw.pulse_factor, base.pulseFactor), 0.9, 2.5);
  const opacityFactor = clamp(asNumber(raw.opacityFactor ?? raw.opacity_factor, 1), 0.4, 1.2);
  const attractionFactor = clamp(asNumber(raw.attractionFactor ?? raw.attraction_factor, 1), 0.85, 2.6);
  const spinFactor = clamp(asNumber(raw.spinFactor ?? raw.spin_factor, 0.84 + stress * 1.06), 0.82, 2.2);
  const auraFactor = clamp(
    asNumber(raw.auraFactor ?? raw.aura_factor, 0.92 + stress * 0.84 + (attractionFactor - 1) * 0.36),
    0.9,
    2.3
  );
  const alertPressure = clamp(asNumber(raw.alertPressure ?? raw.alert_pressure, base.alertPressure), 0, 1);
  const bondDensity = clamp(asNumber(raw.bondDensity ?? raw.bond_density, base.bondDensity), 0, 1);
  const quality = clamp(asNumber(raw.quality, base.quality), 0, 1);

  return {
    ...base,
    quality,
    stress,
    alertPressure,
    bondDensity,
    massFactor,
    radiusFactor,
    spinFactor,
    emissiveBoost,
    auraFactor,
    pulseFactor,
    opacityFactor,
    attractionFactor,
  };
}

export function deriveMoonPhysics({
  moonMetrics = null,
  bondDensity = 0,
}) {
  const quality = clamp(asNumber(moonMetrics?.quality_score, 100) / 100, 0, 1);
  const alerts = asNumber(moonMetrics?.active_alerts_count, 0);
  const circular = asNumber(moonMetrics?.circular_fields_count, 0);
  const alertPressure = clamp(saturateCount(alerts, 1.6) * 0.62 + saturateCount(circular, 1.8) * 0.38, 0, 1);
  const safeBondDensity = clamp(asNumber(bondDensity, 0), 0, 1);
  const stress = clamp((1 - quality) * 0.66 + alertPressure * 0.28 + safeBondDensity * 0.06, 0, 1);

  return {
    quality,
    stress,
    alertPressure,
    bondDensity: safeBondDensity,
    massFactor: clamp(0.92 + safeBondDensity * 0.34 + stress * 0.22, 0.84, 1.72),
    radiusFactor: clamp(0.9 + stress * 0.34 + safeBondDensity * 0.14, 0.88, 1.28),
    spinFactor: clamp(0.9 + stress * 0.74, 0.9, 1.95),
    emissiveBoost: clamp(stress * 0.62 + alertPressure * 0.22, 0, 0.95),
    auraFactor: clamp(0.92 + stress * 0.98, 0.9, 2.1),
    pulseFactor: clamp(0.92 + stress * 1.08 + safeBondDensity * 0.22, 0.9, 2.35),
  };
}

export function deriveLinkPhysics({
  link = null,
  bondMetrics = null,
  sourcePhysics = DEFAULT_NODE_PHYSICS,
  targetPhysics = DEFAULT_NODE_PHYSICS,
}) {
  const quality = clamp(asNumber(bondMetrics?.quality_score, 100) / 100, 0, 1);
  const alerts = asNumber(bondMetrics?.active_alerts_count, 0);
  const circular = asNumber(bondMetrics?.circular_fields_count, 0);
  const alertPressure = clamp(saturateCount(alerts, 2.4) * 0.58 + saturateCount(circular, 2.2) * 0.42, 0, 1);
  const endpointStress = clamp((asNumber(sourcePhysics?.stress, 0) + asNumber(targetPhysics?.stress, 0)) * 0.5, 0, 1);
  const weight = Math.max(1, asNumber(link?.weight, 1));
  const flow = clamp(saturateCount(weight - 1, 1.5), 0, 1);

  const stress = clamp((1 - quality) * 0.56 + alertPressure * 0.26 + endpointStress * 0.18, 0, 1);
  return {
    stress,
    flow,
    widthFactor: clamp(0.95 + flow * 0.58 + stress * 0.38, 0.9, 2.35),
    speedFactor: clamp(0.88 + flow * 0.54 + stress * 0.66, 0.82, 2.5),
    opacityFactor: clamp(0.92 + stress * 0.18, 0.9, 1.18),
    pulseSizeFactor: clamp(0.92 + flow * 0.48 + stress * 0.52, 0.9, 2.3),
  };
}

export function normalizeLinkPhysicsFromBackend(
  rawPhysics,
  { fallback = DEFAULT_LINK_PHYSICS, link = null } = {}
) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_LINK_PHYSICS;
  const raw = rawPhysics && typeof rawPhysics === "object" && !Array.isArray(rawPhysics) ? rawPhysics : null;
  if (!raw) return base;

  const linkType = String(link?.type || "RELATION").toUpperCase();
  const defaultFlow = linkType === "FLOW" ? 0.78 : linkType === "GUARDIAN" ? 0.42 : 0.2;
  const stress = clamp(asNumber(raw.stress ?? raw.stress_score, base.stress), 0, 1);
  const flow = clamp(asNumber(raw.flow ?? raw.flow_factor, base.flow ?? defaultFlow), 0, 1);
  const widthFactor = clamp(asNumber(raw.widthFactor ?? raw.width_factor ?? raw.radius_factor, base.widthFactor), 0.9, 2.35);
  const speedFactor = clamp(asNumber(raw.speedFactor ?? raw.speed_factor ?? raw.pulse_factor, base.speedFactor), 0.82, 2.5);
  const opacityFactor = clamp(asNumber(raw.opacityFactor ?? raw.opacity_factor, base.opacityFactor), 0.9, 1.18);
  const pulseSizeFactor = clamp(
    asNumber(raw.pulseSizeFactor ?? raw.pulse_size_factor ?? raw.mass_factor, base.pulseSizeFactor),
    0.9,
    2.3
  );

  return {
    ...base,
    stress,
    flow,
    widthFactor,
    speedFactor,
    opacityFactor,
    pulseSizeFactor,
  };
}

export function deriveTableBondDensity(table) {
  const moonsCount = Math.max(1, asNumber(table?.members?.length, 1));
  const internalBonds = asNumber(table?.internal_bonds?.length, 0);
  const externalBonds = asNumber(table?.external_bonds?.length, 0);
  const raw = (internalBonds + externalBonds * 1.2) / moonsCount;
  return clamp(1 - Math.exp(-raw * 0.75), 0, 1);
}

export function deriveAsteroidBondDensityMap(bonds) {
  const counts = new Map();
  const safeBonds = Array.isArray(bonds) ? bonds : [];

  safeBonds.forEach((bond) => {
    const sourceId = String(bond?.source_id || bond?.source || "");
    const targetId = String(bond?.target_id || bond?.target || "");
    if (sourceId) counts.set(sourceId, (counts.get(sourceId) || 0) + 1);
    if (targetId) counts.set(targetId, (counts.get(targetId) || 0) + 1);
  });

  const normalized = new Map();
  counts.forEach((count, asteroidId) => {
    normalized.set(asteroidId, clamp(1 - Math.exp(-count / 2.4), 0, 1));
  });
  return normalized;
}
