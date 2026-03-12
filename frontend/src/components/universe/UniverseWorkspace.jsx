import { useEffect, useMemo, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildGalaxyPlanetsUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCoreInteriorConstitutionSelectUrl,
  buildStarCoreInteriorUrl,
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
      interiorTruth: null,
      tableRows: [],
      error: "Chybí aktivní galaxie pro načtení Star Core.",
    };
  }

  const [policyResponse, physicsResponse, interiorResponse, tablesResponse] = await Promise.all([
    apiFetch(buildStarCorePolicyUrl(API_BASE, galaxyId)),
    apiFetch(buildStarCorePhysicsProfileUrl(API_BASE, galaxyId)),
    apiFetch(buildStarCoreInteriorUrl(API_BASE, galaxyId)),
    apiFetch(buildTablesUrl(API_BASE, null, galaxyId, null)),
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
    interiorTruth: adaptStarCoreInteriorTruth(interiorPayload),
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
    interiorTruth: null,
    tableRows: [],
    error: "",
  });
  const [navigationState, setNavigationState] = useState(createInitialGalaxyNavigationState);
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [interiorUiState, setInteriorUiState] = useState(createInitialStarCoreInteriorUiState);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    let active = true;

    async function loadStarCoreTruth() {
      if (active) {
        setFetchState((current) => ({
          status: "loading",
          truth: current.truth,
          interiorTruth: current.interiorTruth,
          tableRows: current.tableRows,
          error: "",
        }));
      }

      try {
        const nextState = await loadWorkspaceTruth({ defaultGalaxy, connectivity });
        if (!active) return;
        setFetchState(nextState);
        setInteriorUiState(closeStarCoreInteriorUi());
      } catch (error) {
        if (!active) return;
        setFetchState({
          status: "data_unavailable",
          truth: null,
          interiorTruth: null,
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
      if (interiorUiState.isOpen) {
        setInteriorUiState(closeStarCoreInteriorUi());
        return;
      }
      setNavigationState((current) => resolveGalaxyEscape(current));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [interiorUiState.isOpen]);

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
  const interiorModel = useMemo(
    () => resolveStarCoreInteriorModel({ interiorTruth: fetchState.interiorTruth, uiState: interiorUiState }),
    [fetchState.interiorTruth, interiorUiState]
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

  useEffect(() => {
    if (interiorUiState.transientPhase !== "star_core_interior_entry") return undefined;
    const timeoutId = window.setTimeout(
      () => {
        setInteriorUiState((current) => resolveStarCoreInteriorEntryComplete(current));
      },
      reducedMotion ? 40 : 900
    );
    return () => window.clearTimeout(timeoutId);
  }, [interiorUiState.transientPhase, reducedMotion]);

  useEffect(() => {
    if (navigationModel.approachTargetId === "star-core") return;
    if (interiorUiState.isOpen) {
      setInteriorUiState(closeStarCoreInteriorUi());
    }
  }, [interiorUiState.isOpen, navigationModel.approachTargetId]);

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
          idempotency_key:
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `star-core-select-${Date.now()}`,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Nepodařilo se vybrat ústavu Srdce hvězdy.");
      }
      const interiorPayload = await response.json();
      setFetchState((current) => ({
        ...current,
        interiorTruth: adaptStarCoreInteriorTruth(interiorPayload),
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
            fetchState.status !== "loading" &&
            fetchState.status !== "data_unavailable"
          ) {
            setInteriorUiState(beginStarCoreInteriorUi());
            return;
          }
          setNavigationState((current) => beginGalaxyApproach(current, objectId));
        }}
        onSelectConstitution={handleSelectConstitution}
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
        onReturnToSpace={() => setInteriorUiState(closeStarCoreInteriorUi())}
      />
    </main>
  );
}
