const VISUAL_TONE_MAP = Object.freeze({
  growth_amber: { tonePrimary: "#ffbf73", toneSecondary: "#ffe0ad" },
  balanced_blue: { tonePrimary: "#7ee8ff", toneSecondary: "#82ffd4" },
  sentinel_cyan: { tonePrimary: "#8ae3ff", toneSecondary: "#c8f4ff" },
  archive_amber: { tonePrimary: "#dcbf88", toneSecondary: "#f2dfba" },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toOptionalInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.floor(numeric));
}

function safeString(value, fallback = "") {
  const normalized = String(value ?? fallback).trim();
  return normalized || fallback;
}

function normalizeRuntimeTelemetry(payload, fallback = null) {
  const source =
    payload && typeof payload === "object" ? payload : fallback && typeof fallback === "object" ? fallback : {};
  return {
    asOfEventSeq: toOptionalInteger(source.as_of_event_seq ?? source.asOfEventSeq),
    eventsCount: Math.max(0, Math.floor(toFiniteNumber(source.events_count ?? source.eventsCount, 0))),
    writesPerMinute: Math.max(0, toFiniteNumber(source.writes_per_minute ?? source.writesPerMinute, 0)),
  };
}

function normalizePulseTelemetry(payload, fallback = null) {
  const source =
    payload && typeof payload === "object" ? payload : fallback && typeof fallback === "object" ? fallback : {};
  const events = Array.isArray(source.events) ? source.events : [];
  const fallbackPeak = clamp(toFiniteNumber(source.peakIntensity, 0), 0, 1);
  const peakIntensity = events.reduce((max, eventItem) => {
    const intensity = clamp(toFiniteNumber(eventItem?.intensity, 0), 0, 1);
    return Math.max(max, intensity);
  }, fallbackPeak);
  const eventTypesSource = Array.isArray(source.event_types)
    ? source.event_types
    : Array.isArray(source.eventTypes)
      ? source.eventTypes
      : [];
  const eventTypes = eventTypesSource.map((item) => safeString(item)).filter(Boolean);

  return {
    lastEventSeq: toOptionalInteger(source.last_event_seq ?? source.lastEventSeq),
    sampledCount: Math.max(0, Math.floor(toFiniteNumber(source.sampled_count ?? source.sampledCount, events.length))),
    eventTypes,
    peakIntensity,
  };
}

function normalizeDomainTelemetry(payload, fallback = null) {
  const source =
    payload && typeof payload === "object" ? payload : fallback && typeof fallback === "object" ? fallback : {};
  const rawItems = Array.isArray(source.domains) ? source.domains : Array.isArray(source.items) ? source.items : [];
  const items = rawItems
    .map((item) => ({
      domainName: safeString(item?.domain_name ?? item?.domainName),
      status: safeString(item?.status || "stable"),
      eventsCount: Math.max(0, Math.floor(toFiniteNumber(item?.events_count ?? item?.eventsCount, 0))),
      activityIntensity: clamp(toFiniteNumber(item?.activity_intensity ?? item?.activityIntensity, 0), 0, 1),
    }))
    .filter((item) => Boolean(item.domainName));
  const sortedByActivity = [...items].sort((a, b) => b.activityIntensity - a.activityIntensity);
  const primaryDomain = sortedByActivity[0] || null;

  return {
    totalEventsCount: Math.max(0, Math.floor(toFiniteNumber(source.total_events_count ?? source.totalEventsCount, 0))),
    updatedAt: safeString(source.updated_at ?? source.updatedAt),
    items,
    primaryDomain,
  };
}

function normalizePlanetPhysicsTelemetry(payload, fallback = null) {
  const source =
    payload && typeof payload === "object" ? payload : fallback && typeof fallback === "object" ? fallback : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const phaseCountsMap = new Map();
  let activeCount = 0;
  let criticalCount = 0;
  let stressMax = 0;
  let healthTotal = 0;

  rawItems.forEach((item) => {
    const phase = safeString(item?.phase || "CALM", "CALM").toUpperCase();
    const metrics = item?.metrics && typeof item.metrics === "object" ? item.metrics : {};
    const activity = Math.max(0, toFiniteNumber(metrics.activity, 0));
    const stress = clamp(toFiniteNumber(metrics.stress, 0), 0, 1);
    const health = clamp(toFiniteNumber(metrics.health, 0), 0, 1);
    const corrosion = clamp(toFiniteNumber(metrics.corrosion, 0), 0, 1);
    const phaseCount = phaseCountsMap.get(phase) || 0;
    phaseCountsMap.set(phase, phaseCount + 1);
    if (activity > 0.08 || phase !== "CALM") activeCount += 1;
    if (stress >= 0.65 || corrosion >= 0.55) criticalCount += 1;
    stressMax = Math.max(stressMax, stress);
    healthTotal += health;
  });

  const phaseCounts = Array.from(phaseCountsMap.entries())
    .map(([phase, count]) => ({ phase, count }))
    .sort((a, b) => b.count - a.count);
  const itemCount = rawItems.length;
  const fallbackItemCount = Math.max(0, Math.floor(toFiniteNumber(source.itemCount, 0)));
  const fallbackActiveCount = Math.max(0, Math.floor(toFiniteNumber(source.activeCount, 0)));
  const fallbackCriticalCount = Math.max(0, Math.floor(toFiniteNumber(source.criticalCount, 0)));

  return {
    asOfEventSeq: toOptionalInteger(source.as_of_event_seq ?? source.asOfEventSeq),
    itemCount: itemCount || fallbackItemCount,
    activeCount: itemCount ? activeCount : fallbackActiveCount,
    criticalCount: itemCount ? criticalCount : fallbackCriticalCount,
    avgHealth: itemCount ? clamp(healthTotal / itemCount, 0, 1) : clamp(toFiniteNumber(source.avgHealth, 1), 0, 1),
    stressMax: clamp(itemCount ? stressMax : toFiniteNumber(source.stressMax, 0), 0, 1),
    phaseCounts: phaseCounts.length
      ? phaseCounts
      : Array.isArray(source.phaseCounts)
        ? source.phaseCounts
            .map((item) => ({
              phase: safeString(item?.phase || "CALM", "CALM").toUpperCase(),
              count: Math.max(0, Math.floor(toFiniteNumber(item?.count, 0))),
            }))
            .filter((item) => item.count > 0)
        : [],
  };
}

function resolveGovernanceSignal({ sourceTruth = null, policyPayload = null, physicsProfilePayload = null } = {}) {
  const source = sourceTruth && typeof sourceTruth === "object" ? sourceTruth : {};
  const policySource = policyPayload && typeof policyPayload === "object" ? policyPayload : {};
  const physicsSource = physicsProfilePayload && typeof physicsProfilePayload === "object" ? physicsProfilePayload : {};
  const lockStatus = source.policy_lock_status ?? policySource.lock_status ?? "draft";
  const profileKey = source.profile_key ?? policySource.profile_key ?? "ORIGIN";
  const physicalProfileKey = source.physical_profile_key ?? physicsSource.profile_key ?? "BALANCE";
  return {
    lockStatus: safeString(lockStatus, "draft"),
    policyVersion: Math.max(1, Math.floor(toFiniteNumber(source.policy_version ?? policySource.policy_version, 1))),
    profileMode: safeString(policySource.profile_mode || "auto", "auto"),
    profileKey: safeString(profileKey, "ORIGIN"),
    physicalProfileKey: safeString(physicalProfileKey, "BALANCE"),
    physicalProfileVersion: Math.max(
      1,
      Math.floor(
        toFiniteNumber(
          source.physical_profile_version ?? physicsSource.profile_version ?? policySource.physical_profile_version,
          1
        )
      )
    ),
  };
}

function resolveInteriorTelemetry({
  runtimePayload = null,
  pulsePayload = null,
  domainMetricsPayload = null,
  planetPhysicsPayload = null,
  fallbackTelemetry = null,
} = {}) {
  const fallback = fallbackTelemetry && typeof fallbackTelemetry === "object" ? fallbackTelemetry : {};
  return {
    runtime: normalizeRuntimeTelemetry(runtimePayload, fallback.runtime),
    pulse: normalizePulseTelemetry(pulsePayload, fallback.pulse),
    domains: normalizeDomainTelemetry(domainMetricsPayload, fallback.domains),
    planetPhysics: normalizePlanetPhysicsTelemetry(planetPhysicsPayload, fallback.planetPhysics),
  };
}

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

export function adaptStarCoreInteriorTruth(
  payload,
  {
    runtimePayload = null,
    pulsePayload = null,
    domainMetricsPayload = null,
    planetPhysicsPayload = null,
    policyPayload = null,
    physicsProfilePayload = null,
    fallbackTelemetry = null,
  } = {}
) {
  const source = payload && typeof payload === "object" ? payload : {};
  const sourceTruth = source.source_truth && typeof source.source_truth === "object" ? source.source_truth : null;

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
    sourceTruth: sourceTruth
      ? {
          profileKey: String(sourceTruth.profile_key || ""),
          lawPreset: String(sourceTruth.law_preset || ""),
          physicalProfileKey: String(sourceTruth.physical_profile_key || ""),
          physicalProfileVersion: Number.isFinite(Number(sourceTruth.physical_profile_version))
            ? Math.max(1, Number(sourceTruth.physical_profile_version))
            : 1,
        }
      : {
          profileKey: "",
          lawPreset: "",
          physicalProfileKey: "",
          physicalProfileVersion: 1,
        },
    governanceSignal: resolveGovernanceSignal({
      sourceTruth,
      policyPayload,
      physicsProfilePayload,
    }),
    telemetry: resolveInteriorTelemetry({
      runtimePayload,
      pulsePayload,
      domainMetricsPayload,
      planetPhysicsPayload,
      fallbackTelemetry,
    }),
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
    governanceSignal: truth?.governanceSignal || {
      lockStatus: "draft",
      policyVersion: 1,
      profileMode: "auto",
      profileKey: "",
      physicalProfileKey: "",
      physicalProfileVersion: 1,
    },
    telemetry: truth?.telemetry || {
      runtime: { asOfEventSeq: null, eventsCount: 0, writesPerMinute: 0 },
      pulse: { lastEventSeq: null, sampledCount: 0, eventTypes: [], peakIntensity: 0 },
      domains: { totalEventsCount: 0, updatedAt: "", items: [], primaryDomain: null },
      planetPhysics: {
        asOfEventSeq: null,
        itemCount: 0,
        activeCount: 0,
        criticalCount: 0,
        avgHealth: 1,
        stressMax: 0,
        phaseCounts: [],
      },
    },
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
