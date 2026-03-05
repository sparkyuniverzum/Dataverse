export function buildStageZeroPlanetName({ existingCount = 0, suffix = "" } = {}) {
  const count = Number.isFinite(Number(existingCount)) ? Math.max(0, Math.floor(Number(existingCount))) : 0;
  const normalizedSuffix = String(suffix || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 8);
  const ordinal = count + 1;
  if (!normalizedSuffix) {
    return `Core > Planeta-${ordinal}`;
  }
  return `Core > Planeta-${ordinal}-${normalizedSuffix}`;
}

function toFinite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function mapDropPointToPlanetPosition(dropPoint, viewportRect) {
  const width = Math.max(1, toFinite(viewportRect?.width, 1));
  const height = Math.max(1, toFinite(viewportRect?.height, 1));
  const left = toFinite(viewportRect?.left, 0);
  const top = toFinite(viewportRect?.top, 0);
  const x = clamp((toFinite(dropPoint?.x, left) - left) / width, 0, 1);
  const y = clamp((toFinite(dropPoint?.y, top) - top) / height, 0, 1);

  // Convert screen point to simple world-ish plane around universe center.
  const worldX = (x - 0.5) * 420;
  const worldY = (0.5 - y) * 240;
  return {
    x: Number(worldX.toFixed(2)),
    y: Number(worldY.toFixed(2)),
    z: 0,
  };
}

