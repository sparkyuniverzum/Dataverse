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
