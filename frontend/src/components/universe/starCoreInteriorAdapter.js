const VISUAL_TONE_MAP = Object.freeze({
  growth_amber: { tonePrimary: "#ffbf73", toneSecondary: "#ffe0ad" },
  balanced_blue: { tonePrimary: "#7ee8ff", toneSecondary: "#82ffd4" },
  sentinel_cyan: { tonePrimary: "#8ae3ff", toneSecondary: "#c8f4ff" },
  archive_amber: { tonePrimary: "#dcbf88", toneSecondary: "#f2dfba" },
});

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeOption(option) {
  const source = option && typeof option === "object" ? option : {};
  const tone =
    VISUAL_TONE_MAP[
      String(source.visual_tone || "")
        .trim()
        .toLowerCase()
    ] || VISUAL_TONE_MAP.balanced_blue;
  return {
    id: normalizeId(source.constitution_id),
    title: String(source.title_cz || "Ústava"),
    subtitle: String(source.summary_cz || ""),
    effectHint: String(source.summary_cz || ""),
    pulseHint: String(source.pulse_hint || ""),
    tonePrimary: tone.tonePrimary,
    toneSecondary: tone.toneSecondary,
    recommended: Boolean(source.recommended),
    lockAllowed: Boolean(source.lock_allowed),
    profileKey: String(source.profile_key || ""),
    lawPreset: String(source.law_preset || ""),
    physicalProfileKey: String(source.physical_profile_key || ""),
    physicalProfileVersion: Number.isFinite(Number(source.physical_profile_version))
      ? Math.max(1, Number(source.physical_profile_version))
      : 1,
  };
}

export function adaptStarCoreInteriorTruth(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    interiorPhase: String(source.interior_phase || "constitution_select").trim() || "constitution_select",
    selectedConstitutionId: normalizeId(source.selected_constitution_id),
    recommendedConstitutionId: normalizeId(source.recommended_constitution_id),
    availableConstitutions: Array.isArray(source.available_constitutions)
      ? source.available_constitutions.map(normalizeOption)
      : [],
    lockReady: Boolean(source.lock_ready),
    lockBlockers: Array.isArray(source.lock_blockers) ? source.lock_blockers.map((item) => String(item)) : [],
    lockTransitionState: String(source.lock_transition_state || "idle").trim() || "idle",
    firstOrbitReady: Boolean(source.first_orbit_ready),
    nextAction:
      source.next_action && typeof source.next_action === "object"
        ? {
            actionKey: String(source.next_action.action_key || ""),
            label: String(source.next_action.label_cz || ""),
          }
        : { actionKey: "", label: "" },
    explainability:
      source.explainability && typeof source.explainability === "object"
        ? {
            headline: String(source.explainability.headline_cz || ""),
            body: String(source.explainability.body_cz || ""),
          }
        : { headline: "", body: "" },
    sourceTruth:
      source.source_truth && typeof source.source_truth === "object"
        ? {
            profileKey: String(source.source_truth.profile_key || ""),
            lawPreset: String(source.source_truth.law_preset || ""),
            physicalProfileKey: String(source.source_truth.physical_profile_key || ""),
            physicalProfileVersion: Number.isFinite(Number(source.source_truth.physical_profile_version))
              ? Math.max(1, Number(source.source_truth.physical_profile_version))
              : 1,
          }
        : {
            profileKey: "",
            lawPreset: "",
            physicalProfileKey: "",
            physicalProfileVersion: 1,
          },
  };
}

export function createInitialStarCoreInteriorUiState() {
  return {
    isOpen: false,
    transientPhase: "",
    isLockPending: false,
    errorMessage: "",
  };
}

export function beginStarCoreInteriorUi() {
  return {
    isOpen: true,
    transientPhase: "star_core_interior_entry",
    isLockPending: false,
    errorMessage: "",
  };
}

export function resolveStarCoreInteriorEntryComplete(currentState) {
  return {
    ...(currentState || createInitialStarCoreInteriorUiState()),
    transientPhase: "",
  };
}

export function beginStarCorePolicyLockUi(currentState) {
  return {
    ...(currentState || createInitialStarCoreInteriorUiState()),
    isOpen: true,
    transientPhase: "policy_lock_transition",
    isLockPending: true,
    errorMessage: "",
  };
}

export function resolveStarCorePolicyLockUiSuccess(currentState) {
  return {
    ...(currentState || createInitialStarCoreInteriorUiState()),
    isOpen: true,
    transientPhase: "",
    isLockPending: false,
    errorMessage: "",
  };
}

export function resolveStarCorePolicyLockUiFailure(currentState, message = "") {
  return {
    ...(currentState || createInitialStarCoreInteriorUiState()),
    isOpen: true,
    transientPhase: "",
    isLockPending: false,
    errorMessage: String(message || "Uzamčení politik se nepodařilo dokončit."),
  };
}

export function closeStarCoreInteriorUi() {
  return createInitialStarCoreInteriorUiState();
}

export function resolveStarCoreInteriorModel({ interiorTruth = null, uiState = null } = {}) {
  const truth = interiorTruth || null;
  const state = uiState && typeof uiState === "object" ? uiState : createInitialStarCoreInteriorUiState();
  const backendPhase = String(truth?.interiorPhase || "constitution_select").trim() || "constitution_select";
  const phase = state.transientPhase || (state.isLockPending ? "policy_lock_transition" : backendPhase);
  const availableConstitutions = Array.isArray(truth?.availableConstitutions) ? truth.availableConstitutions : [];
  const selectedConstitution = availableConstitutions.find((item) => item.id === truth?.selectedConstitutionId) || null;

  return {
    phase: state.isOpen ? phase : "closed",
    isOpen: Boolean(state.isOpen),
    availableConstitutions,
    selectedConstitutionId: truth?.selectedConstitutionId || "",
    selectedConstitution,
    recommendedConstitutionId: truth?.recommendedConstitutionId || "",
    lockReady: Boolean(truth?.lockReady),
    lockBlockers: truth?.lockBlockers || [],
    nextAction: truth?.nextAction || { actionKey: "", label: "" },
    explainability: truth?.explainability || { headline: "", body: "" },
    sourceTruth: truth?.sourceTruth || {
      profileKey: "",
      lawPreset: "",
      physicalProfileKey: "",
      physicalProfileVersion: 1,
    },
    errorMessage: String(state.errorMessage || ""),
    canSelectConstitution:
      Boolean(state.isOpen) && (backendPhase === "constitution_select" || backendPhase === "policy_lock_ready"),
    canConfirmLock: Boolean(state.isOpen) && Boolean(truth?.lockReady) && !state.isLockPending,
    isLockPending: Boolean(state.isLockPending),
    isFirstOrbitReady: Boolean(truth?.firstOrbitReady),
  };
}
