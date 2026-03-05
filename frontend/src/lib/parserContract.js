function normalize(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))].sort();
}

function diff(required, provided) {
  const expected = new Set(normalize(required));
  const actual = new Set(normalize(provided));
  return {
    missing_in_fe: [...expected].filter((item) => !actual.has(item)).sort(),
    extra_in_fe: [...actual].filter((item) => !expected.has(item)).sort(),
  };
}

export const PARSER_CONTRACT_VERSION = "1.0.0";
export const PARSER_CONTRACT_SCOPE = "parser-v1-v2-fe-freeze";
export const PARSER_V1_DOC = "docs/contracts/parser-v1.md";
export const PARSER_V2_SPEC_DOC = "docs/contracts/parser-v2-spec.md";

export const PARSER_EXECUTE_ENDPOINT_SIGNATURES = Object.freeze([
  "POST /parser/execute",
]);

export const PARSER_FE_SUPPORTED_OPERATORS = Object.freeze([
  "+",
  ":",
  "-",
  "->",
  ":=",
  "=",
]);

export const PARSER_V2_REQUIRED_OPERATORS = Object.freeze([
  "+",
  ":",
  "-",
  "->",
  ":=",
  "=",
]);

export const PARSER_FE_BUILDER_ACTIONS = Object.freeze([
  "LINK_MOONS",
  "TYPE_MOONS",
  "EXTINGUISH_MOON",
  "INGEST_MOON",
]);

export function parserContractDiff() {
  return {
    parser_v2_operators: diff(PARSER_V2_REQUIRED_OPERATORS, PARSER_FE_SUPPORTED_OPERATORS),
  };
}
