export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function valueToLabel(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return "";
}

export function tableDisplayName(table) {
  if (!table) return "Tabulka";
  const constellation = String(table.constellation_name || "").trim();
  const planet = String(table.planet_name || "").trim();
  if (constellation && planet) return `${constellation} > ${planet}`;
  return String(table.name || table.planet_name || "Tabulka");
}

export function collectGridColumns(rows) {
  const keys = new Set(["value"]);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const calculated = row?.calculated_values && typeof row.calculated_values === "object" ? row.calculated_values : {};
    Object.keys(metadata).forEach((key) => keys.add(String(key)));
    Object.keys(calculated).forEach((key) => keys.add(String(key)));
  });
  return [...keys];
}

export function readGridCell(row, column) {
  if (column === "value") return valueToLabel(row?.value);
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (Object.prototype.hasOwnProperty.call(metadata, column)) {
    return valueToLabel(metadata[column]);
  }
  const calculated = row?.calculated_values && typeof row.calculated_values === "object" ? row.calculated_values : {};
  if (Object.prototype.hasOwnProperty.call(calculated, column)) {
    return valueToLabel(calculated[column]);
  }
  return "";
}
