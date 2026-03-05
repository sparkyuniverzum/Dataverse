export const STAGE_ZERO_PRESET_CARDS = Object.freeze([
  {
    key: "agile_crm",
    label: "Agilni CRM",
    locked: true,
    lockReason: "Odemkne se po zvladnuti zakladu.",
  },
  {
    key: "warehouse",
    label: "Sklad",
    locked: true,
    lockReason: "Odemkne se po zvladnuti zakladu.",
  },
  {
    key: "personal_cashflow",
    label: "Osobni Cashflow",
    locked: false,
    lockReason: "",
  },
]);

export const STAGE_ZERO_CASHFLOW_STEPS = Object.freeze([
  {
    key: "transactionName",
    title: "Krok A",
    sentence: "Zaklad je nazev transakce.",
    instruction: "Pridej Nerost 'Nazev transakce' (Text).",
    blockLabel: "Nazev transakce",
    fieldKey: "transaction_name",
    fieldType: "string",
    previewType: "text",
  },
  {
    key: "amount",
    title: "Krok B",
    sentence: "Cashflow stoji na cislech.",
    instruction: "Pridej 'Castku' (Cislo).",
    blockLabel: "Castka",
    fieldKey: "amount",
    fieldType: "number",
    previewType: "number",
  },
  {
    key: "transactionType",
    title: "Krok C",
    sentence: "Aby v tom nebyl zmatek, transakce tridime.",
    instruction: "Pridej 'Typ' (Prijem/Vydej).",
    blockLabel: "Typ",
    fieldKey: "transaction_type",
    fieldType: "string",
    previewType: "enum(INCOME|EXPENSE)",
  },
]);

export function createStageZeroSchemaDraft() {
  const next = {};
  STAGE_ZERO_CASHFLOW_STEPS.forEach((step) => {
    next[step.key] = false;
  });
  return next;
}

export function summarizeStageZeroSchemaDraft(draft) {
  const normalized = draft && typeof draft === "object" ? draft : {};
  const total = STAGE_ZERO_CASHFLOW_STEPS.length;
  const completed = STAGE_ZERO_CASHFLOW_STEPS.reduce((acc, step) => acc + (normalized[step.key] ? 1 : 0), 0);
  const ratio = total > 0 ? completed / total : 0;
  const nextStep = STAGE_ZERO_CASHFLOW_STEPS.find((step) => !normalized[step.key]) || null;
  return {
    completed,
    total,
    ratio,
    allDone: completed >= total,
    nextStepKey: nextStep ? nextStep.key : "",
  };
}

export function buildStageZeroSchemaPreview(draft) {
  const normalized = draft && typeof draft === "object" ? draft : {};
  return STAGE_ZERO_CASHFLOW_STEPS.map((step) => ({
    key: step.key,
    label: step.fieldKey,
    type: step.previewType,
    done: Boolean(normalized[step.key]),
  }));
}

export function isStageZeroStepUnlocked(stepIndex, draft) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return false;
  if (stepIndex === 0) return true;
  const normalized = draft && typeof draft === "object" ? draft : {};
  for (let idx = 0; idx < stepIndex; idx += 1) {
    const key = STAGE_ZERO_CASHFLOW_STEPS[idx]?.key;
    if (!key || !normalized[key]) return false;
  }
  return true;
}

export function buildStageZeroFieldTypes() {
  const fieldTypes = { value: "string" };
  STAGE_ZERO_CASHFLOW_STEPS.forEach((step) => {
    fieldTypes[step.fieldKey] = step.fieldType;
  });
  return fieldTypes;
}

export function buildStageZeroRequiredFields() {
  return STAGE_ZERO_CASHFLOW_STEPS.map((step) => step.fieldKey);
}

export function resolveStageZeroPlanetVisualBoost(draft, { enabled = true } = {}) {
  if (!enabled) {
    return {
      completed: 0,
      ratio: 0,
      radiusFactorBoost: 1,
      emissiveBoost: 0,
      auraFactorBoost: 1,
      previewMoonCount: 0,
    };
  }
  const summary = summarizeStageZeroSchemaDraft(draft);
  return {
    completed: summary.completed,
    ratio: summary.ratio,
    radiusFactorBoost: 1 + summary.ratio * 0.26,
    emissiveBoost: summary.ratio * 0.56,
    auraFactorBoost: 1 + summary.ratio * 0.42,
    previewMoonCount: summary.completed,
  };
}

export function buildStageZeroCameraMicroNudgeKey({
  setupOpen = false,
  presetSelected = false,
  tableId = "",
  completed = 0,
} = {}) {
  const normalizedTableId = String(tableId || "").trim();
  if (!setupOpen || !presetSelected || !normalizedTableId) return "";
  const normalizedCompleted = Number.isFinite(Number(completed)) ? Math.max(0, Math.floor(Number(completed))) : 0;
  return `stage0:${normalizedTableId}:${normalizedCompleted}`;
}
