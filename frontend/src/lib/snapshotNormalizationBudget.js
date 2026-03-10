function toFiniteInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export const SNAPSHOT_NORMALIZATION_BASELINE = Object.freeze({
  maxAsteroids: 2500,
  maxBonds: 5000,
  maxEntities: 6000,
});

export function estimateSnapshotNormalizationLoad(data = {}) {
  const asteroidSource = Array.isArray(data?.asteroids)
    ? data.asteroids
    : Array.isArray(data?.civilizations)
      ? data.civilizations
      : Array.isArray(data?.moons)
        ? data.moons
        : Array.isArray(data?.atoms)
          ? data.atoms
          : [];
  const bondSource = Array.isArray(data?.bonds)
    ? data.bonds
    : Array.isArray(data?.relations)
      ? data.relations
      : Array.isArray(data?.links)
        ? data.links
        : [];

  const asteroids = toFiniteInt(asteroidSource.length);
  const bonds = toFiniteInt(bondSource.length);
  return {
    asteroids,
    bonds,
    entities: asteroids + bonds,
  };
}

export function evaluateSnapshotNormalizationBudget(
  data,
  {
    maxAsteroids = SNAPSHOT_NORMALIZATION_BASELINE.maxAsteroids,
    maxBonds = SNAPSHOT_NORMALIZATION_BASELINE.maxBonds,
    maxEntities = SNAPSHOT_NORMALIZATION_BASELINE.maxEntities,
  } = {}
) {
  const estimate = estimateSnapshotNormalizationLoad(data);
  const violations = [];
  if (estimate.asteroids > maxAsteroids) violations.push(`asteroids:${estimate.asteroids}>${maxAsteroids}`);
  if (estimate.bonds > maxBonds) violations.push(`bonds:${estimate.bonds}>${maxBonds}`);
  if (estimate.entities > maxEntities) violations.push(`entities:${estimate.entities}>${maxEntities}`);
  return {
    pass: violations.length === 0,
    violations,
    estimate,
    limits: { maxAsteroids, maxBonds, maxEntities },
  };
}
