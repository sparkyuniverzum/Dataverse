import { isCyclic } from "../../lib/graph";

export const VISUAL_BUILDER_NAV_STATE = Object.freeze({
  NAV_UNIVERSE: "NAV_UNIVERSE",
  NAV_PLANET_FOCUSED: "NAV_PLANET_FOCUSED",
  NAV_MOON_FOCUSED: "NAV_MOON_FOCUSED",
  NAV_CIVILIZATION_FOCUSED: "NAV_CIVILIZATION_FOCUSED",
  NAV_GRID_OPEN: "NAV_GRID_OPEN",
});

export const VISUAL_BUILDER_BOND_STATE = Object.freeze({
  BOND_IDLE: "BOND_IDLE",
  BOND_DRAFT_SOURCE: "BOND_DRAFT_SOURCE",
  BOND_DRAFT_TARGET: "BOND_DRAFT_TARGET",
  BOND_PREVIEW: "BOND_PREVIEW",
  BOND_BLOCKED: "BOND_BLOCKED",
  BOND_COMMITTING: "BOND_COMMITTING",
  BOND_COMMITTED: "BOND_COMMITTED",
});

export const VISUAL_BUILDER_EVENT = Object.freeze({
  SELECT_PLANET: "select_planet",
  SELECT_MOON: "select_moon",
  OPEN_GRID: "open_grid",
  CLOSE_GRID: "close_grid",
  START_BOND_DRAFT: "start_bond_draft",
  SELECT_BOND_TARGET: "select_bond_target",
  REQUEST_BOND_PREVIEW: "request_bond_preview",
  APPLY_BOND_PREVIEW_RESULT: "apply_bond_preview_result",
  CONFIRM_BOND_COMMIT: "confirm_bond_commit",
  RUNTIME_REFRESH: "runtime_refresh",
  CANCEL_BOND_DRAFT: "cancel_bond_draft",
  RECOVER_ERROR: "recover_error",
});

function toText(value) {
  return String(value || "").trim();
}

function toDecision(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function resolveNavigationState({
  selectedTableId = "",
  selectedAsteroidId = "",
  selectedCivilizationId = "",
  quickGridOpen = false,
} = {}) {
  if (quickGridOpen && toText(selectedTableId)) return VISUAL_BUILDER_NAV_STATE.NAV_GRID_OPEN;
  if (toText(selectedCivilizationId) && toText(selectedTableId)) {
    return VISUAL_BUILDER_NAV_STATE.NAV_CIVILIZATION_FOCUSED;
  }
  if (toText(selectedAsteroidId) && toText(selectedTableId)) return VISUAL_BUILDER_NAV_STATE.NAV_MOON_FOCUSED;
  if (toText(selectedTableId)) return VISUAL_BUILDER_NAV_STATE.NAV_PLANET_FOCUSED;
  return VISUAL_BUILDER_NAV_STATE.NAV_UNIVERSE;
}

export function resolveVisualBuilderState({
  loading = false,
  runtimeError = "",
  navigationState = VISUAL_BUILDER_NAV_STATE.NAV_UNIVERSE,
  bondState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  planetBuilderState = "",
} = {}) {
  if (toText(runtimeError)) return "ERROR_RECOVERABLE";
  if (loading) return "SYNCING";
  if (bondState !== VISUAL_BUILDER_BOND_STATE.BOND_IDLE) return bondState;
  if (toText(planetBuilderState) && planetBuilderState !== "Converged") return planetBuilderState;
  return navigationState;
}

export function resolveVisualBuilderRecoveryState({
  currentState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  lastValidState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  fallbackState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
} = {}) {
  if (toText(currentState) !== "ERROR_RECOVERABLE") return currentState;
  const candidate = toText(lastValidState);
  if (!candidate || candidate === "ERROR_RECOVERABLE") return fallbackState;
  return candidate;
}

export function evaluateBondFlowTransition({
  state = VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  event = "",
  payload = {},
} = {}) {
  const currentState = toText(state) || VISUAL_BUILDER_BOND_STATE.BOND_IDLE;
  const eventKey = toText(event).toLowerCase();
  const sourceId = toText(payload.sourceId);
  const targetId = toText(payload.targetId);
  const bondType = toText(payload.type).toUpperCase();
  const previewDecision = toDecision(payload.previewDecision);
  const previewBlocking = Boolean(payload.previewBlocking);
  const converged = Boolean(payload.converged);
  const existingBonds = Array.isArray(payload.existingBonds) ? payload.existingBonds : [];

  const fail = (reason, recoveryState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE) => ({
    allowed: false,
    reason,
    state: currentState,
    next_state: currentState,
    recovery_state: recoveryState,
  });
  const pass = (nextState = currentState, recoveryState = VISUAL_BUILDER_BOND_STATE.BOND_IDLE) => ({
    allowed: true,
    reason: "",
    state: currentState,
    next_state: nextState,
    recovery_state: recoveryState,
  });

  if (!eventKey) return fail("missing_event");

  if (eventKey === VISUAL_BUILDER_EVENT.CANCEL_BOND_DRAFT) {
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_IDLE);
  }
  if (eventKey === VISUAL_BUILDER_EVENT.RECOVER_ERROR) {
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_IDLE);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.START_BOND_DRAFT) {
    if (!sourceId) return fail("missing_source");
    if (
      currentState !== VISUAL_BUILDER_BOND_STATE.BOND_IDLE &&
      currentState !== VISUAL_BUILDER_BOND_STATE.BOND_COMMITTED
    ) {
      return fail("invalid_transition");
    }
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET) {
    if (currentState !== VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE) return fail("invalid_transition");
    if (!targetId) return fail("missing_target", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE);
    if (sourceId && sourceId === targetId) return fail("same_endpoint", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE);
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.REQUEST_BOND_PREVIEW) {
    if (
      currentState !== VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET &&
      currentState !== VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED
    ) {
      return fail("invalid_transition");
    }
    if (!sourceId || !targetId) return fail("incomplete_endpoints", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    if (!bondType) return fail("missing_type", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    if (isCyclic(sourceId, targetId, existingBonds)) {
      return fail("cyclic_dependency", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    }
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.APPLY_BOND_PREVIEW_RESULT) {
    if (currentState !== VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW) return fail("invalid_transition");
    if (previewBlocking || previewDecision === "REJECT") {
      return pass(VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    }
    if (previewDecision === "ALLOW" || previewDecision === "WARN") {
      return pass(VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    }
    return fail("preview_decision_missing", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT) {
    if (currentState !== VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW) return fail("invalid_transition");
    if (previewBlocking || (previewDecision !== "ALLOW" && previewDecision !== "WARN")) {
      return fail("preview_not_committable", VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
    }
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_COMMITTING, VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
  }

  if (eventKey === VISUAL_BUILDER_EVENT.RUNTIME_REFRESH) {
    if (currentState !== VISUAL_BUILDER_BOND_STATE.BOND_COMMITTING) return fail("invalid_transition");
    if (!converged) return fail("not_converged", VISUAL_BUILDER_BOND_STATE.BOND_COMMITTING);
    return pass(VISUAL_BUILDER_BOND_STATE.BOND_COMMITTED, VISUAL_BUILDER_BOND_STATE.BOND_COMMITTED);
  }

  return fail("unknown_event");
}

export function buildVisualBuilderTransitionMessage(result) {
  if (!result || result.allowed) return "";
  const reason = toText(result.reason).toLowerCase();
  if (reason === "missing_source") return "Bond draft vyzaduje zvoleny source moon.";
  if (reason === "missing_target") return "Bond draft vyzaduje zvoleny target moon.";
  if (reason === "same_endpoint") return "Source a target nemohou byt stejna civilizace.";
  if (reason === "cyclic_dependency") return "Tato vazba vytvoří cyklickou závislost a byla zablokována.";
  if (reason === "missing_type") return "Bond preview vyzaduje typ vazby.";
  if (reason === "preview_not_committable") return "Bond commit je povolen az po ALLOW/WARN preview bez blockingu.";
  if (reason === "incomplete_endpoints") return "Bond preview vyzaduje source i target civilizaci.";
  if (reason === "not_converged") return "Runtime refresh zatim nepotvrdil konvergenci commitu.";
  if (reason === "preview_decision_missing") return "Preview nevratilo rozhodnuti ALLOW/WARN/REJECT.";
  if (reason === "recover_required") return "Nejdriv obnov posledni validni stav flow.";
  return "Akce neni v aktualnim stavu visual builderu povolena.";
}
