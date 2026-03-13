import { buildGalaxyPlanetObjects } from "./planetTopologyVisualModel.js";

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildGalaxySpaceObjects({ starModel, tableRows = [], planetPhysicsPayload = null } = {}) {
  const starObject = {
    id: "star-core",
    type: "star",
    label: "Srdce hvězdy",
    subtitle: normalizeText(starModel?.galaxyName || "Galaxie", ""),
    position: [0, 0.4, 0],
    size: 3.2,
    source: starModel,
  };

  const planets = buildGalaxyPlanetObjects({ tableRows, planetPhysicsPayload });

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
