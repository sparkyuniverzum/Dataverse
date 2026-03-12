import {
  buildPlanetBuilderTransitionMessage,
  evaluatePlanetBuilderTransition,
  PLANET_BUILDER_ACTION,
  PLANET_BUILDER_STATE,
  resolvePlanetBuilderRecoveryState,
} from "./planetBuilderFlow";

export const PLANET_BUILDER_WIZARD_ACTION = Object.freeze({
  LOCK_STAR: "lock_star",
  OPEN_BLUEPRINT: PLANET_BUILDER_ACTION.OPEN_BLUEPRINT,
  START_DRAG_PLANET: PLANET_BUILDER_ACTION.START_DRAG_PLANET,
  DROP_PLANET: PLANET_BUILDER_ACTION.DROP_PLANET,
  OPEN_SETUP: PLANET_BUILDER_ACTION.OPEN_SETUP,
  SELECT_PRESET: PLANET_BUILDER_ACTION.SELECT_PRESET,
  ASSEMBLE_SCHEMA_STEP: PLANET_BUILDER_ACTION.ASSEMBLE_SCHEMA_STEP,
  COMMIT_PRESET: PLANET_BUILDER_ACTION.COMMIT_PRESET,
  COMMIT_SUCCESS: "commit_success",
  RAISE_RECOVERABLE_ERROR: "raise_recoverable_error",
  RECOVER_ERROR: PLANET_BUILDER_ACTION.RECOVER_ERROR,
});

function clampInt(value, min, max) {
  const parsed = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : min;
  return Math.max(min, Math.min(max, parsed));
}

export function createPlanetBuilderWizardHarness({
  starLocked = false,
  schemaStepsTotal = 3,
  initialState = null,
} = {}) {
  const totalSteps = Math.max(1, clampInt(schemaStepsTotal, 1, 64));
  const state = {
    currentState: initialState || (starLocked ? PLANET_BUILDER_STATE.IDLE : PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED),
    lastValidState: starLocked ? PLANET_BUILDER_STATE.IDLE : PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED,
    starLocked: Boolean(starLocked),
    schemaStepsTotal: totalSteps,
    schemaStepsCompleted: 0,
    history: [],
  };

  function snapshot() {
    return {
      currentState: state.currentState,
      lastValidState: state.lastValidState,
      starLocked: state.starLocked,
      schemaStepsTotal: state.schemaStepsTotal,
      schemaStepsCompleted: state.schemaStepsCompleted,
      schemaComplete: state.schemaStepsCompleted >= state.schemaStepsTotal,
      history: [...state.history],
    };
  }

  function pushHistory(entry) {
    const normalized = {
      step: state.history.length + 1,
      action: String(entry?.action || ""),
      from_state: String(entry?.from_state || state.currentState),
      to_state: String(entry?.to_state || state.currentState),
      allowed: Boolean(entry?.allowed),
      reason: String(entry?.reason || ""),
      message: String(entry?.message || ""),
    };
    state.history.push(normalized);
    return normalized;
  }

  function transition(action, { schemaComplete = null } = {}) {
    const complete =
      schemaComplete === null ? state.schemaStepsCompleted >= state.schemaStepsTotal : Boolean(schemaComplete);
    const result = evaluatePlanetBuilderTransition({
      state: state.currentState,
      action,
      context: {
        schemaComplete: complete,
        starLocked: state.starLocked,
        lastValidState: state.lastValidState,
      },
    });
    if (!result.allowed) {
      pushHistory({
        action,
        allowed: false,
        reason: result.reason,
        message: buildPlanetBuilderTransitionMessage(result),
      });
      return {
        allowed: false,
        reason: result.reason,
        message: buildPlanetBuilderTransitionMessage(result),
        state: snapshot(),
      };
    }
    const previous = state.currentState;
    state.currentState = String(result.next_state || previous);
    if (state.currentState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
      state.lastValidState = state.currentState;
    }
    pushHistory({
      action,
      from_state: previous,
      to_state: state.currentState,
      allowed: true,
    });
    return { allowed: true, reason: "", message: "", state: snapshot() };
  }

  function dispatch(action) {
    const normalized = String(action || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return { allowed: false, reason: "missing_action", message: "Missing wizard action.", state: snapshot() };
    }
    if (normalized === PLANET_BUILDER_WIZARD_ACTION.LOCK_STAR) {
      const previous = state.currentState;
      state.starLocked = true;
      if (state.currentState === PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED) {
        state.currentState = PLANET_BUILDER_STATE.IDLE;
        state.lastValidState = PLANET_BUILDER_STATE.IDLE;
      }
      pushHistory({
        action: normalized,
        from_state: previous,
        to_state: state.currentState,
        allowed: true,
      });
      return { allowed: true, reason: "", message: "", state: snapshot() };
    }
    if (normalized === PLANET_BUILDER_WIZARD_ACTION.COMMIT_SUCCESS) {
      const previous = state.currentState;
      if (state.currentState !== PLANET_BUILDER_STATE.COMMITTING) {
        const reason = "invalid_transition";
        pushHistory({
          action: normalized,
          allowed: false,
          reason,
          message: "Commit success event is only valid from Committing state.",
        });
        return {
          allowed: false,
          reason,
          message: "Commit success event is only valid from Committing state.",
          state: snapshot(),
        };
      }
      state.currentState = PLANET_BUILDER_STATE.CONVERGED;
      state.lastValidState = state.currentState;
      pushHistory({
        action: normalized,
        from_state: previous,
        to_state: state.currentState,
        allowed: true,
      });
      return { allowed: true, reason: "", message: "", state: snapshot() };
    }
    if (normalized === PLANET_BUILDER_WIZARD_ACTION.RAISE_RECOVERABLE_ERROR) {
      const previous = state.currentState;
      if (state.currentState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
        state.lastValidState = previous;
      }
      state.currentState = PLANET_BUILDER_STATE.ERROR_RECOVERABLE;
      pushHistory({
        action: normalized,
        from_state: previous,
        to_state: state.currentState,
        allowed: true,
      });
      return { allowed: true, reason: "", message: "", state: snapshot() };
    }
    if (normalized === PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP) {
      const nextCompleted = clampInt(state.schemaStepsCompleted + 1, 0, state.schemaStepsTotal);
      const actionResult = transition(normalized, {
        schemaComplete: nextCompleted >= state.schemaStepsTotal,
      });
      if (actionResult.allowed) {
        state.schemaStepsCompleted = nextCompleted;
      }
      return {
        ...actionResult,
        state: snapshot(),
      };
    }
    if (normalized === PLANET_BUILDER_WIZARD_ACTION.RECOVER_ERROR) {
      const result = transition(normalized, {
        schemaComplete: state.schemaStepsCompleted >= state.schemaStepsTotal,
      });
      if (result.allowed) {
        const recovered = resolvePlanetBuilderRecoveryState({
          currentState: PLANET_BUILDER_STATE.ERROR_RECOVERABLE,
          lastValidState: state.lastValidState,
        });
        state.currentState = recovered;
      }
      return {
        ...result,
        state: snapshot(),
      };
    }
    return transition(normalized, {
      schemaComplete: state.schemaStepsCompleted >= state.schemaStepsTotal,
    });
  }

  return {
    dispatch,
    snapshot,
  };
}
