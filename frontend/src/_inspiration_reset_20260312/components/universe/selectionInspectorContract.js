import { deriveCivilizationInspectorModel } from "./civilizationInspectorModel";
import { tableDisplayName, valueToLabel } from "./workspaceFormatters";

export function formatSelectedTableLabel(selectedTable = null) {
  return selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "";
}

export function resolveSelectedCivilizationLabel(selectedCivilization = null) {
  return selectedCivilization ? valueToLabel(selectedCivilization?.value) : "";
}

export function resolveSelectionInspectorModel({
  selectedTable = null,
  selectedCivilizationId = "",
  civilizationRows = [],
  civilizationById = null,
  moonImpact = null,
} = {}) {
  const safeRows = Array.isArray(civilizationRows) ? civilizationRows : [];
  const normalizedCivilizationId = String(selectedCivilizationId || "").trim();
  const selectedCivilizationFromRows = normalizedCivilizationId
    ? safeRows.find((row) => String(row?.id || "").trim() === normalizedCivilizationId) || null
    : null;
  const selectedCivilization =
    selectedCivilizationFromRows ||
    (normalizedCivilizationId && civilizationById instanceof Map
      ? civilizationById.get(normalizedCivilizationId) || null
      : null);

  return {
    selectedTableId: String(selectedTable?.table_id || "").trim(),
    selectedTableLabel: formatSelectedTableLabel(selectedTable),
    selectedCivilizationId: normalizedCivilizationId,
    selectedCivilizationLabel: resolveSelectedCivilizationLabel(selectedCivilization),
    civilizationCount: safeRows.length,
    orbitCivilizations: safeRows.map((row) => {
      const rowId = String(row?.id || "").trim();
      return {
        id: rowId,
        label: valueToLabel(row?.value),
        selected: Boolean(rowId) && rowId === normalizedCivilizationId,
      };
    }),
    selectedCivilization,
    inspector: deriveCivilizationInspectorModel(selectedCivilization, moonImpact, normalizedCivilizationId),
  };
}
