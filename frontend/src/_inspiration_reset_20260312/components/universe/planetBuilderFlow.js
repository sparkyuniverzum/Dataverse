export const PLANET_BUILDER_STATE = Object.freeze({
  IDLE: "Idle",
  STAR_LOCKED_REQUIRED: "StarLockedRequired",
  BLUEPRINT_OPEN: "BlueprintOpen",
  DRAGGING_PLANET: "DraggingPlanet",
  PLANET_PLACED: "PlanetPlaced",
  CAMERA_SETTLED: "CameraSettled",
  BUILDER_OPEN: "BuilderOpen",
  CAPABILITY_ASSEMBLING: "CapabilityAssembling",
  PREVIEW_READY: "PreviewReady",
  COMMITTING: "Committing",
  CONVERGED: "Converged",
  ERROR_RECOVERABLE: "ErrorRecoverable",
});

export const PLANET_BUILDER_FLOW_ORDER = Object.freeze([
  PLANET_BUILDER_STATE.IDLE,
  PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED,
  PLANET_BUILDER_STATE.BLUEPRINT_OPEN,
  PLANET_BUILDER_STATE.DRAGGING_PLANET,
  PLANET_BUILDER_STATE.PLANET_PLACED,
  PLANET_BUILDER_STATE.CAMERA_SETTLED,
  PLANET_BUILDER_STATE.BUILDER_OPEN,
  PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
  PLANET_BUILDER_STATE.PREVIEW_READY,
  PLANET_BUILDER_STATE.COMMITTING,
  PLANET_BUILDER_STATE.CONVERGED,
  PLANET_BUILDER_STATE.ERROR_RECOVERABLE,
]);

export const PLANET_BUILDER_ACTION = Object.freeze({
  OPEN_BLUEPRINT: "open_blueprint",
  START_DRAG_PLANET: "start_drag_planet",
  DROP_PLANET: "drop_planet",
  OPEN_SETUP: "open_setup",
  SELECT_PRESET: "select_preset",
  ASSEMBLE_SCHEMA_STEP: "assemble_schema_step",
  COMMIT_PRESET: "commit_preset",
  RECOVER_ERROR: "recover_error",
});

function toBool(value) {
  return Boolean(value);
}

function hasError(value) {
  return Boolean(String(value || "").trim());
}

function numberValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export function resolvePlanetBuilderState({
  stageZeroActive = false,
  stageZeroRequiresStarLock = false,
  stageZeroFlow = "intro",
  stageZeroDragging = false,
  stageZeroCreating = false,
  stageZeroSetupOpen = false,
  stageZeroPresetSelected = false,
  stageZeroAllSchemaStepsDone = false,
  stageZeroCommitBusy = false,
  stageZeroCompletedSteps = 0,
  quickGridOpen = false,
  runtimeError = "",
} = {}) {
  if (stageZeroActive && hasError(runtimeError)) return PLANET_BUILDER_STATE.ERROR_RECOVERABLE;
  if (!toBool(stageZeroActive)) return PLANET_BUILDER_STATE.CONVERGED;
  if (toBool(stageZeroRequiresStarLock)) return PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED;
  if (toBool(stageZeroCommitBusy)) return PLANET_BUILDER_STATE.COMMITTING;
  if (toBool(stageZeroSetupOpen) && toBool(stageZeroPresetSelected) && toBool(stageZeroAllSchemaStepsDone)) {
    return PLANET_BUILDER_STATE.PREVIEW_READY;
  }
  if (toBool(stageZeroSetupOpen) && toBool(stageZeroPresetSelected) && numberValue(stageZeroCompletedSteps) > 0) {
    return PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING;
  }
  if (toBool(stageZeroSetupOpen)) return PLANET_BUILDER_STATE.BUILDER_OPEN;
  if (stageZeroFlow === "complete") return PLANET_BUILDER_STATE.CAMERA_SETTLED;
  if (toBool(stageZeroCreating)) return PLANET_BUILDER_STATE.PLANET_PLACED;
  if (toBool(stageZeroDragging)) return PLANET_BUILDER_STATE.DRAGGING_PLANET;
  if (stageZeroFlow === "blueprint" || stageZeroFlow === "building") return PLANET_BUILDER_STATE.BLUEPRINT_OPEN;
  if (toBool(quickGridOpen)) return PLANET_BUILDER_STATE.CONVERGED;
  return PLANET_BUILDER_STATE.IDLE;
}

export function buildPlanetBuilderNarrative(state) {
  const key = String(state || PLANET_BUILDER_STATE.IDLE);
  const copyByState = {
    [PLANET_BUILDER_STATE.IDLE]: {
      title: "Prvni planeta",
      why: "Planeta je datovy kontejner. Bez ni nemas kam usadit civilizaci.",
      action: "Otevri stavebnici a zacni umistenim planety.",
    },
    [PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED]: {
      title: "Nejdriv ustava",
      why: "Hvezda urcuje nemenne zakony galaxie pro vsechny planety.",
      action: "Vstup do Star Heart Dashboardu a zamkni profil.",
    },
    [PLANET_BUILDER_STATE.BLUEPRINT_OPEN]: {
      title: "Blueprint aktivni",
      why: "Drag and drop urci kde planeta vznikne v prostoru.",
      action: "Vezmi ikonu Planety a pretahni ji na platno.",
    },
    [PLANET_BUILDER_STATE.DRAGGING_PLANET]: {
      title: "Zaveseni planety",
      why: "Hologram ti potvrzuje, ze jsi ve stavebni zone.",
      action: "Pust planetu do prostoru a nech ji zhmotnit.",
    },
    [PLANET_BUILDER_STATE.PLANET_PLACED]: {
      title: "Zhmotneni",
      why: "Backend vytvari planetu a pripravi ji na schema setup.",
      action: "Pockej na dokonceni a otevreni setup panelu.",
    },
    [PLANET_BUILDER_STATE.CAMERA_SETTLED]: {
      title: "Kamera usazena",
      why: "Planeta je vycentrovana, aby vedle ni byl prostor pro editor.",
      action: "Otevri setup panel a vyber preset.",
    },
    [PLANET_BUILDER_STATE.BUILDER_OPEN]: {
      title: "Setup panel",
      why: "Schema drzi rad v datech a brani chaosu v civilizaci.",
      action: "Vyber preset a zahaj lego skladani.",
    },
    [PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING]: {
      title: "Lego skladani",
      why: "Kazdy dil urcuje, jake nerosty budou civilizace tezit.",
      action: "Dokonci vsechny bloky schema planu.",
    },
    [PLANET_BUILDER_STATE.PREVIEW_READY]: {
      title: "Plan pripraven",
      why: "Preview potvrzuje finalni schema pred atomickym commitem.",
      action: "Klikni na Zazehnout Jadro.",
    },
    [PLANET_BUILDER_STATE.COMMITTING]: {
      title: "Commit do reality",
      why: "Schema + seed zapisy se aplikuji atomicky.",
      action: "Pockej na konvergenci 3D a gridu.",
    },
    [PLANET_BUILDER_STATE.CONVERGED]: {
      title: "Konvergence hotova",
      why: "3D planety i grid ted zobrazuji stejny runtime stav.",
      action: "Pokracuj dalsimi planetami nebo capability vrstvou.",
    },
    [PLANET_BUILDER_STATE.ERROR_RECOVERABLE]: {
      title: "Obnovitelna chyba",
      why: "Kontrakt nebo OCC selhal, ale flow zustava v poslednim validnim kroku.",
      action: "Pouzij guided repair nebo zopakuj posledni akci.",
    },
  };
  return copyByState[key] || copyByState[PLANET_BUILDER_STATE.IDLE];
}

export function buildPlanetBuilderStepChecklist(state) {
  const indexByState = {
    [PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED]: 0,
    [PLANET_BUILDER_STATE.IDLE]: 0,
    [PLANET_BUILDER_STATE.BLUEPRINT_OPEN]: 1,
    [PLANET_BUILDER_STATE.DRAGGING_PLANET]: 1,
    [PLANET_BUILDER_STATE.PLANET_PLACED]: 2,
    [PLANET_BUILDER_STATE.CAMERA_SETTLED]: 2,
    [PLANET_BUILDER_STATE.BUILDER_OPEN]: 3,
    [PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING]: 4,
    [PLANET_BUILDER_STATE.PREVIEW_READY]: 5,
    [PLANET_BUILDER_STATE.COMMITTING]: 6,
    [PLANET_BUILDER_STATE.CONVERGED]: 7,
    [PLANET_BUILDER_STATE.ERROR_RECOVERABLE]: 6,
  };
  const currentIndex = indexByState[String(state)] ?? 0;
  const labels = [
    "Star lock",
    "Blueprint panel",
    "Planet placement",
    "Setup panel",
    "Lego schema",
    "Preview",
    "Commit",
    "Converged",
  ];
  return labels.map((label, index) => ({
    label,
    done: index < currentIndex,
    active: index === currentIndex,
  }));
}

function isSchemaAssemblyState(state) {
  return (
    state === PLANET_BUILDER_STATE.BUILDER_OPEN ||
    state === PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING ||
    state === PLANET_BUILDER_STATE.PREVIEW_READY
  );
}

export function resolvePlanetBuilderRecoveryState({
  currentState = PLANET_BUILDER_STATE.IDLE,
  lastValidState = PLANET_BUILDER_STATE.IDLE,
} = {}) {
  if (currentState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) return currentState;
  const candidate = String(lastValidState || "").trim();
  if (!candidate || candidate === PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
    return PLANET_BUILDER_STATE.BLUEPRINT_OPEN;
  }
  if (!PLANET_BUILDER_FLOW_ORDER.includes(candidate)) {
    return PLANET_BUILDER_STATE.BLUEPRINT_OPEN;
  }
  return candidate;
}

export function evaluatePlanetBuilderTransition({ state = PLANET_BUILDER_STATE.IDLE, action = "", context = {} } = {}) {
  const currentState = String(state || PLANET_BUILDER_STATE.IDLE);
  const actionKey = String(action || "")
    .trim()
    .toLowerCase();
  const schemaComplete = Boolean(context?.schemaComplete);
  const starLocked = Boolean(context?.starLocked);
  const recoveryState = resolvePlanetBuilderRecoveryState({
    currentState,
    lastValidState: context?.lastValidState,
  });

  const fail = (reason) => ({
    allowed: false,
    reason,
    state: currentState,
    next_state: currentState,
    recovery_state: recoveryState,
  });
  const pass = (nextState = currentState) => ({
    allowed: true,
    reason: "",
    state: currentState,
    next_state: nextState,
    recovery_state: recoveryState,
  });

  if (!actionKey) return fail("missing_action");
  if (!PLANET_BUILDER_FLOW_ORDER.includes(currentState)) return fail("unknown_state");

  if (actionKey === PLANET_BUILDER_ACTION.RECOVER_ERROR) {
    if (currentState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) return fail("recover_not_needed");
    return pass(recoveryState);
  }

  if (currentState === PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
    return fail("recover_required");
  }

  if (actionKey === PLANET_BUILDER_ACTION.OPEN_BLUEPRINT) {
    if (!starLocked || currentState === PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED) return fail("star_lock_required");
    if (currentState === PLANET_BUILDER_STATE.IDLE || currentState === PLANET_BUILDER_STATE.BLUEPRINT_OPEN) {
      return pass(PLANET_BUILDER_STATE.BLUEPRINT_OPEN);
    }
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.START_DRAG_PLANET) {
    if (currentState === PLANET_BUILDER_STATE.BLUEPRINT_OPEN) return pass(PLANET_BUILDER_STATE.DRAGGING_PLANET);
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.DROP_PLANET) {
    if (currentState === PLANET_BUILDER_STATE.DRAGGING_PLANET) return pass(PLANET_BUILDER_STATE.PLANET_PLACED);
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.OPEN_SETUP) {
    if (
      currentState === PLANET_BUILDER_STATE.PLANET_PLACED ||
      currentState === PLANET_BUILDER_STATE.CAMERA_SETTLED ||
      currentState === PLANET_BUILDER_STATE.BUILDER_OPEN
    ) {
      return pass(PLANET_BUILDER_STATE.BUILDER_OPEN);
    }
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.SELECT_PRESET) {
    if (isSchemaAssemblyState(currentState)) return pass(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.ASSEMBLE_SCHEMA_STEP) {
    if (isSchemaAssemblyState(currentState)) {
      return pass(schemaComplete ? PLANET_BUILDER_STATE.PREVIEW_READY : PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
    }
    return fail("invalid_transition");
  }

  if (actionKey === PLANET_BUILDER_ACTION.COMMIT_PRESET) {
    if (!schemaComplete) return fail("schema_incomplete");
    if (currentState === PLANET_BUILDER_STATE.PREVIEW_READY) return pass(PLANET_BUILDER_STATE.COMMITTING);
    return fail("invalid_transition");
  }

  return fail("unknown_action");
}

export function buildPlanetBuilderTransitionMessage(result) {
  if (!result || result.allowed) return "";
  const reason = String(result.reason || "")
    .trim()
    .toLowerCase();
  if (reason === "star_lock_required") return "Nejdriv uzamkni Star Core profil. Bez locku nelze pokracovat.";
  if (reason === "schema_incomplete") return "Schema neni kompletni. Dokonci vsechny lego kroky pred commitem.";
  if (reason === "recover_required")
    return `Nejdriv obnov flow do posledniho validniho kroku (${result.recovery_state || "BlueprintOpen"}).`;
  return "Akce v tomto kroku neni povolena. Pokracuj podle aktivniho kroku mise.";
}
