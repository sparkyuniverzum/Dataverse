import {
  buildCivilizationCreateUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationMineralMutateUrl,
  buildCivilizationMutateUrl,
} from "./dataverseApi";

export const CIVILIZATION_RUNTIME_PRIMARY_PREFIX = "/civilizations";

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

export function buildCivilizationWriteRoute(apiBase, { operation, civilizationId = null, mineralKey = null } = {}) {
  const normalizedOperation = normalizeOperation(operation);
  if (normalizedOperation === "create") {
    return buildCivilizationCreateUrl(apiBase);
  }
  if (normalizedOperation === "mutate") {
    const id = normalizeCivilizationId(civilizationId);
    return buildCivilizationMutateUrl(apiBase, id);
  }
  if (normalizedOperation === "extinguish") {
    const id = normalizeCivilizationId(civilizationId);
    return buildCivilizationExtinguishUrl(apiBase, id);
  }
  if (normalizedOperation === "mutate_mineral") {
    const id = normalizeCivilizationId(civilizationId);
    const normalizedMineralKey = String(mineralKey || "").trim();
    if (!normalizedMineralKey) {
      throw new Error("mineral_key is required for mutate_mineral route candidates");
    }
    return buildCivilizationMineralMutateUrl(apiBase, id, normalizedMineralKey);
  }
  throw new Error(`Unsupported civilization write operation '${normalizedOperation}'`);
}
