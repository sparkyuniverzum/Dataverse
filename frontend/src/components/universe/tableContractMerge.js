function normalizeFieldType(rawType) {
  const value = String(rawType || "")
    .trim()
    .toLowerCase();
  return value || "string";
}

function normalizeComposerFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((item) => ({
      fieldKey: String(item?.fieldKey || "").trim(),
      fieldType: normalizeFieldType(item?.fieldType),
    }))
    .filter((item) => Boolean(item.fieldKey));
}

function normalizeStringList(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function normalizePhysicsRulebook(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { rules: [], defaults: {} };
  }
  const rules = Array.isArray(value.rules) ? [...value.rules] : [];
  const defaults =
    value.defaults && typeof value.defaults === "object" && !Array.isArray(value.defaults) ? value.defaults : {};
  return { rules, defaults };
}

export function buildMergedTableContractPayload({ galaxyId = "", existingContract = null, composerFields = [] } = {}) {
  const normalizedGalaxyId = String(galaxyId || "").trim();
  const normalizedComposer = normalizeComposerFields(composerFields);
  const existingRequired = normalizeStringList(existingContract?.required_fields);
  const existingFieldTypes = normalizeRecord(existingContract?.field_types);

  const requiredFields = [...existingRequired];
  normalizedComposer.forEach((item) => {
    if (!requiredFields.includes(item.fieldKey)) {
      requiredFields.push(item.fieldKey);
    }
  });

  const fieldTypes = { ...existingFieldTypes };
  if (!fieldTypes.value) {
    fieldTypes.value = "string";
  }
  normalizedComposer.forEach((item) => {
    fieldTypes[item.fieldKey] = item.fieldType;
  });

  return {
    galaxy_id: normalizedGalaxyId,
    required_fields: requiredFields,
    field_types: fieldTypes,
    unique_rules: normalizeArray(existingContract?.unique_rules),
    validators: normalizeArray(existingContract?.validators),
    auto_semantics: normalizeArray(existingContract?.auto_semantics),
    formula_registry: normalizeArray(existingContract?.formula_registry),
    physics_rulebook: normalizePhysicsRulebook(existingContract?.physics_rulebook),
  };
}
