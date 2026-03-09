export const STAGE_ZERO_PRESET_CARDS = Object.freeze([
  {
    key: "agile_crm",
    label: "Agilni CRM",
    archetype: "catalog",
    locked: true,
    lockReason: "Odemkne se po zvladnuti zakladu.",
  },
  {
    key: "warehouse",
    label: "Sklad",
    archetype: "catalog",
    locked: true,
    lockReason: "Odemkne se po zvladnuti zakladu.",
  },
  {
    key: "personal_cashflow",
    label: "Osobni Cashflow",
    archetype: "stream",
    locked: false,
    lockReason: "",
  },
]);

export const STAGE_ZERO_STREAM_STEPS = Object.freeze([
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

export const STAGE_ZERO_CATALOG_STEPS = Object.freeze([
  {
    key: "entityId",
    title: "Krok A",
    sentence: "Kazda civilizace musi mit stabilni identitu.",
    instruction: "Pridej Nerost 'entity_id' (Text).",
    blockLabel: "Entity ID",
    fieldKey: "entity_id",
    fieldType: "string",
    previewType: "text",
  },
  {
    key: "label",
    title: "Krok B",
    sentence: "Aby byl radek citelny, potrebuje jmeno.",
    instruction: "Pridej Nerost 'label' (Text).",
    blockLabel: "Label",
    fieldKey: "label",
    fieldType: "string",
    previewType: "text",
  },
  {
    key: "state",
    title: "Krok C",
    sentence: "Zivotni cyklus musi byt riditelny.",
    instruction: "Pridej Nerost 'state' (active/draft/archived).",
    blockLabel: "State",
    fieldKey: "state",
    fieldType: "string",
    previewType: "enum(active|draft|archived)",
  },
]);

export const STAGE_ZERO_JUNCTION_STEPS = Object.freeze([
  {
    key: "sourceRef",
    title: "Krok A",
    sentence: "Spojovaci civilizace potrebuje zdroj.",
    instruction: "Pridej Nerost 'source_ref' (Text).",
    blockLabel: "Source",
    fieldKey: "source_ref",
    fieldType: "string",
    previewType: "text",
  },
  {
    key: "targetRef",
    title: "Krok B",
    sentence: "Druhy konec vazby je cil.",
    instruction: "Pridej Nerost 'target_ref' (Text).",
    blockLabel: "Target",
    fieldKey: "target_ref",
    fieldType: "string",
    previewType: "text",
  },
  {
    key: "relationType",
    title: "Krok C",
    sentence: "Definuj typ spojeni mezi civilizacemi.",
    instruction: "Pridej Nerost 'relation_type' (Text).",
    blockLabel: "Typ vazby",
    fieldKey: "relation_type",
    fieldType: "string",
    previewType: "text",
  },
]);

export const STAGE_ZERO_CASHFLOW_STEPS = STAGE_ZERO_STREAM_STEPS;

export function resolveStageZeroStepsForArchetype(archetype) {
  const normalized = String(archetype || "")
    .trim()
    .toLowerCase();
  if (normalized === "catalog") return STAGE_ZERO_CATALOG_STEPS;
  if (normalized === "junction") return STAGE_ZERO_JUNCTION_STEPS;
  return STAGE_ZERO_STREAM_STEPS;
}

export function createStageZeroSchemaDraft(steps = STAGE_ZERO_CASHFLOW_STEPS) {
  const next = {};
  steps.forEach((step) => {
    next[step.key] = false;
  });
  return next;
}

export function summarizeStageZeroSchemaDraft(draft, steps = STAGE_ZERO_CASHFLOW_STEPS) {
  const normalized = draft && typeof draft === "object" ? draft : {};
  const total = steps.length;
  const completed = steps.reduce((acc, step) => acc + (normalized[step.key] ? 1 : 0), 0);
  const ratio = total > 0 ? completed / total : 0;
  const nextStep = steps.find((step) => !normalized[step.key]) || null;
  return {
    completed,
    total,
    ratio,
    allDone: completed >= total,
    nextStepKey: nextStep ? nextStep.key : "",
  };
}

export function buildStageZeroSchemaPreview(draft, steps = STAGE_ZERO_CASHFLOW_STEPS) {
  const normalized = draft && typeof draft === "object" ? draft : {};
  return steps.map((step) => ({
    key: step.key,
    label: step.fieldKey,
    type: step.previewType,
    done: Boolean(normalized[step.key]),
  }));
}

export function isStageZeroStepUnlocked(stepIndex, draft, steps = STAGE_ZERO_CASHFLOW_STEPS) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return false;
  if (stepIndex === 0) return true;
  const normalized = draft && typeof draft === "object" ? draft : {};
  for (let idx = 0; idx < stepIndex; idx += 1) {
    const key = steps[idx]?.key;
    if (!key || !normalized[key]) return false;
  }
  return true;
}

export function buildStageZeroFieldTypes(steps = STAGE_ZERO_CASHFLOW_STEPS) {
  const fieldTypes = { value: "string" };
  steps.forEach((step) => {
    fieldTypes[step.fieldKey] = step.fieldType;
  });
  return fieldTypes;
}

export function buildStageZeroRequiredFields(steps = STAGE_ZERO_CASHFLOW_STEPS) {
  return steps.map((step) => step.fieldKey);
}

export function resolveStageZeroPlanetVisualBoost(draft, { enabled = true, steps = STAGE_ZERO_CASHFLOW_STEPS } = {}) {
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
  const summary = summarizeStageZeroSchemaDraft(draft, steps);
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
