function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeTableRow(item, index, total) {
  if (!item || typeof item !== "object") return null;
  const id = normalizeText(item.table_id || item.id);
  if (!id) return null;
  const fallback = buildFallbackOrbit(index, total);
  const center = normalizeCenter(item?.sector?.center, fallback.x, fallback.z);
  const sectorSize = normalizeNumber(item?.sector?.size, 1);

  return {
    id,
    type: "planet",
    label: normalizeText(item.planet_name || item.name || `Planeta ${index + 1}`),
    subtitle: normalizeText(item.constellation_name || item.archetype, ""),
    position: [center.x, normalizeNumber(item?.sector?.height, 0), center.z],
    size: Math.max(0.8, Math.min(2.4, sectorSize * 0.42 + 0.9)),
    source: item,
  };
}

export function buildGalaxySpaceObjects({ starModel, tableRows = [] } = {}) {
  const starObject = {
    id: "star-core",
    type: "star",
    label: "Srdce hvězdy",
    subtitle: normalizeText(starModel?.galaxyName || "Galaxie", ""),
    position: [0, 0.4, 0],
    size: 3.2,
    source: starModel,
  };

  const planets = (Array.isArray(tableRows) ? tableRows : [])
    .map((item, index, rows) => normalizeTableRow(item, index, rows.length))
    .filter(Boolean);

  return [starObject, ...planets];
}

function resolveRadarPoint(position, span) {
  const x = normalizeNumber(position?.[0], 0);
  const z = normalizeNumber(position?.[2], 0);
  const normalizedX = 50 + (x / span) * 38;
  const normalizedY = 50 + (z / span) * 38;
  return {
    x: Math.max(10, Math.min(90, normalizedX)),
    y: Math.max(10, Math.min(90, normalizedY)),
  };
}

export function resolveGalaxyRadarModel({
  galaxyName = "Galaxie",
  spaceObjects = [],
  selectedObjectId = "",
  headingDegrees = 0,
} = {}) {
  const objects = Array.isArray(spaceObjects) ? spaceObjects : [];
  const maxExtent = objects.reduce((current, item) => {
    const x = Math.abs(normalizeNumber(item?.position?.[0], 0));
    const z = Math.abs(normalizeNumber(item?.position?.[2], 0));
    return Math.max(current, x, z);
  }, 6);
  const span = Math.max(maxExtent, 6);
  const selectedId = normalizeText(selectedObjectId);

  return {
    galaxyName: normalizeText(galaxyName, "Galaxie"),
    headingDegrees: normalizeNumber(headingDegrees, 0),
    markers: objects.map((item) => {
      const point = resolveRadarPoint(item?.position, span);
      const id = normalizeText(item?.id);
      return {
        id,
        label: normalizeText(item?.label, id),
        type: normalizeText(item?.type, "unknown"),
        x: point.x,
        y: point.y,
        selected: id === selectedId,
      };
    }),
  };
}
