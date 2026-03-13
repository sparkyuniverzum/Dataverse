function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readVisualPosition(item) {
  if (!item || typeof item !== "object") return null;
  const visualPosition = item.visual_position || item.visualPosition || item.planet_visual_position;
  if (!visualPosition || typeof visualPosition !== "object") return null;
  return {
    x: normalizeNumber(visualPosition.x, 0),
    y: normalizeNumber(visualPosition.y, 0),
    z: normalizeNumber(visualPosition.z, 0),
  };
}

function normalizeCenter(center, fallbackX, fallbackZ) {
  if (Array.isArray(center) && center.length >= 2) {
    return {
      x: normalizeNumber(center[0], fallbackX),
      z: normalizeNumber(center[1], fallbackZ),
    };
  }
  if (center && typeof center === "object") {
    return {
      x: normalizeNumber(center.x ?? center.left ?? center.lng, fallbackX),
      z: normalizeNumber(center.z ?? center.y ?? center.top, fallbackZ),
    };
  }
  return {
    x: fallbackX,
    z: fallbackZ,
  };
}

function buildFallbackOrbit(index, total) {
  const count = Math.max(total, 1);
  const theta = (index / count) * Math.PI * 2;
  const radius = 5.8 + (index % 3) * 1.55;
  return {
    x: Math.cos(theta) * radius,
    z: Math.sin(theta) * radius,
  };
}

function resolveOrbitMode(item) {
  return normalizeText(item?.sector?.mode || item?.sector_mode || item?.archetype, "stable").toLowerCase();
}

function buildPlanetPhysicsIndex(planetPhysicsPayload) {
  const items = Array.isArray(planetPhysicsPayload?.items) ? planetPhysicsPayload.items : [];
  return new Map(
    items
      .map((item) => {
        const tableId = normalizeText(item?.table_id);
        if (!tableId) return null;
        return [tableId, item];
      })
      .filter(Boolean)
  );
}

function resolvePlanetPhysicsProjection(runtimePlanetPhysics) {
  const metrics =
    runtimePlanetPhysics?.metrics && typeof runtimePlanetPhysics.metrics === "object"
      ? runtimePlanetPhysics.metrics
      : {};
  const visual =
    runtimePlanetPhysics?.visual && typeof runtimePlanetPhysics.visual === "object" ? runtimePlanetPhysics.visual : {};
  const phase = normalizeText(runtimePlanetPhysics?.phase, "CALM").toUpperCase();
  const rows = Math.max(0, Math.floor(normalizeNumber(metrics.rows, 0)));
  const stress = clamp(normalizeNumber(metrics.stress, 0), 0, 1);
  const health = clamp(normalizeNumber(metrics.health, 1), 0, 1);
  const corrosionMetrics = clamp(normalizeNumber(metrics.corrosion, 0), 0, 1);
  const corrosionLevel = clamp(normalizeNumber(visual.corrosion_level, corrosionMetrics), 0, 1);
  const radiusFactor = clamp(normalizeNumber(visual.size_factor, 1), 0.85, 2.4);
  const pulseFactor = clamp(normalizeNumber(visual.pulse_rate, 1), 0.82, 2.4);
  const emissiveBoost = clamp(normalizeNumber(visual.luminosity, 0), 0, 1);
  const hue = clamp(normalizeNumber(visual.hue, 0.55), 0, 1);
  const saturation = clamp(normalizeNumber(visual.saturation, 0.55), 0, 1);
  const crackIntensity = clamp(normalizeNumber(visual.crack_intensity, 0), 0, 1);
  const alertPressure = clamp(corrosionLevel * 0.7 + (1 - health) * 0.3 + stress * 0.2, 0, 1);

  return {
    phase,
    rows,
    stress,
    health,
    corrosionLevel,
    radiusFactor,
    pulseFactor,
    emissiveBoost,
    hue,
    saturation,
    crackIntensity,
    alertPressure,
  };
}

function resolvePlanetPalette({ hue, saturation, emissiveBoost, alertPressure }) {
  const normalizedHue = 190 + (hue - 0.5) * 90;
  const baseSaturation = 42 + saturation * 38;
  const baseLightness = 52 + emissiveBoost * 12 - alertPressure * 8;
  const accentHue = normalizedHue - 24;
  const accentLightness = 68 + emissiveBoost * 10;
  const alertHue = 18 + alertPressure * 18;

  return {
    primary: `hsl(${normalizedHue.toFixed(1)}deg ${baseSaturation.toFixed(1)}% ${clamp(baseLightness, 38, 72).toFixed(1)}%)`,
    accent: `hsl(${accentHue.toFixed(1)}deg ${(baseSaturation + 10).toFixed(1)}% ${clamp(accentLightness, 56, 84).toFixed(1)}%)`,
    alert: `hsl(${alertHue.toFixed(1)}deg ${(68 + alertPressure * 18).toFixed(1)}% ${(60 + alertPressure * 8).toFixed(1)}%)`,
  };
}

function resolvePlanetMetrics(item) {
  const members = Math.max(0, normalizeNumber(item?.members, 0));
  const schemaFields = Array.isArray(item?.schema_fields) ? item.schema_fields.length : 0;
  const formulaFields = Array.isArray(item?.formula_fields) ? item.formula_fields.length : 0;
  const internalBonds = Math.max(0, normalizeNumber(item?.internal_bonds, 0));
  const externalBonds = Math.max(0, normalizeNumber(item?.external_bonds, 0));

  return {
    members,
    complexity: schemaFields + formulaFields,
    bondLoad: internalBonds + externalBonds,
  };
}

function normalizeTableRow(item, index, total, physicsIndex) {
  if (!item || typeof item !== "object") return null;
  const id = normalizeText(item.table_id || item.id);
  if (!id) return null;

  const fallback = buildFallbackOrbit(index, total);
  const visualPosition = readVisualPosition(item);
  const center = visualPosition
    ? { x: visualPosition.x * 0.055, z: visualPosition.z * 0.055 }
    : normalizeCenter(item?.sector?.center, fallback.x, fallback.z);
  const sectorSize = normalizeNumber(item?.sector?.size, 1);
  const orbitMode = resolveOrbitMode(item);
  const metrics = resolvePlanetMetrics(item);
  const physicsProjection = resolvePlanetPhysicsProjection(physicsIndex.get(id));
  const palette = resolvePlanetPalette(physicsProjection);
  const size = clamp(
    0.92 + sectorSize * 0.26 + physicsProjection.radiusFactor * 0.36 + Math.log10(metrics.members + 1) * 0.22,
    1,
    2.9
  );
  const orbitRadius = clamp(size * (1.5 + physicsProjection.radiusFactor * 0.2), 1.9, 4.8);
  const verticalOffset = normalizeNumber(item?.sector?.height, 0);
  const approachDistance = clamp(4.6 + size * 0.9, 5.2, 8.1);

  return {
    id,
    type: "planet",
    label: normalizeText(item.planet_name || item.name || `Planeta ${index + 1}`),
    subtitle: normalizeText(item.constellation_name || item.archetype, ""),
    statusLabel: physicsProjection.phase,
    orbitMode,
    position: [center.x, verticalOffset, center.z],
    size,
    orbitRadius,
    approachDistance,
    pulseSpeed: physicsProjection.pulseFactor,
    emissiveBoost: physicsProjection.emissiveBoost,
    alertPressure: physicsProjection.alertPressure,
    corrosionLevel: physicsProjection.corrosionLevel,
    crackIntensity: physicsProjection.crackIntensity,
    qualityScore: Math.round(physicsProjection.health * 100),
    complexity: metrics.complexity,
    bondLoad: metrics.bondLoad,
    rows: physicsProjection.rows,
    palette,
    source: item,
  };
}

export function buildGalaxyPlanetObjects({ tableRows = [], planetPhysicsPayload = null } = {}) {
  const rows = Array.isArray(tableRows) ? tableRows : [];
  const physicsIndex = buildPlanetPhysicsIndex(planetPhysicsPayload);
  return rows.map((item, index) => normalizeTableRow(item, index, rows.length, physicsIndex)).filter(Boolean);
}
