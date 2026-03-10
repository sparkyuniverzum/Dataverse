import { evaluateSnapshotNormalizationBudget } from "../../lib/snapshotNormalizationBudget";

export function buildRuntimeNormalizationSignal(snapshotPayload, { scopeKey = "unknown" } = {}) {
  const evaluation = evaluateSnapshotNormalizationBudget(snapshotPayload);
  if (evaluation.pass) return null;

  const { estimate, violations } = evaluation;
  const key = `perf:${scopeKey}:${estimate.asteroids}:${estimate.bonds}:${estimate.entities}`;
  return {
    id: key,
    cursor: null,
    event: "runtime",
    eventType: "PERF_SIGNAL",
    code: "HEAVY_SNAPSHOT_NORMALIZATION",
    message: `Heavy snapshot normalization payload detected: asteroids=${estimate.asteroids}, bonds=${estimate.bonds}, entities=${estimate.entities}, violations=${violations.join("|")}`,
    at: Date.now(),
  };
}
