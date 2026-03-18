import { useEffect, useMemo, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildParserPlanUrl,
  buildSnapshotUrl,
  buildTaskBatchPayload,
  buildTaskExecuteBatchUrl,
  buildGalaxyPlanetsUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCoreInteriorEntryStartUrl,
  buildStarCoreInteriorConstitutionSelectUrl,
  buildStarCoreInteriorUrl,
  buildStarCorePlanetPhysicsUrl,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePolicyLockUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildTablesUrl,
  normalizeSnapshot,
} from "../../lib/dataverseApi";
import GalaxySelectionHud from "./GalaxySelectionHud.jsx";
import OperatorDock from "./OperatorDock.jsx";
import ReadGridOverlay from "./ReadGridOverlay.jsx";
import StarCoreInteriorScreen from "./StarCoreInteriorScreen.jsx";
import WorkspaceCommandBar from "./WorkspaceCommandBar.jsx";
import {
  beginGalaxyApproach,
  clearGalaxySelection,
  createInitialGalaxyNavigationState,
  resolveGalaxyEscape,
  resolveGalaxyNavigationModel,
  selectGalaxyObject,
} from "./galaxyNavigationStateModel.js";
import { buildGalaxySpaceObjects, resolveGalaxyRadarModel } from "./galaxyRadarModel.js";
import {
  adaptStarCoreInteriorTruth,
  beginStarCoreInteriorUi,
  beginStarCorePolicyLockUi,
  closeStarCoreInteriorUi,
  createInitialStarCoreInteriorUiState,
  resolveStarCoreInteriorEntryComplete,
  resolveStarCoreInteriorModel,
  resolveStarCorePolicyLockUiFailure,
  resolveStarCorePolicyLockUiSuccess,
} from "./starCoreInteriorAdapter.js";
import {
  beginStarCoreInteriorScreenEntry,
  beginStarCoreInteriorScreenReturn,
  closeStarCoreInteriorScreen,
  createInitialStarCoreInteriorScreenState,
  resolveStarCoreInteriorScreenEntryComplete,
  resolveStarCoreInteriorScreenModel,
  STAR_CORE_INTERIOR_ENTRY_DURATION_MS,
  STAR_CORE_INTERIOR_LOCK_TRANSITION_DURATION_MS,
  STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS,
  STAR_CORE_INTERIOR_RETURN_DURATION_MS,
} from "./starCoreInteriorScreenModel.js";
import { adaptStarCoreTruth } from "./starCoreTruthAdapter.js";
import { resolveStarCoreSpatialLoadingModel, resolveStarCoreSpatialStateModel } from "./starCoreSpatialStateModel.js";
import UniverseCanvas from "./UniverseCanvas.jsx";

function createSeededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(count, seed, { minSize, maxSize, minOpacity, maxOpacity }) {
  const rand = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    id: `${seed}-${index}`,
    top: `${(rand() * 100).toFixed(3)}%`,
    left: `${(rand() * 100).toFixed(3)}%`,
    size: `${(minSize + rand() * (maxSize - minSize)).toFixed(2)}px`,
    opacity: Number((minOpacity + rand() * (maxOpacity - minOpacity)).toFixed(3)),
  }));
}

function createLoadingModel(defaultGalaxy, connectivity) {
  return resolveStarCoreSpatialLoadingModel({
    galaxyName: defaultGalaxy?.name || "Galaxie",
    isOnline: connectivity?.isOnline !== false,
  });
}

function readItemsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray(payload.items)) return payload.items;
  return [];
}

function readReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return Boolean(window.matchMedia("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

function createIdempotencyKey(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function normalizeCommandPreview(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const tasks = Array.isArray(source.atomic_tasks)
    ? source.atomic_tasks
    : Array.isArray(source.tasks)
      ? source.tasks
      : [];
  const becauseChain = Array.isArray(source.because_chain)
    ? source.because_chain
    : Array.isArray(source.becauseChain)
      ? source.becauseChain
      : [];
  const expectedEvents = Array.isArray(source.expected_events)
    ? source.expected_events
    : Array.isArray(source.expectedEvents)
      ? source.expectedEvents
      : [];
  const riskFlags = Array.isArray(source.risk_flags)
    ? source.risk_flags
    : Array.isArray(source.riskFlags)
      ? source.riskFlags
      : [];
  return {
    tasks,
    becauseChain: becauseChain.map((item) => String(item || "")).filter(Boolean),
    expectedEvents: expectedEvents.map((item) => String(item || "")).filter(Boolean),
    riskFlags: riskFlags.map((item) => String(item || "")).filter(Boolean),
    resolvedCommand: String(source.resolved_command || source.resolvedCommand || "").trim(),
    payload: source,
  };
}

function findPlanetObjectIdForCivilization(civilization, spaceObjects = []) {
  const tableId = String(civilization?.table_id || "").trim();
  if (!tableId) return "";
  const planetObject = (Array.isArray(spaceObjects) ? spaceObjects : []).find((item) => item.id === tableId);
  return planetObject?.id || "";
}

async function loadWorkspaceTruth({ defaultGalaxy = null, connectivity = null }) {
  const galaxyId = String(defaultGalaxy?.id || "").trim();
  if (!galaxyId) {
    return {
      status: "data_unavailable",
      truth: null,
      interiorTruth: null,
      tableRows: [],
      snapshotProjection: { civilizations: [], bonds: [] },
      error: "Chybí aktivní galaxie pro načtení Star Core.",
    };
  }

  const [policyResponse, physicsResponse, interiorResponse, tablesResponse, snapshotResponse] = await Promise.all([
    apiFetch(buildStarCorePolicyUrl(API_BASE, galaxyId)),
    apiFetch(buildStarCorePhysicsProfileUrl(API_BASE, galaxyId)),
    apiFetch(buildStarCoreInteriorUrl(API_BASE, galaxyId)),
    apiFetch(buildTablesUrl(API_BASE, null, galaxyId, null)),
    apiFetch(buildSnapshotUrl(API_BASE, null, galaxyId, null)).catch(() => null),
  ]);

  if (!policyResponse.ok) {
    throw await apiErrorFromResponse(policyResponse, "Nepodařilo se načíst policy Srdce hvězdy.");
  }
  if (!physicsResponse.ok) {
    throw await apiErrorFromResponse(physicsResponse, "Nepodařilo se načíst fyziku Srdce hvězdy.");
  }
  if (!interiorResponse.ok) {
    throw await apiErrorFromResponse(interiorResponse, "Nepodařilo se načíst interiér Srdce hvězdy.");
  }

  const [policyPayload, physicsProfilePayload, interiorPayload] = await Promise.all([
    policyResponse.json(),
    physicsResponse.json(),
    interiorResponse.json(),
  ]);
  const [runtimePayload, pulsePayload, domainMetricsPayload, planetPhysicsPayload] = await Promise.all([
    apiFetch(buildStarCoreRuntimeUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
    apiFetch(buildStarCorePulseUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
    apiFetch(buildStarCoreDomainMetricsUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
    apiFetch(buildStarCorePlanetPhysicsUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
  ]);

  let tableRows = [];
  if (tablesResponse.ok) {
    tableRows = readItemsPayload(await tablesResponse.json().catch(() => []));
  } else {
    const fallbackPlanetsResponse = await apiFetch(buildGalaxyPlanetsUrl(API_BASE, galaxyId));
    if (fallbackPlanetsResponse.ok) {
      tableRows = readItemsPayload(await fallbackPlanetsResponse.json().catch(() => []));
    }
  }
  let snapshotProjection = { civilizations: [], bonds: [] };
  if (snapshotResponse?.ok) {
    snapshotProjection = normalizeSnapshot(await snapshotResponse.json().catch(() => null));
  }

  const truth = adaptStarCoreTruth({
    galaxy: defaultGalaxy,
    connectivity,
    policyPayload,
    physicsProfilePayload,
    runtimePayload,
    pulsePayload,
    domainMetricsPayload,
  });

  if (!truth) {
    throw new Error("Star Core truth adapter nevrátil použitelná data.");
  }

  return {
    status: truth.policy.lock_status === "locked" ? "star_core_locked_ready" : "star_core_unlocked",
    truth,
    interiorTruth: adaptStarCoreInteriorTruth(interiorPayload, {
      runtimePayload,
      pulsePayload,
      domainMetricsPayload,
      planetPhysicsPayload,
      policyPayload,
      physicsProfilePayload,
    }),
    tableRows,
    planetPhysicsPayload,
    snapshotProjection,
    error: "",
  };
}

export default function UniverseWorkspace({ defaultGalaxy = null, connectivity = null, onLogout = async () => {} }) {
  const starLayers = useMemo(
    () => ({
      far: buildStars(140, 20260312, { minSize: 1, maxSize: 2.2, minOpacity: 0.2, maxOpacity: 0.55 }),
      mid: buildStars(90, 20260313, { minSize: 1.4, maxSize: 3.1, minOpacity: 0.3, maxOpacity: 0.8 }),
      near: buildStars(28, 20260314, { minSize: 2.6, maxSize: 5.2, minOpacity: 0.45, maxOpacity: 0.95 }),
    }),
    []
  );
  const [fetchState, setFetchState] = useState({
    status: defaultGalaxy?.id ? "loading" : "data_unavailable",
    truth: null,
    interiorTruth: null,
    tableRows: [],
    planetPhysicsPayload: null,
    snapshotProjection: { civilizations: [], bonds: [] },
    error: "",
  });
  const [navigationState, setNavigationState] = useState(createInitialGalaxyNavigationState);
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [interiorUiState, setInteriorUiState] = useState(createInitialStarCoreInteriorUiState);
  const [interiorScreenState, setInteriorScreenState] = useState(createInitialStarCoreInteriorScreenState);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotionPreference);
  const [commandState, setCommandState] = useState({
    isOpen: false,
    command: "",
    preview: null,
    busy: false,
    error: "",
    feedback: "",
  });
  const [gridState, setGridState] = useState({
    isOpen: false,
    query: "",
    selectedCivilizationId: "",
  });
  const isCommandEnabled = fetchState.truth?.policy?.lock_status === "locked";

  useEffect(() => {
    let active = true;

    async function loadStarCoreTruth() {
      if (active) {
        setFetchState((current) => ({
          status: "loading",
          truth: current.truth,
          interiorTruth: current.interiorTruth,
          tableRows: current.tableRows,
          planetPhysicsPayload: current.planetPhysicsPayload,
          snapshotProjection: current.snapshotProjection,
          error: "",
        }));
      }

      try {
        const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
        if (!active) return;
        setFetchState(nextState);
        setInteriorUiState(closeStarCoreInteriorUi());
        setInteriorScreenState(closeStarCoreInteriorScreen());
      } catch (error) {
        if (!active) return;
        setFetchState({
          status: "data_unavailable",
          truth: null,
          interiorTruth: null,
          tableRows: [],
          planetPhysicsPayload: null,
          snapshotProjection: { civilizations: [], bonds: [] },
          error: String(error?.message || "Načtení Star Core selhalo."),
        });
      }
    }

    void loadStarCoreTruth();
    return () => {
      active = false;
    };
  }, [connectivity, defaultGalaxy]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(Boolean(media.matches));
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    if (typeof media.addListener === "function") {
      media.addListener(sync);
      return () => media.removeListener(sync);
    }
    return undefined;
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (interiorScreenState.stage !== "closed") {
        if (interiorUiState.transientPhase === "policy_lock_transition") return;
        setInteriorScreenState(beginStarCoreInteriorScreenReturn());
        return;
      }
      setNavigationState((current) => resolveGalaxyEscape(current));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [interiorScreenState.stage, interiorUiState.transientPhase]);

  useEffect(() => {
    function isTypingTarget(target) {
      const tagName = String(target?.tagName || "").toLowerCase();
      return tagName === "input" || tagName === "textarea" || Boolean(target?.isContentEditable);
    }

    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && String(event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        setCommandState((current) => {
          if (!isCommandEnabled) {
            return {
              ...current,
              isOpen: true,
              error: "Command Bar se odemyka az po uzamceni Star Core.",
            };
          }
          return {
            ...current,
            isOpen: !current.isOpen,
            error: "",
          };
        });
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (String(event.key || "").toLowerCase() !== "g") return;
      event.preventDefault();
      setGridState((current) => ({ ...current, isOpen: !current.isOpen }));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandEnabled]);

  const model = useMemo(() => {
    if (fetchState.status === "loading") {
      return createLoadingModel(defaultGalaxy, connectivity);
    }
    if (!fetchState.truth) {
      return resolveStarCoreSpatialStateModel(null, { error: fetchState.error });
    }
    return resolveStarCoreSpatialStateModel(fetchState.truth, { error: fetchState.error });
  }, [connectivity, defaultGalaxy, fetchState.error, fetchState.status, fetchState.truth]);

  const spaceObjects = useMemo(
    () =>
      buildGalaxySpaceObjects({
        starModel: model,
        tableRows: fetchState.tableRows,
        planetPhysicsPayload: fetchState.planetPhysicsPayload,
      }),
    [fetchState.planetPhysicsPayload, fetchState.tableRows, model]
  );
  const navigationModel = useMemo(
    () => resolveGalaxyNavigationModel({ navigationState, spaceObjects }),
    [navigationState, spaceObjects]
  );
  const interiorModel = useMemo(
    () => resolveStarCoreInteriorModel({ interiorTruth: fetchState.interiorTruth, uiState: interiorUiState }),
    [fetchState.interiorTruth, interiorUiState]
  );
  const interiorScreenModel = useMemo(
    () => resolveStarCoreInteriorScreenModel({ screenState: interiorScreenState, reducedMotion }),
    [interiorScreenState, reducedMotion]
  );
  const selectedConstitution = interiorModel.selectedConstitution;
  const lockTransitionModel = useMemo(() => {
    if (!interiorModel.isOpen) return null;
    if (interiorModel.isFirstOrbitReady) {
      return {
        title: interiorModel.explainability.headline || "První orbita je připravená",
        hint: interiorModel.explainability.body || "",
        actionLabel: "Vrátit se do prostoru",
        disabled: false,
      };
    }
    if (interiorModel.isLockPending) {
      return {
        title: "Uzamykám Srdce hvězdy",
        hint: "Governance prstenec se právě fyzicky uzavírá.",
        actionLabel: "Uzamykám Srdce hvězdy",
        disabled: true,
      };
    }
    if (interiorModel.canConfirmLock) {
      return {
        title: interiorModel.explainability.headline || "Ústava je připravena k uzamčení",
        hint: interiorModel.explainability.body || "",
        actionLabel: interiorModel.nextAction.label || "Potvrdit ústavu a uzamknout politiky",
        disabled: false,
      };
    }
    return null;
  }, [interiorModel]);
  const radarModel = useMemo(
    () =>
      resolveGalaxyRadarModel({
        galaxyName: model.galaxyName,
        spaceObjects,
        selectedObjectId: navigationModel.selectedObjectId,
        headingDegrees,
      }),
    [headingDegrees, model.galaxyName, navigationModel.selectedObjectId, spaceObjects]
  );
  async function refreshWorkspaceData({ preserveInterior = true } = {}) {
    const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
    setFetchState(nextState);
    if (!preserveInterior) {
      setInteriorUiState(closeStarCoreInteriorUi());
      setInteriorScreenState(closeStarCoreInteriorScreen());
    }
    return nextState;
  }

  useEffect(() => {
    if (interiorUiState.transientPhase !== "star_core_interior_entry") return undefined;
    const entryDurationMs = reducedMotion
      ? STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS
      : STAR_CORE_INTERIOR_ENTRY_DURATION_MS;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
          if (!active) return;
          setFetchState(nextState);
        } catch (error) {
          if (!active) return;
          setFetchState((current) => ({
            ...current,
            error: String(error?.message || "Nepodařilo se obnovit interiér Srdce hvězdy po vstupu."),
          }));
        }
        if (!active) return;
        setInteriorUiState((current) => resolveStarCoreInteriorEntryComplete(current));
        setInteriorScreenState((current) => resolveStarCoreInteriorScreenEntryComplete(current));
      })();
    }, entryDurationMs);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [connectivity, defaultGalaxy, interiorUiState.transientPhase, reducedMotion]);

  useEffect(() => {
    if (fetchState.interiorTruth?.interiorPhase !== "policy_lock_transition" || interiorUiState.isLockPending) {
      return undefined;
    }
    const transitionDurationMs = reducedMotion
      ? STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS
      : STAR_CORE_INTERIOR_LOCK_TRANSITION_DURATION_MS;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
          if (!active) return;
          setFetchState(nextState);
        } catch (error) {
          if (!active) return;
          setFetchState((current) => ({
            ...current,
            error: String(error?.message || "Nepodařilo se obnovit stav po lock transition."),
          }));
        }
      })();
    }, transitionDurationMs);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    connectivity,
    defaultGalaxy,
    fetchState.interiorTruth?.interiorPhase,
    interiorUiState.isLockPending,
    reducedMotion,
  ]);

  useEffect(() => {
    if (interiorScreenState.stage !== "returning") return undefined;
    const returnDurationMs = reducedMotion
      ? STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS
      : STAR_CORE_INTERIOR_RETURN_DURATION_MS;
    const timeoutId = window.setTimeout(() => {
      setInteriorScreenState(closeStarCoreInteriorScreen());
      setInteriorUiState(closeStarCoreInteriorUi());
      setNavigationState((current) => selectGalaxyObject(current, "star-core"));
    }, returnDurationMs);
    return () => window.clearTimeout(timeoutId);
  }, [interiorScreenState.stage, reducedMotion]);

  useEffect(() => {
    if (navigationModel.approachTargetId === "star-core") return;
    if (interiorUiState.isOpen || interiorScreenState.stage !== "closed") {
      setInteriorUiState(closeStarCoreInteriorUi());
      setInteriorScreenState(closeStarCoreInteriorScreen());
    }
  }, [interiorScreenState.stage, interiorUiState.isOpen, navigationModel.approachTargetId]);

  useEffect(() => {
    if (
      navigationModel.mode !== navigationState.mode ||
      navigationModel.selectedObjectId !== navigationState.selectedObjectId ||
      navigationModel.approachTargetId !== navigationState.approachTargetId
    ) {
      setNavigationState({
        mode: navigationModel.mode,
        selectedObjectId: navigationModel.selectedObjectId,
        approachTargetId: navigationModel.approachTargetId,
      });
    }
  }, [
    navigationModel.approachTargetId,
    navigationModel.mode,
    navigationModel.selectedObjectId,
    navigationState.approachTargetId,
    navigationState.mode,
    navigationState.selectedObjectId,
  ]);

  async function handleConfirmPolicyLock() {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const payload =
      interiorModel.sourceTruth.profileKey && interiorModel.sourceTruth.physicalProfileKey
        ? {
            profile_key: interiorModel.sourceTruth.profileKey,
            lock_after_apply: true,
            physical_profile_key: interiorModel.sourceTruth.physicalProfileKey,
            physical_profile_version: interiorModel.sourceTruth.physicalProfileVersion,
          }
        : null;
    if (!galaxyId || !payload) return;

    setInteriorUiState((current) => beginStarCorePolicyLockUi(current));

    try {
      const response = await apiFetch(buildStarCorePolicyLockUrl(API_BASE, galaxyId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          idempotency_key: createIdempotencyKey("star-core-lock"),
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Nepodařilo se uzamknout politiky Srdce hvězdy.");
      }

      await refreshWorkspaceData();
      setInteriorUiState((current) => resolveStarCorePolicyLockUiSuccess(current));
    } catch (error) {
      setInteriorUiState((current) =>
        resolveStarCorePolicyLockUiFailure(current, String(error?.message || "Uzamčení politik se nepodařilo."))
      );
    }
  }

  async function handleSelectConstitution(constitutionId) {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const normalizedConstitutionId = String(constitutionId || "")
      .trim()
      .toLowerCase();
    if (!galaxyId || !normalizedConstitutionId) return;

    try {
      const response = await apiFetch(buildStarCoreInteriorConstitutionSelectUrl(API_BASE, galaxyId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          constitution_id: normalizedConstitutionId,
          idempotency_key: createIdempotencyKey("star-core-select"),
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Nepodařilo se vybrat ústavu Srdce hvězdy.");
      }
      const interiorPayload = await response.json();
      setFetchState((current) => ({
        ...current,
        interiorTruth: adaptStarCoreInteriorTruth(interiorPayload, {
          fallbackTelemetry: current.interiorTruth?.telemetry,
          policyPayload: current.truth?.policy,
          physicsProfilePayload: current.truth?.physicsProfile,
        }),
      }));
      setInteriorUiState((current) => ({
        ...current,
        isOpen: true,
        transientPhase: "",
        isLockPending: false,
        errorMessage: "",
      }));
    } catch (error) {
      setInteriorUiState((current) => ({
        ...current,
        isOpen: true,
        errorMessage: String(error?.message || "Výběr ústavy se nepodařilo uložit."),
      }));
    }
  }

  async function handlePreviewCommand() {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const command = String(commandState.command || "").trim();
    if (!galaxyId || !command) return;

    setCommandState((current) => ({
      ...current,
      busy: true,
      error: "",
      feedback: "",
      preview: null,
    }));

    try {
      const response = await apiFetch(buildParserPlanUrl(API_BASE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: command,
          parser_version: "v2",
          galaxy_id: galaxyId,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Parser preview selhal.");
      }
      const payload = await response.json().catch(() => null);
      const preview = normalizeCommandPreview(payload);
      setCommandState((current) => ({
        ...current,
        busy: false,
        preview,
        feedback: preview.tasks.length
          ? `Preview pripraven. Parser navrhl ${preview.tasks.length} task(s).`
          : "Preview se vratil, ale neobsahuje atomicke tasky.",
      }));
    } catch (error) {
      setCommandState((current) => ({
        ...current,
        busy: false,
        error: String(error?.message || "Preview se nepodarilo vytvorit."),
      }));
    }
  }

  async function handleCommitCommand() {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const tasks = Array.isArray(commandState.preview?.tasks) ? commandState.preview.tasks : [];
    if (!galaxyId || !tasks.length) {
      setCommandState((current) => ({
        ...current,
        error: "Commit neni mozny bez preview s atomickymi tasky.",
      }));
      return;
    }

    setCommandState((current) => ({
      ...current,
      busy: true,
      error: "",
      feedback: "Commituji zmenu reality a obnovuji canonical truth...",
    }));

    try {
      const response = await apiFetch(buildTaskExecuteBatchUrl(API_BASE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildTaskBatchPayload({
            tasks,
            mode: "commit",
            galaxyId,
            idempotencyKey: createIdempotencyKey("command-commit"),
          })
        ),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Commit batch selhal.");
      }
      await refreshWorkspaceData();
      setGridState((current) => ({ ...current, isOpen: true }));
      setCommandState((current) => ({
        ...current,
        busy: false,
        feedback: "Konvergence potvrzena. Workspace byl obnoven z canonical read modelu.",
      }));
    } catch (error) {
      setCommandState((current) => ({
        ...current,
        busy: false,
        error: String(error?.message || "Commit se nepodarilo dokoncit."),
      }));
    }
  }

  function handleSelectCivilization(row) {
    const civilizationId = String(row?.id || "").trim();
    setGridState((current) => ({
      ...current,
      selectedCivilizationId: civilizationId,
    }));
    const nextObjectId = findPlanetObjectIdForCivilization(row, spaceObjects);
    if (nextObjectId) {
      setNavigationState((current) => selectGalaxyObject(current, nextObjectId));
    }
  }

  async function handleOpenInterior(objectId) {
    if (objectId === "star-core" && fetchState.status !== "loading" && fetchState.status !== "data_unavailable") {
      setNavigationState((current) => beginGalaxyApproach(current, objectId));
      const galaxyId = String(defaultGalaxy?.id || "").trim();
      if (!galaxyId) return;
      try {
        const isLocked = fetchState.truth?.policy?.lock_status === "locked";
        const response = isLocked
          ? await apiFetch(buildStarCoreInteriorUrl(API_BASE, galaxyId))
          : await apiFetch(buildStarCoreInteriorEntryStartUrl(API_BASE, galaxyId), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                idempotency_key: createIdempotencyKey("star-core-entry"),
              }),
            });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, "Nepodařilo se otevřít vstup do Srdce hvězdy.");
        }
        const interiorPayload = await response.json();
        setFetchState((current) => ({
          ...current,
          interiorTruth: adaptStarCoreInteriorTruth(interiorPayload, {
            fallbackTelemetry: current.interiorTruth?.telemetry,
            policyPayload: current.truth?.policy,
            physicsProfilePayload: current.truth?.physicsProfile,
          }),
          error: "",
        }));
        setInteriorUiState(
          isLocked ? resolveStarCoreInteriorEntryComplete(beginStarCoreInteriorUi()) : beginStarCoreInteriorUi()
        );
        setInteriorScreenState(isLocked ? { stage: "active" } : beginStarCoreInteriorScreenEntry());
      } catch (error) {
        setFetchState((current) => ({
          ...current,
          error: String(error?.message || "Otevření interiéru Srdce hvězdy selhalo."),
        }));
      }
      return;
    }
    setNavigationState((current) => beginGalaxyApproach(current, objectId));
  }

  function handleReturnToSpace() {
    if (interiorUiState.transientPhase === "policy_lock_transition") return;
    setInteriorScreenState(beginStarCoreInteriorScreenReturn());
  }

  return (
    <main
      data-testid="workspace-reset-root"
      aria-label="Dataverse workspace"
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 48%, rgba(78, 46, 14, 0.26), transparent 18%), radial-gradient(circle at 50% 50%, rgba(245, 160, 44, 0.08), transparent 28%), radial-gradient(circle at 14% 18%, rgba(33, 82, 132, 0.18), transparent 26%), linear-gradient(180deg, #02050c 0%, #010309 100%)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(255, 180, 80, 0.11) 0, rgba(255, 180, 80, 0.04) 12%, transparent 30%)",
          filter: "blur(18px)",
          transform: "scale(1.2)",
        }}
      />

      {Object.values(starLayers)
        .flat()
        .map((star) => (
          <span
            key={star.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              borderRadius: "999px",
              background: "#f6fbff",
              opacity: star.opacity,
              boxShadow: "0 0 10px rgba(154, 214, 255, 0.26)",
            }}
          />
        ))}

      <UniverseCanvas
        model={model}
        spaceObjects={spaceObjects}
        navigationModel={navigationModel}
        onSelectObject={(objectId) => setNavigationState((current) => selectGalaxyObject(current, objectId))}
        onApproachObject={handleOpenInterior}
        onHeadingChange={setHeadingDegrees}
        onClearFocus={() => setNavigationState(clearGalaxySelection())}
      />
      {!interiorScreenModel.isVisible ? (
        <GalaxySelectionHud model={model} navigationModel={navigationModel} radarModel={radarModel} />
      ) : null}
      <OperatorDock
        galaxyName={defaultGalaxy?.name || "Galaxie"}
        isOnline={connectivity?.isOnline !== false}
        isCommandEnabled={isCommandEnabled}
        isGridOpen={gridState.isOpen}
        isCommandOpen={commandState.isOpen}
        onToggleCommandBar={() =>
          setCommandState((current) =>
            isCommandEnabled
              ? { ...current, isOpen: !current.isOpen, error: "" }
              : { ...current, isOpen: true, error: "Command Bar se odemyka az po uzamceni Star Core." }
          )
        }
        onToggleGrid={() => setGridState((current) => ({ ...current, isOpen: !current.isOpen }))}
        onLogout={onLogout}
      />
      <WorkspaceCommandBar
        isOpen={commandState.isOpen}
        command={commandState.command}
        preview={commandState.preview}
        busy={commandState.busy}
        error={commandState.error}
        feedback={commandState.feedback}
        onChange={(nextCommand) =>
          setCommandState((current) => ({
            ...current,
            command: nextCommand,
            error: "",
          }))
        }
        onClose={() =>
          setCommandState((current) => ({
            ...current,
            isOpen: false,
          }))
        }
        onPreview={handlePreviewCommand}
        onCommit={handleCommitCommand}
      />
      <ReadGridOverlay
        isOpen={gridState.isOpen}
        civilizations={fetchState.snapshotProjection?.civilizations || []}
        bonds={fetchState.snapshotProjection?.bonds || []}
        query={gridState.query}
        selectedCivilizationId={gridState.selectedCivilizationId}
        onClose={() => setGridState((current) => ({ ...current, isOpen: false }))}
        onQueryChange={(nextQuery) => setGridState((current) => ({ ...current, query: nextQuery }))}
        onSelectCivilization={handleSelectCivilization}
      />
      <StarCoreInteriorScreen
        screenModel={interiorScreenModel}
        interiorModel={interiorModel}
        selectedConstitution={selectedConstitution}
        lockTransitionModel={lockTransitionModel}
        onSelectConstitution={handleSelectConstitution}
        onConfirmPolicyLock={handleConfirmPolicyLock}
        onReturnToSpace={handleReturnToSpace}
      />
    </main>
  );
}
