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

export const MINERAL_ROLES = Object.freeze({
  PRIMARY: "primary",
  ATTRIBUTE: "attribute",
  METRIC: "metric",
  FLAG: "flag",
  TEMPORAL: "temporal",
  STRUCTURED: "structured",
  CALCULATED: "calculated",
  INVALID: "invalid",
});

export const MOON_PURPOSE_TEXT =
  "Mesic je jeden radek tabulky (record), ktery drzi historii faktu a reaguje na semantiku, calc i guardian pravidla.";

export const MOON_FUNCTIONS = Object.freeze([
  "Identita zaznamu: key 'value' nese nazev radku.",
  "Datova vrstva: nerosty z metadata jsou editovatelne fakta bunky.",
  "Vypoctova vrstva: calculated fakty jsou read-only vystup Calc Engine.",
  "Auditovatelnost: kazdy zapis je event, ne hard prepis historie.",
  "Bezpecne mazani: zhasnuti = soft delete (EXTINGUISH).",
]);

export const MOON_CONTROL_STYLE = Object.freeze([
  "LMB na mesic: fokus + otevreni detailu.",
  "Detail mesice: editace nazvu radku a nerostu onBlur (commit).",
  "Grid (/grid): editace bunek in-place, batch preview + commit.",
  "Parser prikaz: A.pole := hodnota, A + B, A : Typ, A -> B.",
  "Delete je vzdy soft delete (zhasnout), ne hard delete.",
]);

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

export function buildMoonFacts({ value = null, metadata = {}, calculatedValues = {}, calcErrors = [] } = {}) {
  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const safeCalculated = calculatedValues && typeof calculatedValues === "object" && !Array.isArray(calculatedValues) ? calculatedValues : {};
  const safeCalcErrors = Array.isArray(calcErrors) ? calcErrors : [];
  const errorsByField = new Map();
  safeCalcErrors.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const field = String(entry.field || "").trim();
    if (!field) return;
    const message = String(entry.message || entry.code || "Calc error").trim();
    if (!message) return;
    const existing = errorsByField.get(field) || [];
    if (!existing.includes(message)) existing.push(message);
    errorsByField.set(field, existing);
  });

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
      const fieldErrors = errorsByField.get(String(key)) || [];
      const invalid = typedValue === "#CIRC!" || fieldErrors.length > 0;
      const errors = [...fieldErrors];
      if (typedValue === "#CIRC!" && !errors.includes("Circular formula dependency")) {
        errors.push("Circular formula dependency");
      }
      facts.push({
        key: String(key),
        typed_value: typedValue,
        value_type: inferFactValueType(typedValue),
        source: FACT_SOURCES.CALCULATED,
        status: invalid ? FACT_STATUSES.INVALID : FACT_STATUSES.VALID,
        unit: null,
        readonly: true,
        errors,
      });
    });

  errorsByField.forEach((messages, key) => {
    if (Object.prototype.hasOwnProperty.call(safeCalculated, key)) return;
    facts.push({
      key: String(key),
      typed_value: null,
      value_type: FACT_VALUE_TYPES.NULL,
      source: FACT_SOURCES.CALCULATED,
      status: FACT_STATUSES.INVALID,
      unit: null,
      readonly: true,
      errors: [...messages],
    });
  });

  return facts;
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const TEMPORAL_FACT_KEY_TOKENS = Object.freeze([
  "date",
  "datum",
  "time",
  "cas",
  "deadline",
  "due",
  "created",
  "updated",
]);

export function classifyMineralRole(fact) {
  const item = fact && typeof fact === "object" ? fact : {};
  const key = normalizeToken(item.key);
  const source = normalizeToken(item.source);
  const valueType = normalizeToken(item.value_type);
  const status = normalizeToken(item.status);

  if (status === FACT_STATUSES.INVALID) return MINERAL_ROLES.INVALID;
  if (source === FACT_SOURCES.CALCULATED) return MINERAL_ROLES.CALCULATED;
  if (key === "value") return MINERAL_ROLES.PRIMARY;
  if (TEMPORAL_FACT_KEY_TOKENS.some((token) => key.includes(token))) return MINERAL_ROLES.TEMPORAL;
  if (valueType === FACT_VALUE_TYPES.BOOLEAN) return MINERAL_ROLES.FLAG;
  if (valueType === FACT_VALUE_TYPES.NUMBER) return MINERAL_ROLES.METRIC;
  if (valueType === FACT_VALUE_TYPES.JSON) return MINERAL_ROLES.STRUCTURED;
  return MINERAL_ROLES.ATTRIBUTE;
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
        calcErrors: snapshot.calc_errors,
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

/**
 * @param {MoonRowContract | null | undefined} moonRow
 * @returns {{
 *   moon_id: string,
 *   label: string,
 *   purpose: string,
 *   functions: string[],
 *   control_style: string[],
 *   summary: { total: number, editable: number, calculated: number, invalid: number },
 *   role_counts: Record<string, number>,
 *   role_by_key: Record<string, string>,
 * }}
 */
export function buildMoonCharacterization(moonRow) {
  const row = moonRow && typeof moonRow === "object" ? moonRow : {};
  const facts = Array.isArray(row.facts) ? row.facts : [];
  const roleCounts = {};
  const roleByKey = {};

  facts.forEach((fact) => {
    const role = classifyMineralRole(fact);
    roleCounts[role] = Number(roleCounts[role] || 0) + 1;
    const key = String(fact?.key || "").trim();
    if (key) roleByKey[key] = role;
  });

  const editable = facts.filter((fact) => !fact?.readonly && String(fact?.source || "") !== FACT_SOURCES.CALCULATED).length;
  const calculated = facts.filter((fact) => String(fact?.source || "") === FACT_SOURCES.CALCULATED).length;
  const invalid = facts.filter((fact) => String(fact?.status || "") === FACT_STATUSES.INVALID).length;

  return {
    moon_id: String(row.moon_id || ""),
    label: String(row.label || row.moon_id || "Mesic"),
    purpose: MOON_PURPOSE_TEXT,
    functions: [...MOON_FUNCTIONS],
    control_style: [...MOON_CONTROL_STYLE],
    summary: {
      total: facts.length,
      editable,
      calculated,
      invalid,
    },
    role_counts: roleCounts,
    role_by_key: roleByKey,
  };
}
