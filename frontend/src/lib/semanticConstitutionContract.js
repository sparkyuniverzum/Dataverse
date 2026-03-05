import { bondSemanticsFromType } from "./dataverseApi";

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

export const SEMANTIC_CONSTITUTION_VERSION = "1.0.0";
export const SEMANTIC_CONSTITUTION_SCOPE = "semantic-constitution-v1";
export const SEMANTIC_CONSTITUTION_DOC = "docs/contracts/semantic-constitution-v1.md";

export const SEMANTIC_REQUIRED_OPERATORS = Object.freeze(["+", ":", "->", ":=", "-"]);
export const SEMANTIC_FE_SUPPORTED_OPERATORS = Object.freeze(["+", ":", "->", ":=", "-"]);

export const SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES = Object.freeze([
  "PATCH /asteroids/{asteroid_id}/extinguish",
  "PATCH /bonds/{bond_id}/extinguish",
  "PATCH /planets/{table_id}/extinguish",
  "PATCH /galaxies/{galaxy_id}/extinguish",
]);

export const SEMANTIC_NO_DELETE_ROUTE_PREFIXES = Object.freeze(["/asteroids", "/bonds", "/planets", "/galaxies"]);

export function normalizeBranchNameForConstitution(raw) {
  return String(raw || "").trim().toLocaleLowerCase("en-US");
}

export function semanticConstitutionContractDiff({
  requiredOperators = SEMANTIC_REQUIRED_OPERATORS,
  supportedOperators = SEMANTIC_FE_SUPPORTED_OPERATORS,
  requiredSoftDeleteRoutes = SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES,
  providedSoftDeleteRoutes = SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES,
} = {}) {
  return {
    operators: diff(requiredOperators, supportedOperators),
    soft_delete_routes: diff(requiredSoftDeleteRoutes, providedSoftDeleteRoutes),
  };
}

export function relationSemanticV1() {
  return bondSemanticsFromType("RELATION");
}

export function typeSemanticV1() {
  return bondSemanticsFromType("TYPE");
}
