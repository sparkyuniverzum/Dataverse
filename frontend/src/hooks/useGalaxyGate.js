import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, apiFetch } from "../lib/dataverseApi";
import { normalizeGalaxyList, normalizeGalaxyPublic } from "../lib/workspaceScopeContract";
import { useUniverseStore } from "../store/useUniverseStore";

const SELECTED_GALAXY_STORAGE_KEY = "dataverse_selected_galaxy_id";

async function parseApiError(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail;
  } catch {
    // noop
  }
  return text;
}

export function useGalaxyGate({ isAuthenticated, userEmail, setDefaultGalaxy }) {
  const { selectedGalaxyId, selectGalaxy, setLevel } = useUniverseStore();

  const [galaxies, setGalaxies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newGalaxyName, setNewGalaxyName] = useState("");
  const [hasLoadedGalaxies, setHasLoadedGalaxies] = useState(false);

  const autoCreateAttemptedRef = useRef(false);
  const restoreAttemptedRef = useRef(false);

  const selectedGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(selectedGalaxyId || "")) || null,
    [galaxies, selectedGalaxyId]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
      return;
    }
    if (selectedGalaxyId) {
      localStorage.setItem(SELECTED_GALAXY_STORAGE_KEY, selectedGalaxyId);
    } else {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
    }
  }, [isAuthenticated, selectedGalaxyId]);

  useEffect(() => {
    if (!isAuthenticated) {
      restoreAttemptedRef.current = false;
      selectGalaxy("");
      setLevel(0);
      setGalaxies([]);
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
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

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

  return {
    selectedGalaxy,
    selectedGalaxyId,
    galaxies,
    loading,
    busy,
    error,
    newGalaxyName,
    setNewGalaxyName,
    loadGalaxies,
    createAndEnterGalaxy,
    enterGalaxy,
    backToGalaxyGate,
  };
}
