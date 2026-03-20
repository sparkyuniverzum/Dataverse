function toFiniteInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export const SNAPSHOT_NORMALIZATION_BASELINE = Object.freeze({
  maxCivilizations: 2500,
  maxBonds: 5000,
  maxEntities: 6000,
});

export function estimateSnapshotNormalizationLoad(data = {}) {
  const civilizationSource = Array.isArray(data?.civilizations)
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

  const civilizations = toFiniteInt(civilizationSource.length);
  const bonds = toFiniteInt(bondSource.length);
  return {
    civilizations,
    bonds,
    entities: civilizations + bonds,
  };
}

export function evaluateSnapshotNormalizationBudget(
  data,
  {
    maxCivilizations = SNAPSHOT_NORMALIZATION_BASELINE.maxCivilizations,
    maxBonds = SNAPSHOT_NORMALIZATION_BASELINE.maxBonds,
    maxEntities = SNAPSHOT_NORMALIZATION_BASELINE.maxEntities,
  } = {}
) {
  const estimate = estimateSnapshotNormalizationLoad(data);
  const violations = [];
  if (estimate.civilizations > maxCivilizations) {
    violations.push(`civilizations:${estimate.civilizations}>${maxCivilizations}`);
  }
  if (estimate.bonds > maxBonds) violations.push(`bonds:${estimate.bonds}>${maxBonds}`);
  if (estimate.entities > maxEntities) violations.push(`entities:${estimate.entities}>${maxEntities}`);
  return {
    pass: violations.length === 0,
    violations,
    estimate,
    limits: { maxCivilizations, maxBonds, maxEntities },
  };
}
