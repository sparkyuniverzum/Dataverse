import { buildParserPayload } from "./dataverseApi";

const UUID_V4ISH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIMPLE_OPERAND_RE = /^[A-Za-z0-9_-]+$/;

function escapeQuoted(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function toParserOperand(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (UUID_V4ISH_RE.test(value)) return value;
  if (SIMPLE_OPERAND_RE.test(value)) return value;
  return `"${escapeQuoted(value)}"`;
}

export function buildLinkMoonsCommand({ sourceId, targetId, sourceLabel = "", targetLabel = "" } = {}) {
  const left = toParserOperand(sourceId || sourceLabel);
  const right = toParserOperand(targetId || targetLabel);
  if (!left || !right) return "";
  return `${left} + ${right}`;
}

export function buildTypeMoonsCommand({ sourceId, targetId, sourceLabel = "", targetLabel = "" } = {}) {
  const left = toParserOperand(sourceId || sourceLabel);
  const right = toParserOperand(targetId || targetLabel);
  if (!left || !right) return "";
  return `${left} : ${right}`;
}

export function buildExtinguishMoonCommand({ asteroidId, asteroidLabel = "" } = {}) {
  const operand = toParserOperand(asteroidId || asteroidLabel);
  if (!operand) return "";
  return `Delete : ${operand}`;
}

function toMetadataLiteral(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value).trim();
  if (!text) return "";
  if (UUID_V4ISH_RE.test(text) || SIMPLE_OPERAND_RE.test(text)) return text;
  return `"${escapeQuoted(text)}"`;
}

export function buildIngestMoonCommand({ value, tableName, metadata = {} } = {}) {
  const entity = toParserOperand(value);
  if (!entity) return "";

  const fields = [];
  const normalizedTable = String(tableName || "").trim();
  if (normalizedTable) {
    fields.push(`table: ${normalizedTable}`);
  }

  if (metadata && typeof metadata === "object") {
    Object.entries(metadata).forEach(([key, raw]) => {
      const normalizedKey = String(key || "").trim();
      const literal = toMetadataLiteral(raw);
      if (!normalizedKey || !literal) return;
      fields.push(`${normalizedKey}: ${literal}`);
    });
  }

  if (!fields.length) return entity;
  return `${entity} (${fields.join(", ")})`;
}

export function buildBuilderParserCommand(action) {
  const kind = String(action?.type || "")
    .trim()
    .toUpperCase();
  if (kind === "LINK_MOONS") return buildLinkMoonsCommand(action);
  if (kind === "TYPE_MOONS") return buildTypeMoonsCommand(action);
  if (kind === "EXTINGUISH_MOON") return buildExtinguishMoonCommand(action);
  if (kind === "INGEST_MOON") return buildIngestMoonCommand(action);
  return "";
}

export function buildBuilderParserPayload(action, { galaxyId = null, branchId = null } = {}) {
  const command = buildBuilderParserCommand(action);
  return buildParserPayload(command, galaxyId, branchId);
}
