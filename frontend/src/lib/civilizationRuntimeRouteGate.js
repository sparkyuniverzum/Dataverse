import {
  buildCivilizationCreateUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationMineralMutateUrl,
  buildCivilizationMutateUrl,
  buildMoonCreateUrl,
  buildMoonExtinguishUrl,
  buildMoonMineralMutateUrl,
  buildMoonMutateUrl,
} from "./dataverseApi";

export const CIVILIZATION_RUNTIME_PRIMARY_PREFIX = "/civilizations";
export const CIVILIZATION_RUNTIME_COMPAT_PREFIX = "/moons";
export const CIVILIZATION_RUNTIME_FALLBACK_STATUSES = Object.freeze([404, 405, 501]);

const FALLBACK_STATUS_SET = new Set(CIVILIZATION_RUNTIME_FALLBACK_STATUSES);

function normalizeOperation(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeCivilizationId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("civilization_id is required for mutate/extinguish route candidates");
  }
  return normalized;
}

export function shouldFallbackToMoonAlias(statusCode) {
  const status = Number(statusCode);
  return Number.isInteger(status) && FALLBACK_STATUS_SET.has(status);
}

export function buildCivilizationWriteRouteCandidates(
  apiBase,
  { operation, civilizationId = null, mineralKey = null } = {}
) {
  const normalizedOperation = normalizeOperation(operation);
  if (normalizedOperation === "create") {
    return [buildCivilizationCreateUrl(apiBase), buildMoonCreateUrl(apiBase)];
  }
  if (normalizedOperation === "mutate") {
    const id = normalizeCivilizationId(civilizationId);
    return [buildCivilizationMutateUrl(apiBase, id), buildMoonMutateUrl(apiBase, id)];
  }
  if (normalizedOperation === "extinguish") {
    const id = normalizeCivilizationId(civilizationId);
    return [buildCivilizationExtinguishUrl(apiBase, id), buildMoonExtinguishUrl(apiBase, id)];
  }
  if (normalizedOperation === "mutate_mineral") {
    const id = normalizeCivilizationId(civilizationId);
    const normalizedMineralKey = String(mineralKey || "").trim();
    if (!normalizedMineralKey) {
      throw new Error("mineral_key is required for mutate_mineral route candidates");
    }
    return [
      buildCivilizationMineralMutateUrl(apiBase, id, normalizedMineralKey),
      buildMoonMineralMutateUrl(apiBase, id, normalizedMineralKey),
    ];
  }
  throw new Error(`Unsupported civilization write operation '${normalizedOperation}'`);
}
