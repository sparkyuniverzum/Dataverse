import { useEffect, useMemo, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildSnapshotUrl,
  buildGalaxyPlanetsUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCoreInteriorEntryStartUrl,
  buildStarCoreInteriorUrl,
  buildStarCorePlanetPhysicsUrl,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildTablesUrl,
  normalizeSnapshot,
} from "../../lib/dataverseApi";
import GalaxySpaceScreen from "./GalaxySpaceScreen.jsx";
import StarCoreInteriorScreen from "./StarCoreInteriorScreen.jsx";
import {
  beginGalaxyApproach,
  clearGalaxySelection,
  createInitialGalaxyNavigationState,
  resolveGalaxyEscape,
  resolveGalaxyNavigationModel,
  selectGalaxyObject,
} from "./galaxyNavigationStateModel.js";
import { buildGalaxySpaceObjects, resolveGalaxyRadarModel } from "./galaxyRadarModel.js";
import { adaptStarCoreInteriorTruth } from "./starCoreInteriorAdapter.js";
import {
  closeStarCoreInteriorScreen,
  createInitialStarCoreInteriorScreenState,
  openStarCoreInteriorScreen,
  resolveStarCoreInteriorScreenModel,
} from "./starCoreInteriorScreenModel.js";
import { adaptStarCoreTruth } from "./starCoreTruthAdapter.js";
import { resolveStarCoreSpatialLoadingModel, resolveStarCoreSpatialStateModel } from "./starCoreSpatialStateModel.js";

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

function createIdempotencyKey(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
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
  const [interiorScreenState, setInteriorScreenState] = useState(createInitialStarCoreInteriorScreenState);
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
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (interiorScreenState.stage !== "closed") {
        if (fetchState.interiorTruth?.interiorPhase === "policy_lock_transition") return;
        setInteriorScreenState(closeStarCoreInteriorScreen());
        setNavigationState((current) => selectGalaxyObject(current, "star-core"));
        return;
      }
      setNavigationState((current) => resolveGalaxyEscape(current));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fetchState.interiorTruth?.interiorPhase, interiorScreenState.stage]);

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
  const interiorScreenModel = useMemo(
    () =>
      resolveStarCoreInteriorScreenModel({
        screenState: interiorScreenState,
        interiorTruth: fetchState.interiorTruth,
        errorMessage: fetchState.error,
      }),
    [fetchState.error, fetchState.interiorTruth, interiorScreenState]
  );
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

  async function refreshWorkspaceData() {
    const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
    setFetchState(nextState);
    return nextState;
  }

  useEffect(() => {
    if (fetchState.interiorTruth?.interiorPhase !== "policy_lock_transition") return undefined;
    let active = true;
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
    return () => {
      active = false;
    };
  }, [connectivity, defaultGalaxy, fetchState.interiorTruth?.interiorPhase]);

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

  async function handleOpenInterior(objectId) {
    if (objectId === "star-core" && fetchState.status !== "loading" && fetchState.status !== "data_unavailable") {
      setNavigationState((current) => selectGalaxyObject(current, objectId));
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
        setInteriorScreenState(openStarCoreInteriorScreen());
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

  if (interiorScreenModel.isVisible) {
    return (
      <main
        data-testid="workspace-root"
        style={{
          position: "relative",
          minHeight: "100vh",
          width: "100%",
          overflow: "hidden",
          background: "#020408",
        }}
      >
        <StarCoreInteriorScreen screenModel={interiorScreenModel} />
      </main>
    );
  }

  return (
    <GalaxySpaceScreen
      defaultGalaxy={defaultGalaxy}
      connectivity={connectivity}
      model={model}
      starLayers={starLayers}
      spaceObjects={spaceObjects}
      navigationModel={navigationModel}
      radarModel={radarModel}
      snapshotProjection={fetchState.snapshotProjection}
      isCommandEnabled={isCommandEnabled}
      onSelectObject={(objectId) => setNavigationState((current) => selectGalaxyObject(current, objectId))}
      onApproachObject={handleOpenInterior}
      onHeadingChange={setHeadingDegrees}
      onClearFocus={() => setNavigationState(clearGalaxySelection())}
      onFocusCivilization={(objectId) => setNavigationState((current) => selectGalaxyObject(current, objectId))}
      onRefreshWorkspace={refreshWorkspaceData}
      onLogout={onLogout}
    />
  );
}
