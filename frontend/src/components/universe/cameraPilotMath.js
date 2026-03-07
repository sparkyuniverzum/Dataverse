export const CAMERA_PILOT_DEFAULT_BOUNDS = Object.freeze({
  center: [0, 0, 0],
  radius: 140,
});

export function computeBounds(positions) {
  if (!Array.isArray(positions) || !positions.length) {
    return { ...CAMERA_PILOT_DEFAULT_BOUNDS };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  positions.forEach((position) => {
    const x = Number(position?.[0] || 0);
    const y = Number(position?.[1] || 0);
    const z = Number(position?.[2] || 0);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  });

  const center = [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const radius = Math.max(80, Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.7);
  return { center, radius };
}

export function resolveCameraTarget({
  unresolvedSelection = false,
  starDiveActive = false,
  selectedAsteroidNode = null,
  selectedTableNode = null,
  focusOffset = [0, 0, 0],
  fallback = CAMERA_PILOT_DEFAULT_BOUNDS,
} = {}) {
  if (unresolvedSelection) return null;
  if (starDiveActive) {
    return {
      center: [0, 0, 0],
      distance: 20,
    };
  }
  if (selectedAsteroidNode) {
    return {
      center: selectedAsteroidNode.position,
      distance: 48 + Number(selectedAsteroidNode.radius || 0) * 3.4,
    };
  }
  if (selectedTableNode) {
    const offsetX = Number(focusOffset?.[0] || 0);
    const offsetY = Number(focusOffset?.[1] || 0);
    const offsetZ = Number(focusOffset?.[2] || 0);
    return {
      center: [
        Number(selectedTableNode.position?.[0] || 0) + offsetX,
        Number(selectedTableNode.position?.[1] || 0) + offsetY,
        Number(selectedTableNode.position?.[2] || 0) + offsetZ,
      ],
      distance: 180 + Number(selectedTableNode.radius || 0) * 4.8,
    };
  }
  return {
    center: fallback?.center || CAMERA_PILOT_DEFAULT_BOUNDS.center,
    distance: Number(fallback?.radius || CAMERA_PILOT_DEFAULT_BOUNDS.radius) * 2.8,
  };
}

export function resolveControlDistanceLimits({ starDiveActive = false, targetDistance = 0, cameraState = {} } = {}) {
  if (starDiveActive) {
    return { minDistance: 4, maxDistance: 96 };
  }
  const distance = Number(targetDistance || 0);
  return {
    minDistance: Math.max(8, distance * 0.22, Number(cameraState?.minDistance || 8)),
    maxDistance: Math.max(320, distance * 7, Number(cameraState?.maxDistance || 320)),
  };
}
