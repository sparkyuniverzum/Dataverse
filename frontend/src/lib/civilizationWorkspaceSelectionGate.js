export const CIVILIZATION_GRID_AUTO_OPEN_SOURCES = Object.freeze(["canvas", "sidebar"]);

const AUTO_OPEN_SOURCES_SET = new Set(CIVILIZATION_GRID_AUTO_OPEN_SOURCES);

function normalizeSource(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeTableId(value) {
  return String(value || "").trim();
}

export function shouldAutoOpenCivilizationGridOnPlanetSelect({
  source = "",
  tableId = "",
  interactionLocked = false,
} = {}) {
  const normalizedTableId = normalizeTableId(tableId);
  if (!normalizedTableId) return false;
  if (interactionLocked) return false;
  return AUTO_OPEN_SOURCES_SET.has(normalizeSource(source));
}

export function resolveCivilizationSelectionPatch({
  source = "",
  tableId = "",
  interactionLocked = false,
  previousQuickGridOpen = false,
} = {}) {
  const selectedTableId = normalizeTableId(tableId);
  if (!selectedTableId) {
    return {
      selectedTableId: "",
      selectedAsteroidId: "",
      quickGridOpen: false,
      autoOpenedGrid: false,
    };
  }

  const autoOpenedGrid = shouldAutoOpenCivilizationGridOnPlanetSelect({
    source,
    tableId: selectedTableId,
    interactionLocked,
  });

  return {
    selectedTableId,
    selectedAsteroidId: "",
    quickGridOpen: autoOpenedGrid ? true : Boolean(previousQuickGridOpen),
    autoOpenedGrid,
  };
}
