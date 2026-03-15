import { buildMergedTableContractPayload } from "./tableContractMerge";

function normalizeFieldType(rawType) {
  const value = String(rawType || "")
    .trim()
    .toLowerCase();
  return value || "string";
}

function normalizeFields(fields = []) {
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

function buildComposerFields({
  assemblyMode = "lego",
  stageZeroSteps = [],
  stageZeroSchemaDraft = {},
  manualFields = {},
} = {}) {
  const manual =
    String(assemblyMode || "lego")
      .trim()
      .toLowerCase() === "manual";
  if (manual) {
    return normalizeFields(
      (Array.isArray(stageZeroSteps) ? stageZeroSteps : []).map((step) => ({
        fieldKey: manualFields?.[step.key]?.fieldKey,
        fieldType: manualFields?.[step.key]?.fieldType || "string",
      }))
    );
  }
  return normalizeFields(
    (Array.isArray(stageZeroSteps) ? stageZeroSteps : [])
      .filter((step) => Boolean(stageZeroSchemaDraft?.[step.key]))
      .map((step) => ({
        fieldKey: step.fieldKey,
        fieldType: step.fieldType || "string",
      }))
  );
}

export function buildStageZeroCommitPreview({
  assemblyMode = "lego",
  stageZeroSteps = [],
  stageZeroSchemaDraft = {},
  manualFields = {},
  existingContract = null,
} = {}) {
  const normalizedMode =
    String(assemblyMode || "lego")
      .trim()
      .toLowerCase() === "manual"
      ? "manual"
      : "lego";
  const composerFields = buildComposerFields({
    assemblyMode: normalizedMode,
    stageZeroSteps,
    stageZeroSchemaDraft,
    manualFields,
  });
  const payload = buildMergedTableContractPayload({
    galaxyId: "preview",
    existingContract,
    composerFields,
  });

  const existingRequired = normalizeStringList(existingContract?.required_fields);
  const existingFieldTypes =
    existingContract?.field_types && typeof existingContract.field_types === "object"
      ? existingContract.field_types
      : {};
  const payloadRequired = normalizeStringList(payload?.required_fields);
  const addedRequired = payloadRequired.filter((key) => !existingRequired.includes(key));
  const changedFieldTypes = composerFields
    .filter((item) => {
      const previous = normalizeFieldType(existingFieldTypes[item.fieldKey] || "");
      return previous && previous !== item.fieldType;
    })
    .map((item) => ({
      fieldKey: item.fieldKey,
      fromType: normalizeFieldType(existingFieldTypes[item.fieldKey]),
      toType: item.fieldType,
    }));

  return {
    mode: normalizedMode,
    commitKind: normalizedMode === "manual" ? "manual_contract_commit" : "preset_commit",
    estimated: normalizedMode !== "manual",
    composerFields,
    payload,
    summary: {
      requiredBeforeCount: existingRequired.length,
      requiredAfterCount: payloadRequired.length,
      requiredAddedCount: addedRequired.length,
      fieldTypeChangedCount: changedFieldTypes.length,
    },
    delta: {
      addedRequired,
      changedFieldTypes,
    },
  };
}
