import { useEffect, useMemo, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildGalaxyPlanetsUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePolicyLockUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildTablesUrl,
} from "../../lib/dataverseApi";
import GalaxySelectionHud from "./GalaxySelectionHud.jsx";
import {
  beginGalaxyApproach,
  clearGalaxySelection,
  createInitialGalaxyNavigationState,
  resolveGalaxyEscape,
  resolveGalaxyNavigationModel,
  selectGalaxyObject,
} from "./galaxyNavigationStateModel.js";
import { buildGalaxySpaceObjects, resolveGalaxyRadarModel } from "./galaxyRadarModel.js";
import { buildStarCorePolicyLockPayload, findStarCoreConstitutionOption } from "./starCoreConstitutionModel.js";
import {
  advanceStarCoreInterior,
  beginStarCoreInterior,
  beginStarCorePolicyLock,
  closeStarCoreInterior,
  createInitialStarCoreInteriorState,
  resolveStarCoreInteriorEscape,
  resolveStarCoreInteriorModel,
  resolveStarCorePolicyLockFailure,
  resolveStarCorePolicyLockSuccess,
  selectStarCoreConstitution,
} from "./starCoreInteriorStateModel.js";
import { resolveStarCoreLockTransitionModel } from "./starCoreLockTransitionModel.js";
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

async function loadWorkspaceTruth({ defaultGalaxy = null, connectivity = null }) {
  const galaxyId = String(defaultGalaxy?.id || "").trim();
  if (!galaxyId) {
    return {
      status: "data_unavailable",
      truth: null,
      tableRows: [],
      error: "Chybí aktivní galaxie pro načtení Star Core.",
    };
  }

  const [policyResponse, physicsResponse, tablesResponse] = await Promise.all([
    apiFetch(buildStarCorePolicyUrl(API_BASE, galaxyId)),
    apiFetch(buildStarCorePhysicsProfileUrl(API_BASE, galaxyId)),
    apiFetch(buildTablesUrl(API_BASE, null, galaxyId, null)),
  ]);

  if (!policyResponse.ok) {
    throw await apiErrorFromResponse(policyResponse, "Nepodařilo se načíst policy Srdce hvězdy.");
  }
  if (!physicsResponse.ok) {
    throw await apiErrorFromResponse(physicsResponse, "Nepodařilo se načíst fyziku Srdce hvězdy.");
  }

  const [policyPayload, physicsProfilePayload] = await Promise.all([policyResponse.json(), physicsResponse.json()]);
  const [runtimePayload, pulsePayload, domainMetricsPayload] = await Promise.all([
    apiFetch(buildStarCoreRuntimeUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
    apiFetch(buildStarCorePulseUrl(API_BASE, galaxyId))
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null),
    apiFetch(buildStarCoreDomainMetricsUrl(API_BASE, galaxyId))
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
    tableRows,
    error: "",
  };
}

export default function UniverseWorkspace({ defaultGalaxy = null, connectivity = null }) {
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
    tableRows: [],
    error: "",
  });
  const [navigationState, setNavigationState] = useState(createInitialGalaxyNavigationState);
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [interiorState, setInteriorState] = useState(createInitialStarCoreInteriorState);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    let active = true;

    async function loadStarCoreTruth() {
      if (active) {
        setFetchState((current) => ({
          status: "loading",
          truth: current.truth,
          tableRows: current.tableRows,
          error: "",
        }));
      }

      try {
        const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
        if (!active) return;
        setFetchState(nextState);
        setInteriorState(closeStarCoreInterior());
      } catch (error) {
        if (!active) return;
        setFetchState({
          status: "data_unavailable",
          truth: null,
          tableRows: [],
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
      if (interiorState.phase !== "closed") {
        setInteriorState((current) => resolveStarCoreInteriorEscape(current));
        return;
      }
      setNavigationState((current) => resolveGalaxyEscape(current));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [interiorState.phase]);

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
    () => buildGalaxySpaceObjects({ starModel: model, tableRows: fetchState.tableRows }),
    [fetchState.tableRows, model]
  );
  const navigationModel = useMemo(
    () => resolveGalaxyNavigationModel({ navigationState, spaceObjects }),
    [navigationState, spaceObjects]
  );
  const interiorModel = useMemo(() => resolveStarCoreInteriorModel(interiorState), [interiorState]);
  const selectedConstitution = useMemo(
    () => findStarCoreConstitutionOption(interiorModel.selectedConstitutionId),
    [interiorModel.selectedConstitutionId]
  );
  const lockTransitionModel = useMemo(
    () => resolveStarCoreLockTransitionModel({ interiorModel, selectedConstitution }),
    [interiorModel, selectedConstitution]
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

  useEffect(() => {
    if (interiorState.phase !== "star_core_interior_entry") return undefined;
    const timeoutId = window.setTimeout(
      () => {
        setInteriorState((current) => advanceStarCoreInterior(current));
      },
      reducedMotion ? 40 : 900
    );
    return () => window.clearTimeout(timeoutId);
  }, [interiorState.phase, reducedMotion]);

  useEffect(() => {
    if (navigationModel.approachTargetId === "star-core") return;
    if (interiorState.phase !== "closed") {
      setInteriorState(closeStarCoreInterior());
    }
  }, [interiorState.phase, navigationModel.approachTargetId]);

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
    const payload = buildStarCorePolicyLockPayload(interiorModel.selectedConstitutionId);
    if (!galaxyId || !payload) return;

    setInteriorState((current) => beginStarCorePolicyLock(current));

    try {
      const response = await apiFetch(buildStarCorePolicyLockUrl(API_BASE, galaxyId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          idempotency_key:
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `star-core-lock-${Date.now()}`,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Nepodařilo se uzamknout politiky Srdce hvězdy.");
      }

      const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
      setFetchState(nextState);
      setInteriorState((current) => resolveStarCorePolicyLockSuccess(current));
      setNavigationState((current) => beginGalaxyApproach(current, "star-core"));
    } catch (error) {
      setInteriorState((current) =>
        resolveStarCorePolicyLockFailure(current, String(error?.message || "Uzamčení politik se nepodařilo."))
      );
    }
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
        interiorModel={interiorModel}
        selectedConstitution={selectedConstitution}
        onSelectObject={(objectId) => setNavigationState((current) => selectGalaxyObject(current, objectId))}
        onApproachObject={(objectId) => {
          if (
            objectId === "star-core" &&
            navigationModel.mode === "approach_active" &&
            model.state === "star_core_unlocked"
          ) {
            setInteriorState((current) => beginStarCoreInterior(current, { reducedMotion }));
            return;
          }
          setNavigationState((current) => beginGalaxyApproach(current, objectId));
        }}
        onSelectConstitution={(constitutionId) =>
          setInteriorState((current) => selectStarCoreConstitution(current, constitutionId))
        }
        onHeadingChange={setHeadingDegrees}
        onClearFocus={() => setNavigationState(clearGalaxySelection())}
      />
      <GalaxySelectionHud
        model={model}
        navigationModel={navigationModel}
        radarModel={radarModel}
        interiorModel={interiorModel}
        selectedConstitution={selectedConstitution}
        lockTransitionModel={lockTransitionModel}
        onConfirmPolicyLock={handleConfirmPolicyLock}
        onReturnToSpace={() => setInteriorState(closeStarCoreInterior())}
      />
    </main>
  );
}
