import { useEffect, useMemo, useRef, useState } from "react";

import { canTransitionLifecycle, normalizeLifecycleStateFromRow } from "./civilizationLifecycle";
import { tableDisplayName } from "./workspaceFormatters";

const inputStyle = {
  width: "100%",
  borderRadius: 9,
  border: "1px solid rgba(112, 205, 238, 0.24)",
  background: "rgba(4, 10, 18, 0.92)",
  color: "#ddf7ff",
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  outline: "none",
  boxSizing: "border-box",
};

const ghostButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
};

const hudBadgeStyle = {
  border: "1px solid rgba(101, 191, 223, 0.3)",
  background: "rgba(8, 18, 31, 0.85)",
  color: "#d8f6ff",
  borderRadius: 999,
  padding: "4px 9px",
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  lineHeight: "var(--dv-lh-compact)",
};

const hudButtonStyle = {
  border: "1px solid rgba(109, 198, 228, 0.3)",
  background: "rgba(7, 16, 29, 0.85)",
  color: "#d7f7ff",
  borderRadius: 999,
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  padding: "5px 10px",
  cursor: "pointer",
};

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}

function shortValue(value, max = 56) {
  if (value === null) return "null";
  if (typeof value === "undefined") return "undefined";
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : safeJson(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function normalizeMineralKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseLiteralForPreview(rawValue) {
  const text = String(rawValue ?? "");
  const trimmed = text.trim();
  if (!trimmed) return { empty: true, parsed: undefined, parsedType: "empty" };
  if (trimmed === "true" || trimmed === "false")
    return { empty: false, parsed: trimmed === "true", parsedType: "boolean" };
  if (trimmed === "null") return { empty: false, parsed: null, parsedType: "null" };
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { empty: false, parsed: Number(trimmed), parsedType: "number" };
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return { empty: false, parsed: JSON.parse(trimmed), parsedType: "json" };
    } catch {
      return { empty: false, parsed: text, parsedType: "string" };
    }
  }
  return { empty: false, parsed: text, parsedType: "string" };
}

function makeBatchDraftId(rowId, key) {
  return `${String(rowId || "").trim()}:${String(key || "").trim()}`;
}

function makeRowBatchDraftId(kind, payload = {}) {
  const normalizedKind = String(kind || "")
    .trim()
    .toLowerCase();
  if (normalizedKind === "create")
    return `create:${String(payload?.value || "")
      .trim()
      .toLowerCase()}`;
  if (normalizedKind === "update") return `update:${String(payload?.rowId || "").trim()}`;
  if (normalizedKind === "archive") return `archive:${String(payload?.rowId || "").trim()}`;
  if (normalizedKind === "lifecycle") {
    return `lifecycle:${String(payload?.rowId || "").trim()}:${String(payload?.targetState || "")
      .trim()
      .toUpperCase()}`;
  }
  return `${normalizedKind}:${Date.now()}`;
}

function normalizeLifecycle(selectedRow) {
  if (!selectedRow || typeof selectedRow !== "object") {
    return {
      state: "UNKNOWN",
      healthScore: "n/a",
      violationCount: 0,
      eventSeq: "n/a",
      archived: false,
    };
  }
  const archived = selectedRow.is_deleted === true;
  const state = String(selectedRow.state || (archived ? "ARCHIVED" : "ACTIVE")).toUpperCase();
  return {
    state,
    healthScore: Number.isFinite(Number(selectedRow.health_score)) ? Number(selectedRow.health_score) : "n/a",
    violationCount: Number.isFinite(Number(selectedRow.violation_count)) ? Number(selectedRow.violation_count) : 0,
    eventSeq: Number.isFinite(Number(selectedRow.current_event_seq)) ? Number(selectedRow.current_event_seq) : "n/a",
    archived,
  };
}

function collectMineralEntries(selectedRow) {
  if (!selectedRow || typeof selectedRow !== "object") return [];
  const facts = Array.isArray(selectedRow.facts) ? selectedRow.facts : [];
  const metadata =
    selectedRow.metadata && typeof selectedRow.metadata === "object" && !Array.isArray(selectedRow.metadata)
      ? selectedRow.metadata
      : {};
  const byKey = new Map();

  facts.forEach((fact) => {
    const key = String(fact?.key || "").trim();
    if (!key) return;
    const errors = Array.isArray(fact?.errors) ? fact.errors : [];
    byKey.set(key, {
      key,
      source: String(fact?.source || "facts"),
      valueType: String(fact?.value_type || typeof fact?.typed_value || "unknown"),
      readonly: fact?.readonly === true,
      valuePreview: shortValue(fact?.typed_value),
      status: String(fact?.status || (errors.length ? "invalid" : "valid")),
      errorsCount: errors.length,
    });
  });

  Object.entries(metadata).forEach(([key, value]) => {
    if (byKey.has(key)) return;
    byKey.set(key, {
      key,
      source: "metadata",
      valueType: typeof value,
      readonly: false,
      valuePreview: shortValue(value),
      status: "valid",
      errorsCount: 0,
    });
  });

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function normalizeWriteResult(
  result,
  { successMessage = "Operace byla provedena.", failureMessage = "Operace selhala." } = {}
) {
  if (typeof result === "boolean") {
    return {
      ok: result,
      message: result ? successMessage : failureMessage,
    };
  }
  if (result && typeof result === "object") {
    const ok = Boolean(result.ok);
    const message = String(result.message || "").trim();
    return {
      ok,
      message: message || (ok ? successMessage : failureMessage),
    };
  }
  return {
    ok: false,
    message: failureMessage,
  };
}

function normalizeContractFieldType(rawType) {
  const normalized = String(rawType || "string")
    .trim()
    .toLowerCase();
  if (!normalized) return "string";
  if (["string", "text", "number", "boolean", "json", "datetime", "enum"].includes(normalized)) {
    return normalized;
  }
  return "string";
}

function deriveSchemaDraftFieldsFromContract(contract = null) {
  const requiredFields = Array.isArray(contract?.required_fields)
    ? contract.required_fields.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const fieldTypes = contract?.field_types && typeof contract.field_types === "object" ? contract.field_types : {};
  return requiredFields.map((fieldKey) => ({
    fieldKey,
    fieldType: normalizeContractFieldType(fieldTypes[fieldKey] || "string"),
  }));
}

function readRowFieldValue(row, fieldKey) {
  const key = String(fieldKey || "").trim();
  if (!row || !key) return undefined;
  if (key === "value") return row?.value;
  if (Object.prototype.hasOwnProperty.call(row || {}, key)) return row?.[key];
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (Object.prototype.hasOwnProperty.call(metadata, key)) return metadata[key];
  const facts = Array.isArray(row?.facts) ? row.facts : [];
  const fact = facts.find((item) => String(item?.key || "").trim() === key);
  if (fact && Object.prototype.hasOwnProperty.call(fact, "typed_value")) return fact.typed_value;
  return undefined;
}

function isValueMatchingContractType(value, expectedType) {
  const type = normalizeContractFieldType(expectedType);
  if (typeof value === "undefined") return false;
  if (value === null) return type === "json" || type === "string" || type === "text";
  if (type === "string" || type === "text" || type === "enum") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "json") return typeof value === "object" || Array.isArray(value) || typeof value === "string";
  if (type === "datetime") {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    const parsed = new Date(String(value));
    return !Number.isNaN(parsed.getTime());
  }
  return true;
}

function readPlanetRowCountFromOption(option) {
  if (!option || typeof option !== "object") return null;
  if (Array.isArray(option.members)) return option.members.length;
  if (Number.isFinite(Number(option.rows_count))) return Math.max(0, Math.floor(Number(option.rows_count)));
  if (Number.isFinite(Number(option.civilization_count)))
    return Math.max(0, Math.floor(Number(option.civilization_count)));
  return null;
}

export default function QuickGridOverlay({
  open,
  selectedTable,
  selectedTableId = "",
  tableOptions = [],
  tableContract = null,
  backendStreamEvents = [],
  tableRows,
  gridColumns,
  gridFilteredRows,
  gridSearchQuery,
  onGridSearchChange,
  onSelectTable,
  onCreatePlanet,
  onExtinguishPlanet,
  onApplyTableContract,
  selectedAsteroidId,
  onSelectRow,
  onCreateRow,
  onUpdateRow,
  onDeleteRow,
  onUpsertMetadata,
  pendingCreate = false,
  pendingRowOps = {},
  busy = false,
  onClose,
  readGridCell,
  runtimeError = "",
}) {
  const [createValue, setCreateValue] = useState("");
  const [editValue, setEditValue] = useState("");
  const [planetActionMode, setPlanetActionMode] = useState("AUTO");
  const [planetTargetTableId, setPlanetTargetTableId] = useState(String(selectedTableId || ""));
  const [schemaDraftFields, setSchemaDraftFields] = useState([]);
  const [schemaFieldKeyInput, setSchemaFieldKeyInput] = useState("");
  const [schemaFieldTypeInput, setSchemaFieldTypeInput] = useState("string");
  const [planetToast, setPlanetToast] = useState(null);
  const [planetEventLog, setPlanetEventLog] = useState([]);
  const [workflowLogFilter, setWorkflowLogFilter] = useState("ALL");
  const [workflowLogQuery, setWorkflowLogQuery] = useState("");
  const [schemaApplyBusy, setSchemaApplyBusy] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [lifecycleTargetState, setLifecycleTargetState] = useState("ACTIVE");
  const [civilizationActionMode, setCivilizationActionMode] = useState("AUTO");
  const [rowBatchDrafts, setRowBatchDrafts] = useState([]);
  const [rowBatchBusy, setRowBatchBusy] = useState(false);
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const [mineralActionMode, setMineralActionMode] = useState("AUTO");
  const [mineralFilterQuery, setMineralFilterQuery] = useState("");
  const [mineralBatchDrafts, setMineralBatchDrafts] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [writeFeedback, setWriteFeedback] = useState("");
  const createInputRef = useRef(null);
  const metadataKeyInputRef = useRef(null);
  const metadataValueInputRef = useRef(null);
  const planetToastTimerRef = useRef(null);
  const backendEventSeenRef = useRef(new Set());
  const firstSelectableRowId = useMemo(() => {
    const rows = Array.isArray(tableRows) ? tableRows : [];
    return rows.length ? String(rows[0]?.id || "") : "";
  }, [tableRows]);
  const selectedRow = useMemo(
    () => tableRows.find((row) => String(row.id) === String(selectedAsteroidId || "")) || null,
    [selectedAsteroidId, tableRows]
  );
  const rowsById = useMemo(
    () => new Map((Array.isArray(tableRows) ? tableRows : []).map((row) => [String(row?.id || ""), row])),
    [tableRows]
  );
  const selectedLifecycle = useMemo(() => normalizeLifecycle(selectedRow), [selectedRow]);
  const selectedMinerals = useMemo(() => collectMineralEntries(selectedRow), [selectedRow]);
  const selectedMineralByKey = useMemo(
    () => new Map((Array.isArray(selectedMinerals) ? selectedMinerals : []).map((item) => [String(item.key), item])),
    [selectedMinerals]
  );
  const schemaMineralKeys = useMemo(() => {
    const fromSchema = Array.isArray(selectedTable?.schema_fields)
      ? selectedTable.schema_fields.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const fromContractRequired = Array.isArray(tableContract?.required_fields)
      ? tableContract.required_fields.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return [...new Set([...fromSchema, ...fromContractRequired])];
  }, [selectedTable?.schema_fields, tableContract?.required_fields]);
  const contractFieldTypes = useMemo(
    () =>
      tableContract?.field_types && typeof tableContract.field_types === "object" ? tableContract.field_types : {},
    [tableContract?.field_types]
  );
  const contractRequiredFields = useMemo(
    () =>
      (Array.isArray(tableContract?.required_fields) ? tableContract.required_fields : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    [tableContract?.required_fields]
  );
  const mineralKeySuggestions = useMemo(() => {
    const keys = [
      ...schemaMineralKeys,
      ...selectedMinerals.map((item) => String(item.key || "").trim()).filter(Boolean),
    ];
    return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
  }, [schemaMineralKeys, selectedMinerals]);
  const normalizedMetadataKey = useMemo(() => normalizeMineralKey(metadataKey), [metadataKey]);
  const selectedMineral = useMemo(
    () =>
      selectedMineralByKey.get(normalizedMetadataKey) ||
      selectedMineralByKey.get(String(metadataKey || "").trim()) ||
      null,
    [metadataKey, normalizedMetadataKey, selectedMineralByKey]
  );
  const filteredMinerals = useMemo(() => {
    const q = String(mineralFilterQuery || "")
      .trim()
      .toLowerCase();
    if (!q) return selectedMinerals;
    return selectedMinerals.filter((item) =>
      String(item?.key || "")
        .toLowerCase()
        .includes(q)
    );
  }, [mineralFilterQuery, selectedMinerals]);
  const parsedMineralPreview = useMemo(() => parseLiteralForPreview(metadataValue), [metadataValue]);
  const resolvedMineralAction = useMemo(() => {
    const mode = String(mineralActionMode || "AUTO").toUpperCase();
    if (mode === "UPSERT" || mode === "REMOVE_SOFT") return mode;
    return String(metadataValue || "").trim() ? "UPSERT" : "REMOVE_SOFT";
  }, [metadataValue, mineralActionMode]);
  const mineralKeyOrigin = useMemo(() => {
    if (!normalizedMetadataKey) return "nezadano";
    const known = selectedMineralByKey.get(normalizedMetadataKey);
    if (known) return `existujici (${known.source})`;
    if (schemaMineralKeys.includes(normalizedMetadataKey)) return "schema hint";
    return "custom";
  }, [normalizedMetadataKey, schemaMineralKeys, selectedMineralByKey]);
  const mineralValidation = useMemo(() => {
    const key = normalizeMineralKey(metadataKey);
    const rawValue = String(metadataValue ?? "");
    const removeRequested = resolvedMineralAction === "REMOVE_SOFT";
    const reservedKeys = new Set(["value", "table", "table_id", "table_name"]);
    if (!selectedRow) {
      return { blocking: true, message: "Vyber nejdriv civilizaci/mesic.", tone: "error" };
    }
    if (!key) {
      return { blocking: true, message: "Zadej klic nerostu.", tone: "error" };
    }

    const known = selectedMineralByKey.get(key) || null;
    if (!known && reservedKeys.has(key)) {
      return { blocking: true, message: `Klic '${key}' je systemovy a nelze ho menit jako nerost.`, tone: "error" };
    }
    if (known?.readonly) {
      return { blocking: true, message: `Nerost '${key}' je readonly podle kontraktu.`, tone: "error" };
    }
    if (!removeRequested && !rawValue.trim()) {
      return {
        blocking: true,
        message: "UPSERT vyzaduje neprazdnou hodnotu (nebo prepni akci na REMOVE_SOFT).",
        tone: "error",
      };
    }
    if (removeRequested) {
      return { blocking: false, message: "Prazdna hodnota provede remove_soft.", tone: "info" };
    }

    const expectedType = String(
      contractFieldTypes[key] || known?.valueType || selectedMineralByKey.get(key)?.valueType || ""
    )
      .trim()
      .toLowerCase();
    if (expectedType === "number") {
      const n = Number(rawValue);
      if (!Number.isFinite(n)) {
        return { blocking: true, message: `Nerost '${key}' ceká cislo (number).`, tone: "error" };
      }
    } else if (expectedType === "boolean") {
      const normalized = rawValue.trim().toLowerCase();
      const isBooleanLike = ["true", "false", "1", "0", "yes", "no"].includes(normalized);
      if (!isBooleanLike) {
        return { blocking: true, message: `Nerost '${key}' ceká boolean (true/false).`, tone: "error" };
      }
    } else if (expectedType === "datetime") {
      const parsed = new Date(rawValue);
      if (Number.isNaN(parsed.getTime())) {
        return { blocking: true, message: `Nerost '${key}' ceká datetime (ISO nebo datum/cas).`, tone: "error" };
      }
    } else if (expectedType === "json") {
      try {
        JSON.parse(rawValue);
      } catch {
        return { blocking: true, message: `Nerost '${key}' ceká validni JSON.`, tone: "error" };
      }
    }

    if (schemaMineralKeys.length && !schemaMineralKeys.includes(key)) {
      return {
        blocking: false,
        message: `Nerost '${key}' neni v schema_fields planety. Zapis muze projit, ale je mimo aktualni schema hint.`,
        tone: "warn",
      };
    }

    if (expectedType) {
      return { blocking: false, message: `Typova kontrola OK (${expectedType}).`, tone: "ok" };
    }
    return { blocking: false, message: "Nerost pripraven k UPSERT.", tone: "ok" };
  }, [
    contractFieldTypes,
    metadataKey,
    metadataValue,
    resolvedMineralAction,
    schemaMineralKeys,
    selectedMineralByKey,
    selectedRow,
  ]);

  useEffect(() => {
    if (!open) return;
    setPlanetTargetTableId(String(selectedTableId || ""));
  }, [open, selectedTableId]);

  useEffect(() => {
    if (!open) return;
    if (!selectedRow) {
      setEditValue("");
      setMetadataKey("");
      setMetadataValue("");
      setMineralActionMode("AUTO");
      setMineralFilterQuery("");
      return;
    }
    setEditValue(String(selectedRow?.value ?? ""));
    const metadata = selectedRow?.metadata && typeof selectedRow.metadata === "object" ? selectedRow.metadata : {};
    const firstMetadataKey = Object.keys(metadata)[0] || "";
    setMetadataKey(String(firstMetadataKey));
    setMetadataValue(firstMetadataKey ? String(metadata[firstMetadataKey] ?? "") : "");
    setMineralActionMode("AUTO");
  }, [open, selectedRow]);

  useEffect(() => {
    if (!open) return;
    const rows = Array.isArray(tableRows) ? tableRows : [];
    if (!rows.length) return;
    const hasSelected = rows.some((row) => String(row?.id || "") === String(selectedAsteroidId || ""));
    if (hasSelected) return;
    onSelectRow?.(String(rows[0]?.id || ""));
  }, [open, onSelectRow, selectedAsteroidId, tableRows]);

  useEffect(() => {
    if (!open) return;
    const validIds = new Set((Array.isArray(tableRows) ? tableRows : []).map((row) => String(row?.id || "")));
    setSelectedRowIds((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [open, tableRows]);

  useEffect(() => {
    if (!open) return;
    const primaryId = String(selectedAsteroidId || "").trim();
    if (!primaryId) return;
    setSelectedRowIds((prev) => (prev.includes(primaryId) ? prev : [primaryId, ...prev]));
  }, [open, selectedAsteroidId]);

  useEffect(() => {
    if (!open) {
      setWriteFeedback("");
      return;
    }
    if (!runtimeError) return;
    setWriteFeedback(String(runtimeError));
  }, [open, runtimeError]);
  useEffect(() => {
    if (!open) return;
    setSchemaDraftFields(deriveSchemaDraftFieldsFromContract(tableContract));
  }, [open, selectedTableId, tableContract]);
  useEffect(
    () => () => {
      if (planetToastTimerRef.current) {
        clearTimeout(planetToastTimerRef.current);
        planetToastTimerRef.current = null;
      }
    },
    []
  );

  const pushPlanetEvent = (message, { tone = "info", action = "PLANET", toast = true } = {}) => {
    const text = String(message || "").trim();
    if (!text) return;
    setPlanetEventLog((prev) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message: text, tone, action, at: Date.now() },
        ...prev,
      ].slice(0, 12)
    );
    if (toast) {
      setPlanetToast({ message: text, tone, action });
      if (planetToastTimerRef.current) {
        clearTimeout(planetToastTimerRef.current);
      }
      planetToastTimerRef.current = setTimeout(() => {
        setPlanetToast(null);
        planetToastTimerRef.current = null;
      }, 2800);
    }
  };
  useEffect(() => {
    if (!open) return;
    const items = Array.isArray(backendStreamEvents) ? backendStreamEvents : [];
    items
      .slice()
      .reverse()
      .forEach((eventItem) => {
        const id = String(eventItem?.id || "").trim();
        if (!id || backendEventSeenRef.current.has(id)) return;
        backendEventSeenRef.current.add(id);
        const eventType = String(eventItem?.eventType || eventItem?.event || "UPDATE")
          .trim()
          .toUpperCase();
        const code = String(eventItem?.code || "").trim();
        const cursor =
          eventItem?.cursor === null || typeof eventItem?.cursor === "undefined" ? "n/a" : String(eventItem.cursor);
        const message = String(eventItem?.message || "").trim();
        const summary = `[cursor ${cursor}] ${eventType}${code ? `/${code}` : ""}${message ? ` ${message}` : ""}`;
        const tone = code.includes("ERROR") ? "error" : code.includes("CONFLICT") ? "warn" : "info";
        pushPlanetEvent(summary, { tone, action: "BE_STREAM", toast: false });
      });
  }, [backendStreamEvents, open]);
  const rowBatchSummary = useMemo(() => {
    const summary = { create: 0, update: 0, archive: 0, lifecycle: 0 };
    rowBatchDrafts.forEach((item) => {
      const kind = String(item?.kind || "").toLowerCase();
      if (kind === "create") summary.create += 1;
      if (kind === "update") summary.update += 1;
      if (kind === "archive") summary.archive += 1;
      if (kind === "lifecycle") summary.lifecycle += 1;
    });
    return summary;
  }, [rowBatchDrafts]);
  const selectedRowBatchDrafts = useMemo(
    () => mineralBatchDrafts.filter((item) => String(item?.rowId || "") === String(selectedRow?.id || "")),
    [mineralBatchDrafts, selectedRow?.id]
  );
  const selectedRowsResolved = useMemo(
    () => selectedRowIds.map((id) => rowsById.get(String(id))).filter((item) => Boolean(item)),
    [rowsById, selectedRowIds]
  );
  const allRowsSelected =
    Array.isArray(gridFilteredRows) &&
    gridFilteredRows.length > 0 &&
    gridFilteredRows.every((row) => selectedRowIds.includes(String(row?.id || "")));
  const selectedRowsLifecycle = selectedRowsResolved.map((row) => ({
    rowId: String(row?.id || ""),
    label: String(row?.value || ""),
    fromState: normalizeLifecycleStateFromRow(row),
  }));
  const lifecycleTransitionInvalidRows = selectedRowsLifecycle.filter(
    (item) => !canTransitionLifecycle(item.fromState, lifecycleTargetState)
  );
  const rowBatchPreviewDiff = useMemo(
    () =>
      rowBatchDrafts.map((item) => {
        if (item.kind === "create") {
          return { id: item.id, label: `[create] '${item.value}'` };
        }
        if (item.kind === "update") {
          const source = rowsById.get(String(item.rowId || ""));
          return {
            id: item.id,
            label: `[update] ${String(source?.value || item.rowId)}: '${String(source?.value || "")}' -> '${item.value}'`,
          };
        }
        if (item.kind === "archive") {
          const source = rowsById.get(String(item.rowId || ""));
          return { id: item.id, label: `[archive] ${String(source?.value || item.rowId)}` };
        }
        if (item.kind === "lifecycle") {
          const source = rowsById.get(String(item.rowId || ""));
          const fromState = normalizeLifecycleStateFromRow(source);
          return {
            id: item.id,
            label: `[lifecycle] ${String(source?.value || item.rowId)}: ${fromState} -> ${item.targetState}`,
          };
        }
        return { id: item.id, label: `[${item.kind}] ${item.id}` };
      }),
    [rowBatchDrafts, rowsById]
  );
  const filteredWorkflowLog = useMemo(() => {
    const filter = String(workflowLogFilter || "ALL").toUpperCase();
    const query = String(workflowLogQuery || "")
      .trim()
      .toLowerCase();
    const source = Array.isArray(planetEventLog) ? planetEventLog : [];
    return source.filter((item) => {
      const action = String(item?.action || "").toUpperCase();
      const tone = String(item?.tone || "").toLowerCase();
      if (filter === "BE_STREAM" && action !== "BE_STREAM") return false;
      if (filter === "UI" && action === "BE_STREAM") return false;
      if (filter === "ERROR" && tone !== "error") return false;
      if (!query) return true;
      const message = String(item?.message || "").toLowerCase();
      return action.toLowerCase().includes(query) || message.includes(query);
    });
  }, [planetEventLog, workflowLogFilter, workflowLogQuery]);
  const composerTargetRows = useMemo(() => {
    if (selectedRowsResolved.length > 0) return selectedRowsResolved;
    return selectedRow ? [selectedRow] : [];
  }, [selectedRow, selectedRowsResolved]);
  const resolvedCivilizationAction = useMemo(() => {
    const mode = String(civilizationActionMode || "AUTO").toUpperCase();
    if (mode !== "AUTO") return mode;
    if (String(createValue || "").trim()) return "CREATE";
    if (!composerTargetRows.length) return "SELECT_ROW";
    if (String(editValue || "").trim() && String(editValue || "").trim() !== String(selectedRow?.value || "").trim()) {
      return "UPDATE";
    }
    if (String(lifecycleTargetState || "").toUpperCase() === "ARCHIVED") return "ARCHIVE";
    return "LIFECYCLE";
  }, [
    civilizationActionMode,
    composerTargetRows.length,
    createValue,
    editValue,
    lifecycleTargetState,
    selectedRow?.value,
  ]);
  const civilizationComposerPreview = useMemo(() => {
    const targetLabels = composerTargetRows.map((row) => String(row?.value || row?.id || "")).filter(Boolean);
    if (resolvedCivilizationAction === "CREATE") {
      return `Vytvori novou civilizaci '${String(createValue || "").trim() || "..."}'.`;
    }
    if (resolvedCivilizationAction === "UPDATE") {
      return `Prepise hodnotu ${targetLabels.length} radku na '${String(editValue || "").trim() || "..."}'.`;
    }
    if (resolvedCivilizationAction === "ARCHIVE") {
      return `Archivuje ${targetLabels.length} vybranych civilizaci.`;
    }
    if (resolvedCivilizationAction === "LIFECYCLE") {
      return `Prevede ${targetLabels.length} radku do stavu '${String(lifecycleTargetState || "").toUpperCase()}'.`;
    }
    return "Vyber civilizaci nebo zadej hodnotu pro create.";
  }, [composerTargetRows, createValue, editValue, lifecycleTargetState, resolvedCivilizationAction]);
  const civilizationContractHint = useMemo(() => {
    if (!contractRequiredFields.length) {
      return "Kontrakt planety nema explicitni required_fields.";
    }
    const normalizedRequired = contractRequiredFields
      .filter((key) => !["value", "table", "table_id", "table_name"].includes(String(key || "").toLowerCase()))
      .slice(0, 8);
    return `Create bude kontrolovan podle kontraktu (${normalizedRequired.length} required): ${normalizedRequired.join(", ")}`;
  }, [contractRequiredFields]);
  const contractDiagnostics = useMemo(() => {
    if (!selectedRow || !contractRequiredFields.length) {
      return {
        requiredCount: contractRequiredFields.length,
        coveredCount: 0,
        missing: [],
        typeMismatch: [],
        suggestions: [],
      };
    }
    const missing = [];
    const typeMismatch = [];
    const suggestions = [];
    contractRequiredFields.forEach((fieldKey) => {
      const expectedType = normalizeContractFieldType(contractFieldTypes[fieldKey] || "string");
      const value = readRowFieldValue(selectedRow, fieldKey);
      if (typeof value === "undefined") {
        missing.push(fieldKey);
        if (fieldKey === "label" || fieldKey === "name") {
          suggestions.push(`Dopln '${fieldKey}' z hodnoty civilizace.`);
        } else if (fieldKey === "state") {
          suggestions.push("Dopln 'state' (active/draft/archived).");
        } else {
          suggestions.push(`Dopln '${fieldKey}' jako ${expectedType}.`);
        }
        return;
      }
      if (!isValueMatchingContractType(value, expectedType)) {
        typeMismatch.push({
          fieldKey,
          expectedType,
          actualType: Array.isArray(value) ? "array" : typeof value,
          valuePreview: shortValue(value),
        });
        suggestions.push(`Pretypuj '${fieldKey}' na ${expectedType}.`);
      }
    });
    return {
      requiredCount: contractRequiredFields.length,
      coveredCount: contractRequiredFields.length - missing.length,
      missing,
      typeMismatch,
      suggestions: [...new Set(suggestions)].slice(0, 6),
    };
  }, [contractFieldTypes, contractRequiredFields, selectedRow]);
  const selectedPlanetOption = useMemo(
    () =>
      Array.isArray(tableOptions)
        ? tableOptions.find((item) => String(item?.table_id || "") === String(planetTargetTableId || ""))
        : null,
    [planetTargetTableId, tableOptions]
  );
  const resolvedPlanetAction = useMemo(() => {
    const mode = String(planetActionMode || "AUTO").toUpperCase();
    if (mode !== "AUTO") return mode;
    if (!selectedTable) return "CREATE";
    return "SELECT";
  }, [planetActionMode, selectedTable]);
  const selectedPlanetActionTableId = useMemo(() => {
    if (resolvedPlanetAction === "SELECT" || resolvedPlanetAction === "EXTINGUISH") {
      return String(planetTargetTableId || "").trim();
    }
    return String(selectedTableId || "").trim();
  }, [planetTargetTableId, resolvedPlanetAction, selectedTableId]);
  const selectedPlanetActionRowsCount = useMemo(() => {
    if (!selectedPlanetActionTableId) return 0;
    if (String(selectedPlanetActionTableId) === String(selectedTableId || "")) {
      return Array.isArray(tableRows) ? tableRows.length : 0;
    }
    const targetOption = Array.isArray(tableOptions)
      ? tableOptions.find((item) => String(item?.table_id || "") === String(selectedPlanetActionTableId))
      : null;
    const optionCount = readPlanetRowCountFromOption(targetOption);
    return optionCount === null ? 0 : optionCount;
  }, [selectedPlanetActionTableId, selectedTableId, tableOptions, tableRows]);
  const planetRowsCount = Array.isArray(tableRows) ? tableRows.length : 0;
  const planetComposerCanApply = useMemo(() => {
    if (busy || rowBatchBusy) return false;
    if (resolvedPlanetAction === "CREATE") return typeof onCreatePlanet === "function";
    if (resolvedPlanetAction === "SELECT") {
      return typeof onSelectTable === "function" && Boolean(String(planetTargetTableId || "").trim());
    }
    if (resolvedPlanetAction === "EXTINGUISH") {
      return (
        typeof onExtinguishPlanet === "function" &&
        Boolean(selectedPlanetActionTableId) &&
        selectedPlanetActionRowsCount === 0
      );
    }
    return false;
  }, [
    busy,
    onCreatePlanet,
    onExtinguishPlanet,
    onSelectTable,
    planetRowsCount,
    selectedPlanetActionRowsCount,
    selectedPlanetActionTableId,
    planetTargetTableId,
    resolvedPlanetAction,
    rowBatchBusy,
    selectedTableId,
  ]);
  const planetComposerReason = useMemo(() => {
    if (resolvedPlanetAction === "EXTINGUISH" && !selectedPlanetActionTableId) {
      return "Vyber planetu pro extinguish.";
    }
    if (resolvedPlanetAction === "EXTINGUISH" && selectedPlanetActionRowsCount > 0) {
      return "Extinguish planety je povoleny jen pro prazdnou planetu (0 civilizaci).";
    }
    if (resolvedPlanetAction === "SELECT" && !String(planetTargetTableId || "").trim()) {
      return "Vyber planetu v composer selectu.";
    }
    return "Planet composer pripraven.";
  }, [planetTargetTableId, resolvedPlanetAction, selectedPlanetActionRowsCount, selectedPlanetActionTableId]);
  const schemaComposerCanApply = useMemo(() => {
    if (busy || schemaApplyBusy) return false;
    if (typeof onApplyTableContract !== "function") return false;
    if (!selectedTableId) return false;
    return schemaDraftFields.some((item) => String(item?.fieldKey || "").trim());
  }, [busy, onApplyTableContract, schemaApplyBusy, schemaDraftFields, selectedTableId]);
  const civilizationComposerApplyLabel = useMemo(() => {
    if (resolvedCivilizationAction === "CREATE") return "Apply CREATE";
    if (resolvedCivilizationAction === "UPDATE") return "Apply UPDATE";
    if (resolvedCivilizationAction === "ARCHIVE") return "Apply ARCHIVE";
    if (resolvedCivilizationAction === "LIFECYCLE") return "Apply LIFECYCLE";
    return "Vybrat prvni radek";
  }, [resolvedCivilizationAction]);
  const civilizationComposerCanApply = useMemo(() => {
    if (busy || rowBatchBusy) return false;
    if (resolvedCivilizationAction === "SELECT_ROW") return Boolean(firstSelectableRowId);
    if (resolvedCivilizationAction === "CREATE") {
      return Boolean(selectedTable) && Boolean(String(createValue || "").trim());
    }
    if (resolvedCivilizationAction === "UPDATE") {
      const value = String(editValue || "").trim();
      if (!value || !composerTargetRows.length) return false;
      return composerTargetRows.some((row) => String(row?.value ?? "").trim() !== value);
    }
    if (resolvedCivilizationAction === "ARCHIVE") {
      return composerTargetRows.some((row) => normalizeLifecycleStateFromRow(row) !== "ARCHIVED");
    }
    if (resolvedCivilizationAction === "LIFECYCLE") {
      if (!composerTargetRows.length) return false;
      const targetState = String(lifecycleTargetState || "").toUpperCase();
      return composerTargetRows.every((row) =>
        canTransitionLifecycle(normalizeLifecycleStateFromRow(row), targetState)
      );
    }
    return false;
  }, [
    busy,
    composerTargetRows,
    createValue,
    editValue,
    firstSelectableRowId,
    lifecycleTargetState,
    resolvedCivilizationAction,
    rowBatchBusy,
    selectedTable,
  ]);
  const handleApplyPlanetComposer = async () => {
    if (!planetComposerCanApply) {
      setWriteFeedback(planetComposerReason);
      pushPlanetEvent(planetComposerReason, { tone: "warn", action: "PLANET_GUARD" });
      return;
    }
    if (resolvedPlanetAction === "CREATE") {
      const result = normalizeWriteResult(await onCreatePlanet?.(), {
        successMessage: "Planeta byla vytvorena.",
        failureMessage: "Vytvoreni planety selhalo.",
      });
      setWriteFeedback(result.message);
      pushPlanetEvent(result.message, { tone: result.ok ? "ok" : "error", action: "PLANET_CREATE" });
      return;
    }
    if (resolvedPlanetAction === "SELECT") {
      onSelectTable?.(String(planetTargetTableId || ""));
      setWriteFeedback("Planeta vybrana.");
      pushPlanetEvent("Planeta vybrana.", { tone: "ok", action: "PLANET_SELECT" });
      return;
    }
    if (resolvedPlanetAction === "EXTINGUISH") {
      const result = normalizeWriteResult(await onExtinguishPlanet?.(selectedPlanetActionTableId), {
        successMessage: "Planeta byla extinguishnuta.",
        failureMessage: "Extinguish planety selhal.",
      });
      setWriteFeedback(result.message);
      pushPlanetEvent(result.message, { tone: result.ok ? "ok" : "error", action: "PLANET_EXTINGUISH" });
    }
  };
  const handleAddSchemaDraftField = () => {
    const fieldKey = normalizeMineralKey(schemaFieldKeyInput);
    const fieldType = normalizeContractFieldType(schemaFieldTypeInput);
    if (!fieldKey) {
      setWriteFeedback("Schema field key je prazdny.");
      return;
    }
    setSchemaDraftFields((prev) => {
      const without = prev.filter((item) => String(item?.fieldKey || "") !== fieldKey);
      return [...without, { fieldKey, fieldType }];
    });
    setSchemaFieldKeyInput("");
    setSchemaFieldTypeInput("string");
    pushPlanetEvent(`Schema field '${fieldKey}' pridan (${fieldType}).`, { tone: "info", action: "SCHEMA_DRAFT" });
  };
  const handleApplySchemaComposer = async () => {
    if (!schemaComposerCanApply) {
      setWriteFeedback("Schema composer neni pripraven.");
      pushPlanetEvent("Schema composer neni pripraven.", { tone: "warn", action: "SCHEMA_APPLY" });
      return;
    }
    setSchemaApplyBusy(true);
    const result = normalizeWriteResult(await onApplyTableContract?.(schemaDraftFields), {
      successMessage: "Schema kontrakt byl ulozen.",
      failureMessage: "Schema kontrakt se nepodarilo ulozit.",
    });
    setSchemaApplyBusy(false);
    setWriteFeedback(result.message);
    pushPlanetEvent(result.message, { tone: result.ok ? "ok" : "error", action: "SCHEMA_APPLY" });
  };

  if (!open) return null;

  const pendingRowsCount = Object.keys(pendingRowOps || {}).length;
  const workflowState = {
    planetReady: Boolean(selectedTable),
    rowReady: Boolean(selectedRow),
    mineralReady: Boolean(String(metadataKey || "").trim()),
    planetActionReady: planetComposerCanApply,
  };
  const workflowSuggestedMineralKey =
    contractRequiredFields[0] || schemaMineralKeys[0] || selectedMinerals[0]?.key || "state";
  const workflowNextAction = !workflowState.planetReady
    ? "Vyber planetu"
    : !workflowState.rowReady
      ? "Vybrat prvni civilizaci"
      : !workflowState.mineralReady
        ? "Predvyplnit klic nerostu"
        : "Ulozit nerost";
  const selectedPrimaryLifecycleState = normalizeLifecycleStateFromRow(selectedRow);
  const canDirectArchiveSelected = Boolean(selectedRow) && selectedPrimaryLifecycleState !== "ARCHIVED";
  const canDirectUpdateSelected =
    Boolean(selectedRow) &&
    selectedPrimaryLifecycleState !== "ARCHIVED" &&
    editValue !== String(selectedRow?.value ?? "");

  const handleUpsertMineral = async () => {
    if (!selectedRow) {
      setWriteFeedback("Vyber nejdriv civilizaci/mesic v tabulce.");
      return;
    }
    const safeKey = normalizeMineralKey(metadataKey);
    if (!safeKey) {
      setWriteFeedback("Zadej nejdriv klic nerostu.");
      return;
    }
    if (mineralValidation?.blocking) {
      setWriteFeedback(mineralValidation.message || "Nerost neprosel inline validaci.");
      return;
    }
    const writePayloadValue = resolvedMineralAction === "REMOVE_SOFT" ? "" : metadataValue;
    const writeResult = normalizeWriteResult(await onUpsertMetadata?.(selectedRow?.id, safeKey, writePayloadValue), {
      successMessage: "Nerost byl ulozen.",
      failureMessage: "Ulozeni nerostu selhalo.",
    });
    if (writeResult.ok && resolvedMineralAction === "REMOVE_SOFT") {
      setMetadataValue("");
    }
    setWriteFeedback(writeResult.message);
    pushPlanetEvent(writeResult.message, {
      tone: writeResult.ok ? "ok" : "error",
      action: resolvedMineralAction === "REMOVE_SOFT" ? "MINERAL_REMOVE_SOFT" : "MINERAL_UPSERT",
    });
  };
  const handleQueueCreateRow = () => {
    const value = String(createValue || "").trim();
    if (!value) {
      setWriteFeedback("Zadej hodnotu civilizace pred vlozenim do batch fronty.");
      return;
    }
    const nextDraft = {
      id: makeRowBatchDraftId("create", { value }),
      kind: "create",
      value,
    };
    setRowBatchDrafts((prev) => {
      const next = prev.filter((item) => item.id !== nextDraft.id);
      return [...next, nextDraft];
    });
    setWriteFeedback(`Create civilizace '${value}' pridan do batch fronty.`);
    pushPlanetEvent(`Create civilizace '${value}' pridan do batch fronty.`, {
      tone: "info",
      action: "CIV_QUEUE_CREATE",
    });
  };
  const handleToggleRowSelection = (rowId, forceValue = null) => {
    const targetId = String(rowId || "").trim();
    if (!targetId) return;
    setSelectedRowIds((prev) => {
      const exists = prev.includes(targetId);
      const nextValue = typeof forceValue === "boolean" ? forceValue : !exists;
      if (nextValue && !exists) return [...prev, targetId];
      if (!nextValue && exists) return prev.filter((id) => id !== targetId);
      return prev;
    });
  };
  const handleToggleAllVisibleRows = (checked) => {
    const visibleIds = (Array.isArray(gridFilteredRows) ? gridFilteredRows : [])
      .map((row) => String(row?.id || ""))
      .filter(Boolean);
    setSelectedRowIds((prev) => {
      if (checked) {
        return [...new Set([...prev, ...visibleIds])];
      }
      const removeSet = new Set(visibleIds);
      return prev.filter((id) => !removeSet.has(id));
    });
  };
  const resolveBatchTargetRows = () => {
    if (selectedRowsResolved.length > 0) return selectedRowsResolved;
    return selectedRow ? [selectedRow] : [];
  };
  const handleQueueUpdateRow = () => {
    const targetRows = resolveBatchTargetRows();
    if (!targetRows.length) {
      setWriteFeedback("Vyber civilizaci pro update.");
      return;
    }
    const value = String(editValue || "").trim();
    if (!value) {
      setWriteFeedback("Nova hodnota civilizace je prazdna.");
      return;
    }
    const unchangedCount = targetRows.filter((row) => String(row?.value ?? "") === value).length;
    if (unchangedCount === targetRows.length) {
      setWriteFeedback("Update se nezmeni, hodnota je stejna pro vsechny vybrane radky.");
      return;
    }
    const drafts = targetRows.map((row) => ({
      id: makeRowBatchDraftId("update", { rowId: row.id }),
      kind: "update",
      rowId: String(row.id),
      value,
    }));
    setRowBatchDrafts((prev) => {
      const removeSet = new Set(drafts.map((item) => item.id));
      const kept = prev.filter((item) => !removeSet.has(item.id));
      return [...kept, ...drafts];
    });
    setWriteFeedback(`Batch update pripraven pro ${drafts.length} civilizaci.`);
    pushPlanetEvent(`Batch update pripraven pro ${drafts.length} civilizaci.`, {
      tone: "info",
      action: "CIV_QUEUE_UPDATE",
    });
  };
  const handleQueueArchiveRow = () => {
    const targetRows = resolveBatchTargetRows();
    if (!targetRows.length) {
      setWriteFeedback("Vyber civilizaci pro archivaci.");
      return;
    }
    const activeRows = targetRows.filter((row) => normalizeLifecycleStateFromRow(row) !== "ARCHIVED");
    if (!activeRows.length) {
      setWriteFeedback("Vybrane civilizace jsou uz archivovane.");
      return;
    }
    const drafts = activeRows.map((row) => ({
      id: makeRowBatchDraftId("archive", { rowId: row.id }),
      kind: "archive",
      rowId: String(row.id),
      label: String(row?.value || ""),
    }));
    setRowBatchDrafts((prev) => {
      const removeSet = new Set(drafts.map((item) => item.id));
      const kept = prev.filter((item) => !removeSet.has(item.id));
      return [...kept, ...drafts];
    });
    setWriteFeedback(`Batch archivace pripravena pro ${drafts.length} civilizaci.`);
    pushPlanetEvent(`Batch archivace pripravena pro ${drafts.length} civilizaci.`, {
      tone: "info",
      action: "CIV_QUEUE_ARCHIVE",
    });
  };
  const handleQueueLifecycleTransition = () => {
    const targetRows = resolveBatchTargetRows();
    if (!targetRows.length) {
      setWriteFeedback("Vyber civilizace pro lifecycle transition.");
      return;
    }
    const targetState = String(lifecycleTargetState || "").toUpperCase();
    const validRows = targetRows.filter((row) =>
      canTransitionLifecycle(normalizeLifecycleStateFromRow(row), targetState)
    );
    if (!validRows.length) {
      setWriteFeedback(`Transition na '${targetState}' neni povolena pro vybrane civilizace.`);
      return;
    }
    const drafts = validRows.map((row) => ({
      id: makeRowBatchDraftId("lifecycle", { rowId: row.id, targetState }),
      kind: "lifecycle",
      rowId: String(row.id),
      targetState,
    }));
    setRowBatchDrafts((prev) => {
      const removeSet = new Set(drafts.map((item) => item.id));
      const kept = prev.filter((item) => !removeSet.has(item.id));
      return [...kept, ...drafts];
    });
    setWriteFeedback(`Lifecycle transition '${targetState}' pripraven pro ${drafts.length} civilizaci.`);
    pushPlanetEvent(`Lifecycle transition '${targetState}' pripraven pro ${drafts.length} civilizaci.`, {
      tone: "info",
      action: "CIV_QUEUE_LIFECYCLE",
    });
  };
  const handleApplyRowBatch = async () => {
    if (!rowBatchDrafts.length) {
      setWriteFeedback("Civilization batch fronta je prazdna.");
      return;
    }
    setRowBatchBusy(true);
    const failed = [];
    let okCount = 0;
    for (const draft of rowBatchDrafts) {
      if (draft.kind === "create") {
        const result = normalizeWriteResult(await onCreateRow?.(draft.value), {
          successMessage: `Civilizace '${draft.value}' vytvorena.`,
          failureMessage: `Create civilizace '${draft.value}' selhal.`,
        });
        if (result.ok) okCount += 1;
        else failed.push(draft);
        continue;
      }
      if (draft.kind === "update") {
        const result = normalizeWriteResult(await onUpdateRow?.(draft.rowId, draft.value), {
          successMessage: "Civilizace upravena.",
          failureMessage: "Update civilizace selhal.",
        });
        if (result.ok) okCount += 1;
        else failed.push(draft);
        continue;
      }
      if (draft.kind === "archive") {
        const result = normalizeWriteResult(await onDeleteRow?.(draft.rowId), {
          successMessage: "Civilizace archivovana.",
          failureMessage: "Archivace civilizace selhala.",
        });
        if (result.ok) okCount += 1;
        else failed.push(draft);
        continue;
      }
      if (draft.kind === "lifecycle") {
        const targetState = String(draft.targetState || "").toUpperCase();
        const result = normalizeWriteResult(await onUpsertMetadata?.(draft.rowId, "state", targetState.toLowerCase()), {
          successMessage: `Lifecycle prepnuto na ${targetState}.`,
          failureMessage: "Lifecycle transition selhala.",
        });
        if (result.ok) okCount += 1;
        else failed.push(draft);
      }
    }
    setRowBatchBusy(false);
    setRowBatchDrafts(failed);
    if (!failed.length) {
      setWriteFeedback(`Civilization batch ulozen (${okCount} operaci).`);
      pushPlanetEvent(`Civilization batch ulozen (${okCount} operaci).`, { tone: "ok", action: "CIV_BATCH_APPLY" });
    } else {
      setWriteFeedback(`Civilization batch ulozen castecne: OK ${okCount}, chyba ${failed.length}.`);
      pushPlanetEvent(`Civilization batch ulozen castecne: OK ${okCount}, chyba ${failed.length}.`, {
        tone: "warn",
        action: "CIV_BATCH_APPLY",
      });
    }
  };
  const handleApplyCivilizationComposer = async () => {
    if (!civilizationComposerCanApply) {
      setWriteFeedback("Composer akce neni pripravená.");
      return;
    }
    if (resolvedCivilizationAction === "SELECT_ROW") {
      if (!firstSelectableRowId) {
        setWriteFeedback("Neni dostupny radek pro vyber.");
        return;
      }
      onSelectRow?.(firstSelectableRowId);
      setWriteFeedback("Vybrana prvni civilizace.");
      pushPlanetEvent("Vybrana prvni civilizace.", { tone: "ok", action: "CIV_SELECT_ROW" });
      return;
    }
    if (resolvedCivilizationAction === "CREATE") {
      const value = String(createValue || "").trim();
      const writeResult = normalizeWriteResult(await onCreateRow?.(value), {
        successMessage: "Civilizace byla uspesne zapsana.",
        failureMessage: "Zapis civilizace selhal.",
      });
      if (writeResult.ok) setCreateValue("");
      setWriteFeedback(writeResult.message);
      pushPlanetEvent(writeResult.message, { tone: writeResult.ok ? "ok" : "error", action: "CIV_CREATE" });
      return;
    }
    if (resolvedCivilizationAction === "UPDATE") {
      const targetRows = composerTargetRows.filter(
        (row) => String(row?.value ?? "").trim() !== String(editValue || "").trim()
      );
      let okCount = 0;
      let failCount = 0;
      for (const row of targetRows) {
        const result = normalizeWriteResult(await onUpdateRow?.(row?.id, editValue), {
          successMessage: "Civilizace upravena.",
          failureMessage: "Update civilizace selhal.",
        });
        if (result.ok) okCount += 1;
        else failCount += 1;
      }
      setWriteFeedback(
        failCount ? `Composer UPDATE: OK ${okCount}, chyba ${failCount}.` : `Composer UPDATE ulozen (${okCount} radku).`
      );
      pushPlanetEvent(
        failCount
          ? `Composer UPDATE: OK ${okCount}, chyba ${failCount}.`
          : `Composer UPDATE ulozen (${okCount} radku).`,
        { tone: failCount ? "warn" : "ok", action: "CIV_UPDATE" }
      );
      return;
    }
    if (resolvedCivilizationAction === "ARCHIVE") {
      const targetRows = composerTargetRows.filter((row) => normalizeLifecycleStateFromRow(row) !== "ARCHIVED");
      let okCount = 0;
      let failCount = 0;
      for (const row of targetRows) {
        const result = normalizeWriteResult(await onDeleteRow?.(row?.id), {
          successMessage: "Civilizace archivovana.",
          failureMessage: "Archivace civilizace selhala.",
        });
        if (result.ok) okCount += 1;
        else failCount += 1;
      }
      setWriteFeedback(
        failCount
          ? `Composer ARCHIVE: OK ${okCount}, chyba ${failCount}.`
          : `Composer ARCHIVE ulozen (${okCount} radku).`
      );
      pushPlanetEvent(
        failCount
          ? `Composer ARCHIVE: OK ${okCount}, chyba ${failCount}.`
          : `Composer ARCHIVE ulozen (${okCount} radku).`,
        { tone: failCount ? "warn" : "ok", action: "CIV_ARCHIVE" }
      );
      return;
    }
    if (resolvedCivilizationAction === "LIFECYCLE") {
      const targetState = String(lifecycleTargetState || "").toUpperCase();
      let okCount = 0;
      let failCount = 0;
      for (const row of composerTargetRows) {
        const result = normalizeWriteResult(await onUpsertMetadata?.(row?.id, "state", targetState.toLowerCase()), {
          successMessage: `Lifecycle prepnuto na ${targetState}.`,
          failureMessage: "Lifecycle transition selhala.",
        });
        if (result.ok) okCount += 1;
        else failCount += 1;
      }
      setWriteFeedback(
        failCount
          ? `Composer LIFECYCLE: OK ${okCount}, chyba ${failCount}.`
          : `Composer LIFECYCLE '${targetState}' ulozen (${okCount} radku).`
      );
      pushPlanetEvent(
        failCount
          ? `Composer LIFECYCLE: OK ${okCount}, chyba ${failCount}.`
          : `Composer LIFECYCLE '${targetState}' ulozen (${okCount} radku).`,
        { tone: failCount ? "warn" : "ok", action: "CIV_LIFECYCLE" }
      );
    }
  };
  const handleAddMineralToBatch = () => {
    if (!selectedRow) {
      setWriteFeedback("Vyber nejdriv civilizaci/mesic v tabulce.");
      return;
    }
    const safeKey = normalizeMineralKey(metadataKey);
    if (!safeKey) {
      setWriteFeedback("Zadej nejdriv klic nerostu.");
      return;
    }
    if (mineralValidation?.blocking) {
      setWriteFeedback(mineralValidation.message || "Nerost neprosel inline validaci.");
      return;
    }
    const nextDraft = {
      id: makeBatchDraftId(selectedRow.id, safeKey),
      rowId: String(selectedRow.id),
      key: safeKey,
      value: String(metadataValue ?? ""),
      remove: resolvedMineralAction === "REMOVE_SOFT",
    };
    setMineralBatchDrafts((prev) => {
      const withoutSameKey = prev.filter((item) => item.id !== nextDraft.id);
      return [...withoutSameKey, nextDraft];
    });
    setWriteFeedback(`Nerost '${safeKey}' pridan do batch fronty.`);
    pushPlanetEvent(`Nerost '${safeKey}' pridan do batch fronty.`, { tone: "info", action: "MINERAL_QUEUE" });
  };
  const handleApplyMineralBatch = async () => {
    if (!selectedRow) {
      setWriteFeedback("Vyber nejdriv civilizaci/mesic v tabulce.");
      return;
    }
    const queue = selectedRowBatchDrafts;
    if (!queue.length) {
      setWriteFeedback("Batch fronta je prazdna.");
      return;
    }
    setBatchBusy(true);
    const failed = [];
    const appliedKeys = [];
    for (const item of queue) {
      const writeResult = normalizeWriteResult(
        await onUpsertMetadata?.(item.rowId, item.key, item.remove ? "" : item.value),
        {
          successMessage: `Nerost '${item.key}' byl ulozen.`,
          failureMessage: `Nerost '${item.key}' selhal.`,
        }
      );
      if (writeResult.ok) {
        appliedKeys.push(item.key);
      } else {
        failed.push(item);
      }
    }
    setBatchBusy(false);
    if (!failed.length) {
      setMineralBatchDrafts((prev) => prev.filter((item) => String(item?.rowId || "") !== String(selectedRow.id)));
      setWriteFeedback(`Batch ulozen (${appliedKeys.length} nerostu).`);
      pushPlanetEvent(`Batch ulozen (${appliedKeys.length} nerostu).`, { tone: "ok", action: "MINERAL_BATCH_APPLY" });
      return;
    }
    setMineralBatchDrafts((prev) => {
      const keptOtherRows = prev.filter((item) => String(item?.rowId || "") !== String(selectedRow.id));
      return [...keptOtherRows, ...failed];
    });
    setWriteFeedback(`Batch ulozen castecne: OK ${appliedKeys.length}, chyba ${failed.length}.`);
    pushPlanetEvent(`Batch ulozen castecne: OK ${appliedKeys.length}, chyba ${failed.length}.`, {
      tone: "warn",
      action: "MINERAL_BATCH_APPLY",
    });
  };

  return (
    <section
      data-testid="quick-grid-overlay"
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 58,
        width: "min(1320px, calc(100vw - 20px))",
        height: "min(84vh, 920px)",
        borderRadius: 14,
        border: "1px solid rgba(101, 194, 227, 0.38)",
        background: "rgba(4, 12, 24, 0.92)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 30px rgba(34, 136, 188, 0.24)",
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto auto auto auto auto auto auto 1fr",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.7, letterSpacing: "var(--dv-tr-wide)" }}>
            Planeta / Tabulka
          </div>
          <div style={{ fontSize: "var(--dv-fs-xl)", fontWeight: 700 }}>
            {selectedTable ? tableDisplayName(selectedTable) : "Tabulka"}
          </div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
            Radky {gridFilteredRows.length}/{tableRows.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" style={{ ...hudButtonStyle, background: "rgba(14, 40, 62, 0.92)" }}>
            Grid
          </button>
          <button type="button" onClick={onClose} data-testid="quick-grid-close-button" style={ghostButtonStyle}>
            3D Vesmír
          </button>
        </div>
      </div>

      <div
        data-testid="quick-grid-workflow-rail"
        style={{
          border: "1px solid rgba(96, 186, 220, 0.24)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.58)",
          padding: "7px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>
            1 planeta {workflowState.planetReady ? "OK" : "chybí"}
          </span>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>
            planeta action {workflowState.planetActionReady ? "ready" : "guarded"}
          </span>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>
            2 civilizace/mesic {workflowState.rowReady ? "OK" : "vyber radek"}
          </span>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>
            3 nerost {workflowState.mineralReady ? "OK" : "zadej klic"}
          </span>
        </div>
        <button
          type="button"
          data-testid="quick-grid-workflow-next-action"
          style={ghostButtonStyle}
          disabled={busy}
          onClick={async () => {
            if (!workflowState.planetReady) {
              setWriteFeedback("Nejdriv vyber planetu.");
              return;
            }
            if (!workflowState.rowReady) {
              if (!firstSelectableRowId) {
                setWriteFeedback("V aktualni planete zatim neni zadna civilizace.");
                createInputRef.current?.focus?.();
                return;
              }
              onSelectRow?.(firstSelectableRowId);
              setWriteFeedback("Vybrana prvni civilizace.");
              metadataKeyInputRef.current?.focus?.();
              return;
            }
            if (!workflowState.mineralReady) {
              setMetadataKey(workflowSuggestedMineralKey);
              setWriteFeedback(`Predvyplnen klic nerostu '${workflowSuggestedMineralKey}'.`);
              metadataKeyInputRef.current?.focus?.();
              return;
            }
            metadataValueInputRef.current?.focus?.();
            await handleUpsertMineral();
          }}
        >
          Dalsi krok: {workflowNextAction}
        </button>
      </div>

      <div
        data-testid="quick-grid-semantic-legend"
        style={{
          border: "1px solid rgba(96, 186, 220, 0.24)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.58)",
          padding: "7px 8px",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
          SEMANTIC LEGEND
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82, lineHeight: "var(--dv-lh-base)" }}>
          Civilizace = zivotni cyklus entity (alias: mesic; stav, health, event seq). Nerost = atomicka typed hodnota
          uvnitr civilizace/mesice.
        </div>
        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
          Workflow nerostu: <strong>UPSERT</strong> (ulozit) / <strong>REPAIR</strong> (guided oprava) /{" "}
          <strong>REMOVE_SOFT</strong> (prazdna hodnota).
        </div>
        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
          Workflow planety: <strong>CREATE</strong> / <strong>SELECT</strong> / <strong>EXTINGUISH</strong> (jen
          prazdna).
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div
          data-testid="quick-grid-planet-composer"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.58)",
            padding: "8px 9px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            PLANET COMPOSER
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) auto auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              value={planetTargetTableId}
              onChange={(event) => setPlanetTargetTableId(String(event.target.value || ""))}
              style={inputStyle}
            >
              <option value="">Vyber planetu...</option>
              {(Array.isArray(tableOptions) ? tableOptions : []).map((item) => (
                <option key={String(item?.table_id || "")} value={String(item?.table_id || "")}>
                  {tableDisplayName(item)}
                </option>
              ))}
            </select>
            <select
              value={planetActionMode}
              onChange={(event) => setPlanetActionMode(String(event.target.value || "AUTO").toUpperCase())}
              style={{ ...inputStyle, padding: "6px 8px", fontSize: "var(--dv-fs-2xs)" }}
            >
              <option value="AUTO">AUTO</option>
              <option value="CREATE">CREATE</option>
              <option value="SELECT">SELECT</option>
              <option value="EXTINGUISH">EXTINGUISH</option>
            </select>
            <button
              type="button"
              data-testid="quick-grid-apply-planet-composer-button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(125, 220, 255, 0.5)", color: "#d9f7ff" }}
              disabled={!planetComposerCanApply}
              onClick={handleApplyPlanetComposer}
            >
              Apply {resolvedPlanetAction}
            </button>
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>
            target:{" "}
            <strong>
              {selectedPlanetOption
                ? tableDisplayName(selectedPlanetOption)
                : tableDisplayName(selectedTable) || "none"}
            </strong>{" "}
            | rows: <strong>{planetRowsCount}</strong>
          </div>
          <div
            data-testid="quick-grid-planet-guard-reason"
            style={{
              fontSize: "var(--dv-fs-2xs)",
              color: planetComposerCanApply ? "#b7efce" : "#ffd5a3",
              opacity: 0.92,
            }}
          >
            {planetComposerReason}
          </div>
          <div
            data-testid="quick-grid-schema-composer"
            style={{
              border: "1px dashed rgba(95, 183, 218, 0.28)",
              borderRadius: 8,
              background: "rgba(5, 14, 25, 0.62)",
              padding: "6px 8px",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              SCHEMA COMPOSER (manual)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1fr) auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={schemaFieldKeyInput}
                onChange={(event) => setSchemaFieldKeyInput(event.target.value)}
                placeholder="field_key"
                style={{ ...inputStyle, padding: "6px 8px", fontSize: "var(--dv-fs-2xs)" }}
                disabled={busy || schemaApplyBusy}
              />
              <select
                value={schemaFieldTypeInput}
                onChange={(event) => setSchemaFieldTypeInput(normalizeContractFieldType(event.target.value))}
                style={{ ...inputStyle, padding: "6px 8px", fontSize: "var(--dv-fs-2xs)" }}
                disabled={busy || schemaApplyBusy}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="json">json</option>
                <option value="datetime">datetime</option>
                <option value="enum">enum</option>
              </select>
              <button
                type="button"
                style={ghostButtonStyle}
                onClick={handleAddSchemaDraftField}
                disabled={busy || schemaApplyBusy}
              >
                Pridat pole
              </button>
            </div>
            <div style={{ display: "grid", gap: 4, maxHeight: 110, overflow: "auto" }}>
              {schemaDraftFields.length ? (
                schemaDraftFields.map((item) => (
                  <div
                    key={`${item.fieldKey}:${item.fieldType}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "var(--dv-fs-2xs)",
                    }}
                  >
                    <span>
                      {item.fieldKey} <strong>({item.fieldType})</strong>
                    </span>
                    <button
                      type="button"
                      style={{ ...hudButtonStyle, padding: "3px 8px" }}
                      onClick={() =>
                        setSchemaDraftFields((prev) => prev.filter((entry) => entry.fieldKey !== item.fieldKey))
                      }
                    >
                      odebrat
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>
                  Pole nejsou pridana. Vypln field_key + type.
                </div>
              )}
            </div>
            <button
              type="button"
              data-testid="quick-grid-apply-schema-composer-button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(125, 220, 255, 0.5)", color: "#d9f7ff" }}
              disabled={!schemaComposerCanApply}
              onClick={handleApplySchemaComposer}
            >
              {schemaApplyBusy ? "Ukladam schema..." : "Apply CONTRACT"}
            </button>
          </div>
        </div>
        <div
          data-testid="quick-grid-rows-panel"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.58)",
            padding: "8px 9px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>ROWS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
            <input
              value={gridSearchQuery}
              onChange={(event) => onGridSearchChange(event.target.value)}
              placeholder="Filtr radku a bunek..."
              style={inputStyle}
            />
            <span data-testid="quick-grid-columns-badge" style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              sloupce {gridColumns.length}
            </span>
            <span data-testid="quick-grid-write-badge" style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              write {busy ? "..." : "ready"}
            </span>
          </div>
          <div
            data-testid="quick-grid-civilization-composer"
            style={{
              border: "1px dashed rgba(95, 183, 218, 0.28)",
              borderRadius: 8,
              background: "rgba(5, 14, 25, 0.62)",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              CIVILIZATION COMPOSER
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.8 }}>
                target rows: <strong>{composerTargetRows.length}</strong> | selected ids:{" "}
                <strong>{selectedRowIds.length || 0}</strong>
              </div>
              <select
                value={civilizationActionMode}
                onChange={(event) => setCivilizationActionMode(String(event.target.value || "AUTO").toUpperCase())}
                style={{ ...inputStyle, padding: "5px 8px", fontSize: "var(--dv-fs-2xs)" }}
              >
                <option value="AUTO">AUTO</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="ARCHIVE">ARCHIVE</option>
                <option value="LIFECYCLE">LIFECYCLE</option>
              </select>
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>
              action: <strong>{resolvedCivilizationAction}</strong> | preview:{" "}
              <strong>{civilizationComposerPreview}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>{civilizationContractHint}</div>
            <button
              type="button"
              data-testid="quick-grid-apply-civilization-composer-button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(125, 220, 255, 0.5)", color: "#d9f7ff" }}
              disabled={!civilizationComposerCanApply}
              onClick={handleApplyCivilizationComposer}
            >
              {civilizationComposerApplyLabel}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
            <input
              ref={createInputRef}
              value={createValue}
              onChange={(event) => setCreateValue(event.target.value)}
              placeholder="Nova hodnota civilizace..."
              style={inputStyle}
              disabled={busy}
            />
            <button
              type="button"
              style={ghostButtonStyle}
              disabled={busy || rowBatchBusy || pendingCreate || !String(createValue || "").trim() || !selectedTable}
              onClick={async () => {
                const writeResult = normalizeWriteResult(await onCreateRow?.(createValue), {
                  successMessage: "Civilizace byla uspesne zapsana.",
                  failureMessage: "Zapis civilizace selhal. Zkontroluj kontrakt a vybranou planetu.",
                });
                if (writeResult.ok) {
                  setCreateValue("");
                }
                setWriteFeedback(writeResult.message);
                pushPlanetEvent(writeResult.message, { tone: writeResult.ok ? "ok" : "error", action: "CIV_CREATE" });
              }}
            >
              {pendingCreate ? "Pridavam..." : "Pridat civilizaci"}
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(144, 235, 175, 0.45)", color: "#d8ffea" }}
              disabled={busy || rowBatchBusy || !String(createValue || "").trim() || !selectedTable}
              onClick={handleQueueCreateRow}
            >
              + batch create
            </button>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8, alignItems: "center" }}
          >
            <input
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              placeholder={
                selectedRow ? "Upravit hodnotu vybrane civilizace..." : "Vyber civilizaci (mesic) v tabulce..."
              }
              style={inputStyle}
              disabled={busy || !selectedRow}
            />
            <button
              type="button"
              style={ghostButtonStyle}
              disabled={busy || rowBatchBusy || !canDirectUpdateSelected}
              onClick={async () => {
                const writeResult = normalizeWriteResult(await onUpdateRow?.(selectedRow?.id, editValue), {
                  successMessage: "Civilizace byla upravena.",
                  failureMessage: "Uprava civilizace selhala.",
                });
                setWriteFeedback(writeResult.message);
                pushPlanetEvent(writeResult.message, { tone: writeResult.ok ? "ok" : "error", action: "CIV_UPDATE" });
              }}
            >
              {selectedRow && pendingRowOps[String(selectedRow.id)] === "mutate" ? "Ukladam..." : "Ulozit"}
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 152, 162, 0.45)", color: "#ffd6de" }}
              disabled={busy || rowBatchBusy || !canDirectArchiveSelected}
              onClick={async () => {
                const writeResult = normalizeWriteResult(await onDeleteRow?.(selectedRow?.id), {
                  successMessage: "Civilizace byla archivovana.",
                  failureMessage: "Archivace civilizace selhala.",
                });
                setWriteFeedback(writeResult.message);
                pushPlanetEvent(writeResult.message, { tone: writeResult.ok ? "ok" : "error", action: "CIV_ARCHIVE" });
              }}
            >
              {selectedRow && pendingRowOps[String(selectedRow.id)] === "extinguish"
                ? "Archivuji..."
                : "Archivovat civilizaci"}
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(144, 235, 175, 0.45)", color: "#d8ffea" }}
              disabled={busy || rowBatchBusy || !resolveBatchTargetRows().length || !String(editValue || "").trim()}
              onClick={handleQueueUpdateRow}
            >
              + batch update
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 194, 142, 0.45)", color: "#ffd9ae" }}
              disabled={busy || rowBatchBusy || !resolveBatchTargetRows().length}
              onClick={handleQueueArchiveRow}
            >
              + batch archive
            </button>
          </div>
          <div
            style={{
              border: "1px solid rgba(95, 183, 218, 0.22)",
              borderRadius: 8,
              background: "rgba(6, 16, 28, 0.64)",
              padding: "7px 8px",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              LIFECYCLE RULES
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>
              selected rows: {selectedRowsResolved.length} | invalid transition rows:{" "}
              {lifecycleTransitionInvalidRows.length}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
              <select
                value={lifecycleTargetState}
                onChange={(event) => setLifecycleTargetState(String(event.target.value || "ACTIVE").toUpperCase())}
                style={inputStyle}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <button
                type="button"
                style={{ ...ghostButtonStyle, borderColor: "rgba(144, 235, 175, 0.45)", color: "#d8ffea" }}
                disabled={
                  busy || rowBatchBusy || !resolveBatchTargetRows().length || lifecycleTransitionInvalidRows.length > 0
                }
                onClick={handleQueueLifecycleTransition}
              >
                + batch lifecycle
              </button>
            </div>
            {lifecycleTransitionInvalidRows.length ? (
              <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffd5a3" }}>
                Transition na '{lifecycleTargetState}' neni povolena pro:{" "}
                {lifecycleTransitionInvalidRows.map((item) => item.label || item.rowId).join(", ")}
              </div>
            ) : null}
          </div>
          <div
            data-testid="quick-grid-civilization-batch-panel"
            style={{
              border: "1px solid rgba(95, 183, 218, 0.22)",
              borderRadius: 8,
              background: "rgba(6, 16, 28, 0.64)",
              padding: "7px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              CIVILIZATION BATCH
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>
              create: {rowBatchSummary.create} | update: {rowBatchSummary.update} | archive: {rowBatchSummary.archive} |
              lifecycle: {rowBatchSummary.lifecycle}
            </div>
            {rowBatchDrafts.length ? (
              rowBatchDrafts.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 6,
                    alignItems: "center",
                    fontSize: "var(--dv-fs-2xs)",
                    opacity: 0.86,
                  }}
                >
                  <span>
                    [{item.kind}]{" "}
                    {item.kind === "create"
                      ? item.value
                      : item.kind === "update"
                        ? `${item.rowId} -> ${item.value}`
                        : `${item.rowId} (${item.label || "archive"})`}
                  </span>
                  <button
                    type="button"
                    style={{ ...hudButtonStyle, padding: "3px 8px" }}
                    onClick={() => {
                      setRowBatchDrafts((prev) => prev.filter((draft) => draft.id !== item.id));
                    }}
                  >
                    Odebrat
                  </button>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Fronta je prazdna.</div>
            )}
            <button
              type="button"
              data-testid="quick-grid-apply-civilization-batch-button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(125, 220, 255, 0.5)", color: "#d9f7ff" }}
              disabled={busy || rowBatchBusy || !rowBatchDrafts.length}
              onClick={handleApplyRowBatch}
            >
              {rowBatchBusy ? "Ukladam civilization batch..." : `Ulozit civilization batch (${rowBatchDrafts.length})`}
            </button>
            <div
              data-testid="quick-grid-civilization-batch-diff-preview"
              style={{
                border: "1px solid rgba(95, 183, 218, 0.22)",
                borderRadius: 8,
                background: "rgba(4, 14, 24, 0.72)",
                padding: "6px 7px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                COMMIT PREVIEW DIFF
              </div>
              {rowBatchPreviewDiff.length ? (
                rowBatchPreviewDiff.slice(0, 24).map((item) => (
                  <div key={item.id} style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>
                    {item.label}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Zadna pending civilization zmena.</div>
              )}
            </div>
          </div>
        </div>

        <div
          data-testid="quick-grid-minerals-panel"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.58)",
            padding: "8px 9px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            MINERALS
          </div>
          <div
            data-testid="quick-grid-mineral-composer"
            style={{
              border: "1px dashed rgba(95, 183, 218, 0.28)",
              borderRadius: 8,
              background: "rgba(5, 14, 25, 0.62)",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              MINERAL COMPOSER
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.8 }}>
                key: <strong>{normalizedMetadataKey || "—"}</strong> ({mineralKeyOrigin}) | target row:{" "}
                <strong>{String(selectedRow?.value || "none")}</strong>
              </div>
              <select
                value={mineralActionMode}
                onChange={(event) => setMineralActionMode(String(event.target.value || "AUTO").toUpperCase())}
                style={{ ...inputStyle, padding: "5px 8px", fontSize: "var(--dv-fs-2xs)" }}
                disabled={busy || !selectedRow}
              >
                <option value="AUTO">AUTO</option>
                <option value="UPSERT">UPSERT</option>
                <option value="REMOVE_SOFT">REMOVE_SOFT</option>
              </select>
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>
              action: <strong>{resolvedMineralAction}</strong> | payload:{" "}
              <strong>
                {resolvedMineralAction === "REMOVE_SOFT" ? "remove key" : shortValue(parsedMineralPreview.parsed)}
              </strong>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 0.9fr) minmax(160px, 1fr) auto auto auto auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              ref={metadataKeyInputRef}
              value={metadataKey}
              onChange={(event) => setMetadataKey(event.target.value)}
              placeholder="Nerost / sloupec"
              style={inputStyle}
              disabled={busy || !selectedRow}
            />
            <input
              ref={metadataValueInputRef}
              value={metadataValue}
              onChange={(event) => setMetadataValue(event.target.value)}
              placeholder={selectedRow ? "Hodnota (prazdne = remove_soft)" : "Vyber civilizaci (mesic) v tabulce..."}
              style={inputStyle}
              disabled={busy || !selectedRow}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy) {
                  event.preventDefault();
                  void handleUpsertMineral();
                }
              }}
            />
            <button
              type="button"
              style={ghostButtonStyle}
              disabled={
                busy ||
                batchBusy ||
                !selectedRow ||
                !String(metadataKey || "").trim() ||
                Boolean(mineralValidation?.blocking)
              }
              onClick={async () => {
                await handleUpsertMineral();
              }}
            >
              {selectedRow && pendingRowOps[String(selectedRow.id)] === "metadata"
                ? "Ukladam..."
                : resolvedMineralAction === "REMOVE_SOFT"
                  ? "Provést remove_soft"
                  : "Ulozit nerost"}
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 194, 142, 0.45)", color: "#ffd9ae" }}
              disabled={
                busy || batchBusy || !selectedRow || !normalizeMineralKey(metadataKey) || selectedMineral?.readonly
              }
              onClick={async () => {
                setMineralActionMode("REMOVE_SOFT");
                setMetadataValue("");
                const writeResult = normalizeWriteResult(
                  await onUpsertMetadata?.(selectedRow?.id, normalizeMineralKey(metadataKey), ""),
                  {
                    successMessage: "Nerost byl odebran (soft remove).",
                    failureMessage: "Odebrani nerostu selhalo.",
                  }
                );
                setWriteFeedback(writeResult.message);
                pushPlanetEvent(writeResult.message, {
                  tone: writeResult.ok ? "ok" : "error",
                  action: "MINERAL_REMOVE_SOFT",
                });
              }}
            >
              Odebrat nerost
            </button>
            <button
              type="button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(144, 235, 175, 0.45)", color: "#d8ffea" }}
              disabled={
                busy ||
                batchBusy ||
                !selectedRow ||
                !normalizeMineralKey(metadataKey) ||
                Boolean(mineralValidation?.blocking)
              }
              onClick={handleAddMineralToBatch}
            >
              Pridat do batch
            </button>
            <button
              type="button"
              data-testid="quick-grid-apply-mineral-batch-button"
              style={{ ...ghostButtonStyle, borderColor: "rgba(125, 220, 255, 0.5)", color: "#d9f7ff" }}
              disabled={busy || batchBusy || !selectedRowBatchDrafts.length}
              onClick={handleApplyMineralBatch}
            >
              {batchBusy ? "Ukladam batch..." : `Ulozit batch (${selectedRowBatchDrafts.length})`}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {mineralKeySuggestions.slice(0, 10).map((key) => (
              <button
                key={key}
                type="button"
                style={{
                  ...hudButtonStyle,
                  borderColor: normalizedMetadataKey === key ? "rgba(128, 229, 255, 0.6)" : hudButtonStyle.border,
                  background: normalizedMetadataKey === key ? "rgba(24, 74, 99, 0.92)" : hudButtonStyle.background,
                }}
                onClick={() => {
                  setMetadataKey(key);
                  const rowMetadata =
                    selectedRow?.metadata && typeof selectedRow.metadata === "object" ? selectedRow.metadata : {};
                  if (Object.prototype.hasOwnProperty.call(rowMetadata, key)) {
                    setMetadataValue(String(rowMetadata[key] ?? ""));
                  } else {
                    setMetadataValue("");
                  }
                  setMineralActionMode("AUTO");
                  metadataValueInputRef.current?.focus?.();
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>
            schema klice: {schemaMineralKeys.length || 0} | znamych nerostu: {selectedMinerals.length}
          </div>
          <div
            data-testid="quick-grid-mineral-batch-panel"
            style={{
              border: "1px solid rgba(95, 183, 218, 0.22)",
              borderRadius: 8,
              background: "rgba(6, 16, 28, 0.64)",
              padding: "7px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              BATCH FRONTA (vybrana civilizace)
            </div>
            {selectedRowBatchDrafts.length ? (
              selectedRowBatchDrafts.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 6,
                    alignItems: "center",
                    fontSize: "var(--dv-fs-2xs)",
                    opacity: 0.88,
                  }}
                >
                  <span>
                    {item.key}: <strong>{item.remove ? "[remove_soft]" : shortValue(item.value)}</strong>
                  </span>
                  <button
                    type="button"
                    style={{ ...hudButtonStyle, padding: "3px 8px" }}
                    onClick={() => {
                      setMineralBatchDrafts((prev) => prev.filter((draft) => draft.id !== item.id));
                    }}
                  >
                    Odebrat
                  </button>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Fronta je prazdna.</div>
            )}
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>
            preview: <strong>{shortValue(parsedMineralPreview.parsed)}</strong> ({parsedMineralPreview.parsedType})
            {selectedMineral ? ` | aktualni: ${selectedMineral.valuePreview} (${selectedMineral.valueType})` : ""}
          </div>
          <div
            data-testid="quick-grid-mineral-validation"
            style={{
              fontSize: "var(--dv-fs-2xs)",
              color:
                mineralValidation?.tone === "error"
                  ? "#ffb4b4"
                  : mineralValidation?.tone === "warn"
                    ? "#ffd5a3"
                    : mineralValidation?.tone === "info"
                      ? "#a9d9ea"
                      : "#b7efce",
              opacity: 0.92,
            }}
          >
            {mineralValidation?.message || ""}
          </div>
          <div
            data-testid="quick-grid-mineral-panel"
            style={{
              border: "1px solid rgba(95, 183, 218, 0.22)",
              borderRadius: 8,
              background: "rgba(6, 16, 28, 0.64)",
              padding: "7px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              MINERAL FACTS
            </div>
            <input
              value={mineralFilterQuery}
              onChange={(event) => setMineralFilterQuery(event.target.value)}
              placeholder="Filtr nerostu..."
              style={{ ...inputStyle, fontSize: "var(--dv-fs-2xs)", padding: "6px 8px" }}
            />
            {selectedMinerals.length ? (
              filteredMinerals.slice(0, 16).map((mineral) => (
                <button
                  key={mineral.key}
                  type="button"
                  data-testid={`quick-grid-mineral-item-${mineral.key}`}
                  onClick={() => {
                    setMetadataKey(normalizeMineralKey(mineral.key));
                    const rowMetadata =
                      selectedRow?.metadata && typeof selectedRow.metadata === "object" ? selectedRow.metadata : {};
                    setMetadataValue(
                      Object.prototype.hasOwnProperty.call(rowMetadata, mineral.key)
                        ? String(rowMetadata[mineral.key] ?? "")
                        : ""
                    );
                    setMineralActionMode("AUTO");
                    metadataValueInputRef.current?.focus?.();
                  }}
                  style={{
                    border: "1px solid rgba(95, 177, 207, 0.2)",
                    background:
                      normalizeMineralKey(mineral.key) === normalizedMetadataKey
                        ? "rgba(19, 63, 87, 0.92)"
                        : "rgba(8, 21, 35, 0.72)",
                    color: "#dff8ff",
                    borderRadius: 7,
                    padding: "6px 7px",
                    fontSize: "var(--dv-fs-2xs)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {mineral.key}: <strong>{mineral.valuePreview}</strong> ({mineral.valueType}) [{mineral.status}]
                  {mineral.errorsCount ? ` errors=${mineral.errorsCount}` : ""}
                </button>
              ))
            ) : (
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Nerosty zatim nejsou k dispozici.</div>
            )}
          </div>
        </div>

        <div
          data-testid="quick-grid-lifecycle-panel"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.58)",
            padding: "8px 9px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            CIVILIZATION LIFECYCLE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>pending radky {pendingRowsCount || 0}</span>
            <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              vybrana civilizace {selectedRow ? "ano" : "ne"}
            </span>
          </div>
          {!selectedRow ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>
                Vyber civilizaci (mesic alias) v tabulce. Lifecycle panel pak ukaze stav.
              </div>
              <div>
                <button
                  type="button"
                  data-testid="quick-grid-select-first-row-button"
                  style={ghostButtonStyle}
                  disabled={!firstSelectableRowId || busy}
                  onClick={() => {
                    if (!firstSelectableRowId) return;
                    onSelectRow?.(firstSelectableRowId);
                    setWriteFeedback("");
                  }}
                >
                  Vybrat prvni civilizaci
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div
                data-testid="quick-grid-civilization-inspector"
                style={{
                  border: "1px solid rgba(95, 183, 218, 0.22)",
                  borderRadius: 8,
                  background: "rgba(6, 16, 28, 0.64)",
                  padding: "7px 8px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
                  state: <strong>{selectedLifecycle.state}</strong>
                </div>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.8 }}>
                  health: {selectedLifecycle.healthScore} | violations: {selectedLifecycle.violationCount}
                </div>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
                  event_seq: {selectedLifecycle.eventSeq} | archived: {selectedLifecycle.archived ? "yes" : "no"}
                </div>
              </div>
              <div
                data-testid="quick-grid-contract-diagnostics"
                style={{
                  border: "1px solid rgba(95, 183, 218, 0.22)",
                  borderRadius: 8,
                  background: "rgba(5, 14, 25, 0.68)",
                  padding: "7px 8px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                  CONTRACT DIAGNOSTICS
                </div>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>
                  required: {contractDiagnostics.requiredCount} | covered: {contractDiagnostics.coveredCount} | missing:{" "}
                  {contractDiagnostics.missing.length} | mismatch: {contractDiagnostics.typeMismatch.length}
                </div>
                {contractDiagnostics.missing.length ? (
                  <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffd5a3" }}>
                    chybi: {contractDiagnostics.missing.join(", ")}
                  </div>
                ) : null}
                {contractDiagnostics.typeMismatch.length ? (
                  <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffc8a8" }}>
                    type mismatch:{" "}
                    {contractDiagnostics.typeMismatch
                      .map((item) => `${item.fieldKey} (${item.actualType} -> ${item.expectedType})`)
                      .join(", ")}
                  </div>
                ) : null}
                {contractDiagnostics.suggestions.length ? (
                  <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#bde6f7" }}>
                    autofix navrh: {contractDiagnostics.suggestions.join(" | ")}
                  </div>
                ) : (
                  <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#b7efce" }}>Kontrakt coverage je v poradku.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {planetToast ? (
        <div
          data-testid="quick-grid-planet-toast"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.22)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.74)",
            padding: "7px 8px",
            fontSize: "var(--dv-fs-xs)",
            color:
              planetToast.tone === "error"
                ? "#ffb4b4"
                : planetToast.tone === "warn"
                  ? "#ffd5a3"
                  : planetToast.tone === "ok"
                    ? "#b7efce"
                    : "#bde6f7",
          }}
        >
          [{planetToast.action}] {planetToast.message}
        </div>
      ) : null}

      {writeFeedback ? (
        <div
          data-testid="quick-grid-write-feedback"
          style={{
            border: "1px solid rgba(96, 186, 220, 0.22)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.52)",
            padding: "7px 8px",
            fontSize: "var(--dv-fs-xs)",
            color: "#ffd5a3",
          }}
        >
          {writeFeedback}
        </div>
      ) : null}
      <div
        data-testid="quick-grid-planet-event-log"
        style={{
          border: "1px solid rgba(96, 186, 220, 0.22)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.46)",
          padding: "7px 8px",
          display: "grid",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            WORKFLOW LOG
          </div>
          <select
            data-testid="quick-grid-workflow-log-filter"
            value={workflowLogFilter}
            onChange={(event) => setWorkflowLogFilter(String(event.target.value || "ALL").toUpperCase())}
            style={{ ...inputStyle, padding: "4px 8px", fontSize: "var(--dv-fs-2xs)", maxWidth: 132 }}
          >
            <option value="ALL">ALL</option>
            <option value="UI">UI</option>
            <option value="BE_STREAM">BE_STREAM</option>
            <option value="ERROR">ERROR</option>
          </select>
          <input
            data-testid="quick-grid-workflow-log-search"
            value={workflowLogQuery}
            onChange={(event) => setWorkflowLogQuery(event.target.value)}
            placeholder="search action/message..."
            style={{ ...inputStyle, padding: "4px 8px", fontSize: "var(--dv-fs-2xs)" }}
          />
        </div>
        {filteredWorkflowLog.length ? (
          filteredWorkflowLog.slice(0, 6).map((item) => (
            <div
              key={item.id}
              style={{
                fontSize: "var(--dv-fs-2xs)",
                opacity: 0.9,
                color:
                  item.tone === "error"
                    ? "#ffb4b4"
                    : item.tone === "warn"
                      ? "#ffd5a3"
                      : item.tone === "ok"
                        ? "#b7efce"
                        : "#c8edf9",
              }}
            >
              [{item.action}] {item.message}
            </div>
          ))
        ) : (
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.68 }}>
            Zatim bez workflow udalosti pro zvoleny filtr.
          </div>
        )}
      </div>

      <div
        style={{
          overflow: "auto",
          minHeight: 240,
          border: "1px solid rgba(96, 186, 220, 0.26)",
          borderRadius: 8,
          background: "rgba(5, 15, 27, 0.58)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 820 }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 4,
                  background: "rgba(8, 18, 32, 0.98)",
                  color: "#cbeef8",
                  borderBottom: "1px solid rgba(95, 177, 207, 0.32)",
                  padding: "7px 8px",
                  textAlign: "left",
                  fontSize: "var(--dv-fs-2xs)",
                  letterSpacing: "var(--dv-tr-medium)",
                  minWidth: 48,
                }}
              >
                <input
                  type="checkbox"
                  checked={allRowsSelected}
                  onChange={(event) => handleToggleAllVisibleRows(Boolean(event.target.checked))}
                  aria-label="select all rows"
                />
              </th>
              {gridColumns.map((column, index) => (
                <th
                  key={column}
                  style={{
                    position: "sticky",
                    top: 0,
                    left: index === 0 ? 48 : undefined,
                    zIndex: index === 0 ? 3 : 2,
                    background: "rgba(8, 18, 32, 0.98)",
                    color: "#cbeef8",
                    borderBottom: "1px solid rgba(95, 177, 207, 0.32)",
                    padding: "7px 8px",
                    textAlign: "left",
                    fontSize: "var(--dv-fs-2xs)",
                    letterSpacing: "var(--dv-tr-medium)",
                    minWidth: column === "value" ? 240 : 170,
                  }}
                >
                  {column === "value" ? "civilizace" : column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridFilteredRows.map((row) => {
              const rowPendingOp = pendingRowOps[String(row.id)] || null;
              const rowChecked = selectedRowIds.includes(String(row.id));
              return (
                <tr
                  key={String(row.id)}
                  data-testid="quick-grid-row"
                  onClick={() => {
                    onSelectRow?.(String(row.id));
                    setSelectedRowIds([String(row.id)]);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                      background: rowChecked ? "rgba(19, 63, 87, 0.92)" : "rgba(7, 18, 30, 0.95)",
                      padding: "6px 8px",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={rowChecked}
                      onChange={(event) => {
                        handleToggleRowSelection(String(row.id), Boolean(event.target.checked));
                      }}
                      aria-label={`select row ${String(row.id)}`}
                    />
                  </td>
                  {gridColumns.map((column, index) => (
                    <td
                      key={`${row.id}:${column}`}
                      style={{
                        position: index === 0 ? "sticky" : "relative",
                        left: index === 0 ? 48 : undefined,
                        zIndex: index === 0 ? 1 : 0,
                        borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                        background:
                          String(selectedAsteroidId || "") === String(row.id) || rowChecked
                            ? "rgba(17, 57, 84, 0.85)"
                            : index === 0
                              ? "rgba(7, 18, 30, 0.95)"
                              : "rgba(7, 18, 30, 0.72)",
                        opacity: rowPendingOp ? 0.72 : 1,
                        color: "#dff8ff",
                        padding: "6px 8px",
                        fontSize: "var(--dv-fs-sm)",
                        lineHeight: "var(--dv-lh-base)",
                      }}
                    >
                      {`${readGridCell(row, column) || "—"}${index === 0 && rowPendingOp ? ` (${rowPendingOp})` : ""}`}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!gridFilteredRows.length ? (
              <tr>
                <td
                  colSpan={(gridColumns.length || 1) + 1}
                  style={{
                    padding: "14px 10px",
                    color: "#b8d7e5",
                    fontSize: "var(--dv-fs-sm)",
                    opacity: 0.86,
                  }}
                >
                  Žádné řádky pro aktuální filtr.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
