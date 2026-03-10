function normalizeText(value) {
  return String(value || "").trim();
}

export function resolveGridCanvasTruthModel({
  selectedTableId = "",
  selectedCivilizationId = "",
  tableRows = [],
  quickGridOpen = false,
} = {}) {
  const normalizedTableId = normalizeText(selectedTableId);
  const normalizedCivilizationId = normalizeText(selectedCivilizationId);
  const rows = Array.isArray(tableRows) ? tableRows : [];
  const rowIds = new Set(rows.map((row) => normalizeText(row?.id)));
  const firstSelectableCivilizationId = rows.length ? normalizeText(rows[0]?.id) : "";
  const effectiveSelectedCivilizationId =
    normalizedCivilizationId && rowIds.has(normalizedCivilizationId) ? normalizedCivilizationId : "";
  const hasSelectedCivilization = Boolean(effectiveSelectedCivilizationId);

  return {
    selectedTableId: normalizedTableId,
    selectedCivilizationId: effectiveSelectedCivilizationId,
    firstSelectableCivilizationId,
    hasSelectedCivilization,
    shouldClearScopedCivilization: Boolean(normalizedCivilizationId) && !effectiveSelectedCivilizationId,
    shouldAutoSelectFirstCivilization:
      Boolean(quickGridOpen) && Boolean(firstSelectableCivilizationId) && !hasSelectedCivilization,
    focusMode: hasSelectedCivilization
      ? quickGridOpen
        ? "grid_civilization"
        : "canvas_civilization"
      : normalizedTableId
        ? quickGridOpen
          ? "grid_planet"
          : "canvas_planet"
        : "universe",
  };
}
