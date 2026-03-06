function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasRuntimePayload(runtimePlanetPhysics) {
  return Boolean(runtimePlanetPhysics && typeof runtimePlanetPhysics === "object");
}

function resolveRuntimeSlices(runtimePlanetPhysics) {
  const metrics =
    runtimePlanetPhysics?.metrics && typeof runtimePlanetPhysics.metrics === "object"
      ? runtimePlanetPhysics.metrics
      : {};
  const visual =
    runtimePlanetPhysics?.visual && typeof runtimePlanetPhysics.visual === "object" ? runtimePlanetPhysics.visual : {};
  return { metrics, visual };
}

export function resolveTableRuntimeLayoutPhysics(runtimePlanetPhysics) {
  if (!hasRuntimePayload(runtimePlanetPhysics)) return null;
  const { metrics, visual } = resolveRuntimeSlices(runtimePlanetPhysics);
  const sizeFactor = clamp(toFiniteNumber(visual.size_factor, 1), 0.85, 2.4);
  const stress = clamp(toFiniteNumber(metrics.stress, 0), 0, 1);
  const rows = Math.max(0, toFiniteNumber(metrics.rows, 0));
  const massFactor = clamp(1 + stress * 0.75 + Math.log10(rows + 1) * 0.12, 0.9, 2.4);
  return {
    radiusFactor: sizeFactor,
    massFactor,
  };
}

export function resolvePlanetAuthoritativePhysics(runtimePlanetPhysics, { fallbackPhysics = {} } = {}) {
  if (!hasRuntimePayload(runtimePlanetPhysics)) {
    return {
      status: null,
      qualityScore: null,
      physics: {},
    };
  }
  const { metrics, visual } = resolveRuntimeSlices(runtimePlanetPhysics);
  const fallback = fallbackPhysics && typeof fallbackPhysics === "object" ? fallbackPhysics : {};

  const health = clamp(toFiniteNumber(metrics.health, 0), 0, 1);
  const corrosionFromMetrics = clamp(toFiniteNumber(metrics.corrosion, 0), 0, 1);
  const corrosionVisualRaw = Number(visual.corrosion_level);
  const corrosionLevel = clamp(Number.isFinite(corrosionVisualRaw) ? corrosionVisualRaw : corrosionFromMetrics, 0, 1);

  const phaseRaw = String(runtimePlanetPhysics?.phase ?? "").trim();
  const status = phaseRaw ? phaseRaw.toUpperCase() : null;

  return {
    status,
    qualityScore: Math.round(health * 100),
    physics: {
      stress: clamp(toFiniteNumber(metrics.stress, toFiniteNumber(fallback.stress, 0)), 0, 1),
      radiusFactor: clamp(toFiniteNumber(visual.size_factor, 1), 0.85, 2.4),
      pulseFactor: clamp(toFiniteNumber(visual.pulse_rate, toFiniteNumber(fallback.pulseFactor, 1)), 0.82, 2.4),
      emissiveBoost: clamp(toFiniteNumber(visual.luminosity, toFiniteNumber(fallback.emissiveBoost, 0)), 0, 1),
      auraFactor: clamp(1 + (1 - health) * 0.5 + corrosionLevel * 0.3, 0.9, 2.2),
      alertPressure: clamp(corrosionLevel * 0.7 + (1 - health) * 0.3, 0, 1),
      corrosionLevel,
      crackIntensity: clamp(toFiniteNumber(visual.crack_intensity, 0), 0, 1),
      hue: clamp(toFiniteNumber(visual.hue, 0), 0, 1),
      saturation: clamp(toFiniteNumber(visual.saturation, 0), 0, 1),
    },
  };
}

export function resolveMoonParentRuntimePhysics(runtimePlanetPhysics) {
  if (!hasRuntimePayload(runtimePlanetPhysics)) {
    return {
      parentPhase: null,
      parentCorrosion: 0,
      parentCrack: 0,
      parentHue: 0,
      parentSaturation: 0,
    };
  }
  const { metrics, visual } = resolveRuntimeSlices(runtimePlanetPhysics);
  const phaseRaw = String(runtimePlanetPhysics?.phase ?? "").trim();
  const parentPhase = phaseRaw ? phaseRaw.toUpperCase() : null;
  const corrosionFromMetrics = clamp(toFiniteNumber(metrics.corrosion, 0), 0, 1);
  const corrosionVisualRaw = Number(visual.corrosion_level);
  const parentCorrosion = clamp(Number.isFinite(corrosionVisualRaw) ? corrosionVisualRaw : corrosionFromMetrics, 0, 1);
  return {
    parentPhase,
    parentCorrosion,
    parentCrack: clamp(toFiniteNumber(visual.crack_intensity, 0), 0, 1),
    parentHue: clamp(toFiniteNumber(visual.hue, 0), 0, 1),
    parentSaturation: clamp(toFiniteNumber(visual.saturation, 0), 0, 1),
  };
}
