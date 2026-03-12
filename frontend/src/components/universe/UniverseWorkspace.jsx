import { useEffect, useMemo, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePolicyUrl,
} from "../../lib/dataverseApi";
import StarCoreHudOverlay from "./StarCoreHudOverlay.jsx";
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
    error: "",
  });
  const [isStarFocused, setIsStarFocused] = useState(false);
  const [isCoreEntered, setIsCoreEntered] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStarCoreTruth() {
      const galaxyId = String(defaultGalaxy?.id || "").trim();
      if (!galaxyId) {
        if (active) {
          setFetchState({
            status: "data_unavailable",
            truth: null,
            error: "Chybí aktivní galaxie pro načtení Star Core.",
          });
        }
        return;
      }

      if (active) {
        setFetchState((current) => ({
          status: "loading",
          truth: current.truth,
          error: "",
        }));
      }

      try {
        const [policyResponse, physicsResponse] = await Promise.all([
          apiFetch(buildStarCorePolicyUrl(API_BASE, galaxyId)),
          apiFetch(buildStarCorePhysicsProfileUrl(API_BASE, galaxyId)),
        ]);

        if (!policyResponse.ok) {
          throw await apiErrorFromResponse(policyResponse, "Nepodařilo se načíst policy Srdce hvězdy.");
        }
        if (!physicsResponse.ok) {
          throw await apiErrorFromResponse(physicsResponse, "Nepodařilo se načíst fyziku Srdce hvězdy.");
        }

        const [policyPayload, physicsProfilePayload] = await Promise.all([
          policyResponse.json(),
          physicsResponse.json(),
        ]);
        const truth = adaptStarCoreTruth({
          galaxy: defaultGalaxy,
          connectivity,
          policyPayload,
          physicsProfilePayload,
        });

        if (!truth) {
          throw new Error("Star Core truth adapter nevrátil použitelná data.");
        }

        if (active) {
          setFetchState({
            status: truth.policy.lock_status === "locked" ? "star_core_locked_ready" : "star_core_unlocked",
            truth,
            error: "",
          });
        }
      } catch (error) {
        if (!active) return;
        setFetchState({
          status: "data_unavailable",
          truth: null,
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
      setIsCoreEntered(false);
      setIsStarFocused(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const model = useMemo(() => {
    if (fetchState.status === "loading") {
      return createLoadingModel(defaultGalaxy, connectivity);
    }
    if (!fetchState.truth) {
      return resolveStarCoreSpatialStateModel(null, { error: fetchState.error });
    }
    return resolveStarCoreSpatialStateModel(fetchState.truth, { error: fetchState.error });
  }, [connectivity, defaultGalaxy, fetchState.error, fetchState.status, fetchState.truth]);

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
        isStarFocused={isStarFocused}
        isCoreEntered={isCoreEntered}
        onSelectStar={() => setIsStarFocused(true)}
        onEnterCore={() => {
          setIsStarFocused(true);
          setIsCoreEntered(true);
        }}
        onClearFocus={() => {
          setIsCoreEntered(false);
          setIsStarFocused(false);
        }}
      />
      <StarCoreHudOverlay model={model} isStarFocused={isStarFocused} isCoreEntered={isCoreEntered} />
    </main>
  );
}
