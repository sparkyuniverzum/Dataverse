const FACT_RESERVED_METADATA_KEYS = new Set(["table", "table_id", "table_name", "constellation_name", "planet_name"]);

export const FACT_VALUE_TYPES = Object.freeze({
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATETIME: "datetime",
  JSON: "json",
  NULL: "null",
});

export const FACT_SOURCES = Object.freeze({
  VALUE: "value",
  METADATA: "metadata",
  CALCULATED: "calculated",
});

export const FACT_STATUSES = Object.freeze({
  VALID: "valid",
  HOLOGRAM: "hologram",
  INVALID: "invalid",
});

/**
 * @typedef {Object} MineralFact
 * @property {string} key
 * @property {any} typed_value
 * @property {"string"|"number"|"boolean"|"datetime"|"json"|"null"} value_type
 * @property {"value"|"metadata"|"calculated"} source
 * @property {"valid"|"hologram"|"invalid"} status
 * @property {string|null} unit
 * @property {boolean} readonly
 * @property {string[]} errors
 */

/**
 * @typedef {Object} MoonRowContract
 * @property {string} moon_id
 * @property {string} label
 * @property {string} planet_id
 * @property {string} constellation_name
 * @property {string} planet_name
 * @property {string} created_at
 * @property {number} current_event_seq
 * @property {string[]} active_alerts
 * @property {MineralFact[]} facts
 */

export function inferFactValueType(value) {
  if (value === null || value === undefined) return FACT_VALUE_TYPES.NULL;
  if (typeof value === "boolean") return FACT_VALUE_TYPES.BOOLEAN;
  if (typeof value === "number" && Number.isFinite(value)) return FACT_VALUE_TYPES.NUMBER;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return FACT_VALUE_TYPES.STRING;
    const parsed = Date.parse(normalized);
    return Number.isNaN(parsed) ? FACT_VALUE_TYPES.STRING : FACT_VALUE_TYPES.DATETIME;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return FACT_VALUE_TYPES.DATETIME;
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return FACT_VALUE_TYPES.JSON;
  return FACT_VALUE_TYPES.JSON;
}

export function buildMoonFacts({ value = null, metadata = {}, calculatedValues = {} } = {}) {
  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const safeCalculated = calculatedValues && typeof calculatedValues === "object" && !Array.isArray(calculatedValues) ? calculatedValues : {};

  /** @type {MineralFact[]} */
  const facts = [
    {
      key: "value",
      typed_value: value,
      value_type: inferFactValueType(value),
      source: FACT_SOURCES.VALUE,
      status: FACT_STATUSES.VALID,
      unit: null,
      readonly: false,
      errors: [],
    },
  ];

  Object.keys(safeMetadata)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      if (FACT_RESERVED_METADATA_KEYS.has(String(key))) return;
      const typedValue = safeMetadata[key];
      facts.push({
        key: String(key),
        typed_value: typedValue,
        value_type: inferFactValueType(typedValue),
        source: FACT_SOURCES.METADATA,
        status: FACT_STATUSES.VALID,
        unit: null,
        readonly: false,
        errors: [],
      });
    });

  Object.keys(safeCalculated)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const typedValue = safeCalculated[key];
      const invalid = typedValue === "#CIRC!";
      facts.push({
        key: String(key),
        typed_value: typedValue,
        value_type: inferFactValueType(typedValue),
        source: FACT_SOURCES.CALCULATED,
        status: invalid ? FACT_STATUSES.INVALID : FACT_STATUSES.VALID,
        unit: null,
        readonly: true,
        errors: invalid ? ["Circular formula dependency"] : [],
      });
    });

  return facts;
}

function normalizeFact(raw) {
  const item = raw && typeof raw === "object" ? raw : {};
  const key = String(item.key || "").trim();
  if (!key) return null;
  const valueType = String(item.value_type || "").trim().toLowerCase();
  const source = String(item.source || "").trim().toLowerCase();
  const status = String(item.status || "").trim().toLowerCase();
  return {
    key,
    typed_value: Object.prototype.hasOwnProperty.call(item, "typed_value") ? item.typed_value : null,
    value_type: Object.values(FACT_VALUE_TYPES).includes(valueType) ? valueType : inferFactValueType(item.typed_value),
    source: Object.values(FACT_SOURCES).includes(source) ? source : FACT_SOURCES.METADATA,
    status: Object.values(FACT_STATUSES).includes(status) ? status : FACT_STATUSES.VALID,
    unit: item.unit == null ? null : String(item.unit),
    readonly: Boolean(item.readonly),
    errors: Array.isArray(item.errors) ? item.errors.map((err) => String(err)) : [],
  };
}

/**
 * @param {any} asteroidSnapshot
 * @returns {MoonRowContract}
 */
export function toMoonRowContract(asteroidSnapshot) {
  const snapshot = asteroidSnapshot && typeof asteroidSnapshot === "object" ? asteroidSnapshot : {};
  const moonId = String(snapshot.id || "");
  const label = snapshot.value == null ? moonId : String(snapshot.value);
  const backendFacts = Array.isArray(snapshot.facts)
    ? snapshot.facts.map(normalizeFact).filter(Boolean)
    : [];
  const facts = backendFacts.length
    ? backendFacts
    : buildMoonFacts({
        value: snapshot.value ?? null,
        metadata: snapshot.metadata,
        calculatedValues: snapshot.calculated_values,
      });
  const activeAlerts = Array.isArray(snapshot.active_alerts) ? snapshot.active_alerts.map((item) => String(item)) : [];
  return {
    moon_id: moonId,
    label,
    planet_id: String(snapshot.table_id || ""),
    constellation_name: String(snapshot.constellation_name || ""),
    planet_name: String(snapshot.planet_name || ""),
    created_at: String(snapshot.created_at || ""),
    current_event_seq: Number(snapshot.current_event_seq || 0),
    active_alerts: activeAlerts,
    facts,
  };
}
