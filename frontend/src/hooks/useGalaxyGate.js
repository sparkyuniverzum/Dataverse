import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, apiFetch, buildBranchesUrl, buildGalaxyOnboardingUrl } from "../lib/dataverseApi";
import {
  normalizeBranchList,
  normalizeGalaxyList,
  normalizeGalaxyPublic,
  normalizeOnboardingPublic,
} from "../lib/workspaceScopeContract";
import { useUniverseStore } from "../store/useUniverseStore";

const SELECTED_GALAXY_STORAGE_KEY = "dataverse_selected_galaxy_id";

async function parseApiError(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail;
    if (typeof parsed?.detail?.message === "string" && parsed.detail.message) return parsed.detail.message;
    if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
    const detailCode = String(parsed?.detail?.code || parsed?.code || "").trim();
    const detailHint = String(parsed?.detail?.repair_hint || parsed?.detail?.hint || parsed?.hint || "").trim();
    if (detailCode && detailHint) return `${detailCode}: ${detailHint}`;
    if (detailCode) return detailCode;
    if (detailHint) return detailHint;
  } catch {
    // noop
  }
  return text;
}

export function useGalaxyGate({ isAuthenticated, isAuthLoading = false, userEmail, setDefaultGalaxy }) {
  const { selectedGalaxyId, selectGalaxy, setLevel } = useUniverseStore();

  const [galaxies, setGalaxies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newGalaxyName, setNewGalaxyName] = useState("");
  const [hasLoadedGalaxies, setHasLoadedGalaxies] = useState(false);
  const [branchesByGalaxyId, setBranchesByGalaxyId] = useState({});
  const [onboardingByGalaxyId, setOnboardingByGalaxyId] = useState({});

  const autoCreateAttemptedRef = useRef(false);
  const restoreAttemptedRef = useRef(false);

  const selectedGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(selectedGalaxyId || "")) || null,
    [galaxies, selectedGalaxyId]
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
      return;
    }
    if (selectedGalaxyId) {
      localStorage.setItem(SELECTED_GALAXY_STORAGE_KEY, selectedGalaxyId);
      return;
    }
    // On hard reload we first render with empty selectedGalaxyId.
    // Keep persisted value until restore attempt runs to avoid wiping resume state.
    if (restoreAttemptedRef.current) {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
    }
  }, [isAuthLoading, isAuthenticated, selectedGalaxyId]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      restoreAttemptedRef.current = false;
      selectGalaxy("");
      setLevel(0);
      setGalaxies([]);
      setBranchesByGalaxyId({});
      setOnboardingByGalaxyId({});
      setHasLoadedGalaxies(false);
      autoCreateAttemptedRef.current = false;
      return;
    }
    if (!restoreAttemptedRef.current && !selectedGalaxyId) {
      const restored = String(localStorage.getItem(SELECTED_GALAXY_STORAGE_KEY) || "").trim();
      if (restored) {
        selectGalaxy(restored);
      }
      restoreAttemptedRef.current = true;
    }
    setLevel(selectedGalaxyId ? 2 : 1);
  }, [isAuthLoading, isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  const loadGalaxies = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_BASE}/galaxies`);
      if (!response.ok) {
        throw new Error(await parseApiError(response, `Galaxies failed: ${response.status}`));
      }
      const body = await response.json();
      const live = normalizeGalaxyList(body).filter((item) => !item?.deleted_at);
      setGalaxies(live);

      const hasSelected = selectedGalaxyId && live.some((item) => String(item.id) === String(selectedGalaxyId));
      if (selectedGalaxyId && !hasSelected) {
        selectGalaxy("");
        setLevel(1);
      } else if (hasSelected) {
        setLevel(2);
      } else {
        setLevel(1);
      }
    } catch (loadError) {
      setError(loadError.message || "Load galaxies failed");
    } finally {
      setLoading(false);
      setHasLoadedGalaxies(true);
    }
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadGalaxies();
  }, [isAuthenticated, loadGalaxies]);

  const loadBranchesForGalaxy = useCallback(
    async (galaxyIdValue = null) => {
      if (!isAuthenticated) return [];
      const scopeGalaxyId = String(galaxyIdValue || selectedGalaxyId || "").trim();
      if (!scopeGalaxyId) return [];
      try {
        const response = await apiFetch(buildBranchesUrl(API_BASE, scopeGalaxyId));
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Branches failed: ${response.status}`));
        }
        const body = await response.json();
        const normalized = normalizeBranchList(body).filter((item) => !item?.deleted_at);
        setBranchesByGalaxyId((prev) => ({ ...prev, [scopeGalaxyId]: normalized }));
        return normalized;
      } catch (loadError) {
        setError(loadError.message || "Load branches failed");
        return [];
      }
    },
    [isAuthenticated, selectedGalaxyId]
  );

  const loadOnboardingForGalaxy = useCallback(
    async (galaxyIdValue = null) => {
      if (!isAuthenticated) return null;
      const scopeGalaxyId = String(galaxyIdValue || selectedGalaxyId || "").trim();
      if (!scopeGalaxyId) return null;
      try {
        const response = await apiFetch(buildGalaxyOnboardingUrl(API_BASE, scopeGalaxyId));
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Onboarding failed: ${response.status}`));
        }
        const body = await response.json();
        const normalized = normalizeOnboardingPublic(body);
        if (normalized) {
          setOnboardingByGalaxyId((prev) => ({ ...prev, [scopeGalaxyId]: normalized }));
        }
        return normalized;
      } catch (loadError) {
        setError(loadError.message || "Load onboarding failed");
        return null;
      }
    },
    [isAuthenticated, selectedGalaxyId]
  );

  const createGalaxy = useCallback(
    async (rawName) => {
      const name = String(rawName || "").trim();
      if (!name) {
        throw new Error("Nazev galaxie je povinny.");
      }
      if (busy) {
        throw new Error("Prave probiha jina akce. Zkus to za chvili.");
      }
      setBusy(true);
      setError("");
      try {
        const response = await apiFetch(`${API_BASE}/galaxies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Create galaxy failed: ${response.status}`));
        }
        const createdRaw = await response.json();
        const created = normalizeGalaxyPublic(createdRaw);
        if (!created?.id) {
          throw new Error("Create galaxy failed: invalid payload");
        }
        setDefaultGalaxy((prev) => prev || created);
        await loadGalaxies();
        return created;
      } finally {
        setBusy(false);
      }
    },
    [busy, loadGalaxies, setDefaultGalaxy]
  );

  useEffect(() => {
    if (!isAuthenticated || !hasLoadedGalaxies) return;
    if (loading || busy) return;
    if (selectedGalaxyId) return;
    if (galaxies.length > 0) {
      autoCreateAttemptedRef.current = false;
      return;
    }
    if (autoCreateAttemptedRef.current) return;

    autoCreateAttemptedRef.current = true;
    const emailAlias = String(userEmail || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim();
    const workspaceName = emailAlias ? `${emailAlias} workspace` : "Moje galaxie";

    createGalaxy(workspaceName).catch((createError) => {
      autoCreateAttemptedRef.current = false;
      setError(createError.message || "Auto create galaxy failed");
    });
  }, [busy, createGalaxy, galaxies.length, hasLoadedGalaxies, isAuthenticated, loading, selectedGalaxyId, userEmail]);

  const enterGalaxy = useCallback(
    (id) => {
      selectGalaxy(id);
      setLevel(2);
    },
    [selectGalaxy, setLevel]
  );

  const createAndEnterGalaxy = useCallback(async () => {
    const name = newGalaxyName.trim();
    if (!name || busy) return;
    try {
      const created = await createGalaxy(name);
      setNewGalaxyName("");
      if (created?.id) {
        enterGalaxy(created.id);
      }
    } catch (createError) {
      setError(createError.message || "Create galaxy failed");
    }
  }, [busy, createGalaxy, enterGalaxy, newGalaxyName]);

  const backToGalaxyGate = useCallback(() => {
    selectGalaxy("");
    setLevel(1);
  }, [selectGalaxy, setLevel]);

  useEffect(() => {
    if (!isAuthenticated || !selectedGalaxyId) return;
    void loadBranchesForGalaxy(selectedGalaxyId);
    void loadOnboardingForGalaxy(selectedGalaxyId);
  }, [isAuthenticated, loadBranchesForGalaxy, loadOnboardingForGalaxy, selectedGalaxyId]);

  const branches = useMemo(
    () => (selectedGalaxyId ? branchesByGalaxyId[String(selectedGalaxyId)] || [] : []),
    [branchesByGalaxyId, selectedGalaxyId]
  );

  const onboarding = useMemo(
    () => (selectedGalaxyId ? onboardingByGalaxyId[String(selectedGalaxyId)] || null : null),
    [onboardingByGalaxyId, selectedGalaxyId]
  );

  return {
    selectedGalaxy,
    selectedGalaxyId,
    galaxies,
    branchesByGalaxyId,
    onboardingByGalaxyId,
    loading,
    busy,
    error,
    newGalaxyName,
    setNewGalaxyName,
    loadGalaxies,
    loadBranchesForGalaxy,
    loadOnboardingForGalaxy,
    branches,
    onboarding,
    createAndEnterGalaxy,
    enterGalaxy,
    backToGalaxyGate,
  };
}
