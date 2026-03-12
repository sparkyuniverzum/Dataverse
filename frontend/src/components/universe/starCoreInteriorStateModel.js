export const STAR_CORE_INTERIOR_PHASE = Object.freeze({
  CLOSED: "closed",
  ENTRY: "star_core_interior_entry",
  CONSTITUTION_SELECT: "constitution_select",
  POLICY_LOCK_READY: "policy_lock_ready",
  POLICY_LOCK_TRANSITION: "policy_lock_transition",
  FIRST_ORBIT_READY: "first_orbit_ready",
});

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function createInitialStarCoreInteriorState() {
  return {
    phase: STAR_CORE_INTERIOR_PHASE.CLOSED,
    selectedConstitutionId: "",
    lockRequestStatus: "idle",
    errorMessage: "",
  };
}

export function beginStarCoreInterior(currentState, { reducedMotion = false } = {}) {
  const selectedConstitutionId = normalizeId(currentState?.selectedConstitutionId);
  return {
    phase: reducedMotion ? STAR_CORE_INTERIOR_PHASE.CONSTITUTION_SELECT : STAR_CORE_INTERIOR_PHASE.ENTRY,
    selectedConstitutionId,
    lockRequestStatus: "idle",
    errorMessage: "",
  };
}

export function advanceStarCoreInterior(currentState) {
  if (currentState?.phase !== STAR_CORE_INTERIOR_PHASE.ENTRY) return currentState;
  return {
    ...currentState,
    phase: currentState?.selectedConstitutionId
      ? STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_READY
      : STAR_CORE_INTERIOR_PHASE.CONSTITUTION_SELECT,
  };
}

export function selectStarCoreConstitution(currentState, constitutionId) {
  const selectedConstitutionId = normalizeId(constitutionId);
  if (!selectedConstitutionId) return currentState;
  return {
    phase: STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_READY,
    selectedConstitutionId,
    lockRequestStatus: "idle",
    errorMessage: "",
  };
}

export function beginStarCorePolicyLock(currentState) {
  if (!normalizeId(currentState?.selectedConstitutionId)) return currentState;
  return {
    ...currentState,
    phase: STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_TRANSITION,
    lockRequestStatus: "pending",
    errorMessage: "",
  };
}

export function resolveStarCorePolicyLockSuccess(currentState) {
  return {
    ...currentState,
    phase: STAR_CORE_INTERIOR_PHASE.FIRST_ORBIT_READY,
    lockRequestStatus: "success",
    errorMessage: "",
  };
}

export function resolveStarCorePolicyLockFailure(currentState, message = "") {
  return {
    ...currentState,
    phase: STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_READY,
    lockRequestStatus: "error",
    errorMessage: String(message || "Uzamčení politik se nepodařilo dokončit."),
  };
}

export function resolveStarCoreInteriorEscape(currentState) {
  const phase = String(currentState?.phase || STAR_CORE_INTERIOR_PHASE.CLOSED).trim();
  if (phase === STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_TRANSITION) {
    return currentState;
  }
  return createInitialStarCoreInteriorState();
}

export function closeStarCoreInterior() {
  return createInitialStarCoreInteriorState();
}

export function resolveStarCoreInteriorModel(interiorState) {
  const phase = String(interiorState?.phase || STAR_CORE_INTERIOR_PHASE.CLOSED).trim();
  const selectedConstitutionId = normalizeId(interiorState?.selectedConstitutionId);
  const lockRequestStatus = String(interiorState?.lockRequestStatus || "idle").trim();
  const errorMessage = String(interiorState?.errorMessage || "").trim();
  const isOpen = phase !== STAR_CORE_INTERIOR_PHASE.CLOSED;

  return {
    phase,
    isOpen,
    selectedConstitutionId,
    lockRequestStatus,
    errorMessage,
    canSelectConstitution:
      phase === STAR_CORE_INTERIOR_PHASE.CONSTITUTION_SELECT || phase === STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_READY,
    canConfirmLock: phase === STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_READY && Boolean(selectedConstitutionId),
    isLockPending: phase === STAR_CORE_INTERIOR_PHASE.POLICY_LOCK_TRANSITION && lockRequestStatus === "pending",
    isFirstOrbitReady: phase === STAR_CORE_INTERIOR_PHASE.FIRST_ORBIT_READY,
  };
}
