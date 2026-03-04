import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, apiFetch } from "./lib/dataverseApi";
import LandingDashboard from "./components/screens/LandingDashboard";
import GalaxySelector3D from "./components/screens/GalaxySelector3D";
import UniverseWorkspace from "./components/universe/UniverseWorkspace";
import { useAuth } from "./context/AuthContext.jsx";
import { useUniverseStore } from "./store/useUniverseStore";

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

export default function App() {
  const { user, isAuthenticated, isLoading, login, register, logout, setDefaultGalaxy } = useAuth();
  const { selectedGalaxyId, selectGalaxy, setLevel } = useUniverseStore();

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [galaxies, setGalaxies] = useState([]);
  const [galaxyLoading, setGalaxyLoading] = useState(false);
  const [galaxyBusy, setGalaxyBusy] = useState(false);
  const [galaxyError, setGalaxyError] = useState("");
  const [newGalaxyName, setNewGalaxyName] = useState("");
  const [hasLoadedGalaxies, setHasLoadedGalaxies] = useState(false);
  const autoCreateAttemptedRef = useRef(false);

  const selectedGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(selectedGalaxyId || "")) || null,
    [galaxies, selectedGalaxyId]
  );

  useEffect(() => {
    if (selectedGalaxyId) {
      localStorage.setItem(SELECTED_GALAXY_STORAGE_KEY, selectedGalaxyId);
    } else {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
    }
  }, [selectedGalaxyId]);

  useEffect(() => {
    if (!isAuthenticated) {
      selectGalaxy("");
      setLevel(0);
      setGalaxies([]);
      setHasLoadedGalaxies(false);
      autoCreateAttemptedRef.current = false;
      return;
    }
    if (!selectedGalaxyId) {
      setLevel(1);
    }
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  const loadGalaxies = useCallback(async () => {
    if (!isAuthenticated) return;
    setGalaxyLoading(true);
    setGalaxyError("");
    try {
      const response = await apiFetch(`${API_BASE}/galaxies`);
      if (!response.ok) {
        throw new Error(await parseApiError(response, `Galaxies failed: ${response.status}`));
      }
      const body = await response.json();
      const live = Array.isArray(body) ? body.filter((item) => !item?.deleted_at) : [];
      setGalaxies(live);

      const hasSelected = selectedGalaxyId && live.some((item) => String(item.id) === String(selectedGalaxyId));
      if (selectedGalaxyId && !hasSelected) {
        selectGalaxy("");
        setLevel(1);
      }

      if (hasSelected) setLevel(2);
      else setLevel(1);
    } catch (error) {
      setGalaxyError(error.message || "Load galaxies failed");
    } finally {
      setGalaxyLoading(false);
      setHasLoadedGalaxies(true);
    }
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadGalaxies();
  }, [isAuthenticated, loadGalaxies]);

  const handleAuthLogin = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        await login(email, password);
        await loadGalaxies();
      } catch (error) {
        setAuthError(error.message || "Login failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [loadGalaxies, login]
  );

  const handleAuthRegister = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        await register(email, password);
        await loadGalaxies();
      } catch (error) {
        setAuthError(error.message || "Register failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [loadGalaxies, register]
  );

  const createGalaxy = useCallback(
    async (rawName) => {
      const name = String(rawName || "").trim();
      if (!name) {
        throw new Error("Nazev galaxie je povinny.");
      }
      if (galaxyBusy) {
        throw new Error("Prave probiha jina akce. Zkus to za chvili.");
      }
      setGalaxyBusy(true);
      setGalaxyError("");
      try {
        const response = await apiFetch(`${API_BASE}/galaxies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Create galaxy failed: ${response.status}`));
        }
        const created = await response.json();
        setDefaultGalaxy((prev) => prev || created);
        await loadGalaxies();
        return created;
      } finally {
        setGalaxyBusy(false);
      }
    },
    [galaxyBusy, loadGalaxies, setDefaultGalaxy]
  );

  useEffect(() => {
    if (!isAuthenticated || !hasLoadedGalaxies) return;
    if (galaxyLoading || galaxyBusy) return;
    if (selectedGalaxyId) return;
    if (galaxies.length > 0) {
      autoCreateAttemptedRef.current = false;
      return;
    }
    if (autoCreateAttemptedRef.current) return;

    autoCreateAttemptedRef.current = true;
    const emailAlias = String(user?.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim();
    const workspaceName = emailAlias ? `${emailAlias} workspace` : "Moje galaxie";

    createGalaxy(workspaceName).catch((error) => {
      autoCreateAttemptedRef.current = false;
      setGalaxyError(error.message || "Auto create galaxy failed");
    });
  }, [
    createGalaxy,
    galaxies.length,
    galaxyBusy,
    galaxyLoading,
    hasLoadedGalaxies,
    isAuthenticated,
    selectedGalaxyId,
    user?.email,
  ]);

  const handleCreateGalaxy = useCallback(async () => {
    const name = newGalaxyName.trim();
    if (!name || galaxyBusy) return;
    try {
      const created = await createGalaxy(name);
      setNewGalaxyName("");
      if (created?.id) {
        selectGalaxy(created.id);
        setLevel(2);
      }
    } catch (error) {
      setGalaxyError(error.message || "Create galaxy failed");
    }
  }, [createGalaxy, galaxyBusy, newGalaxyName, selectGalaxy, setLevel]);

  if (isLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#02050c",
          color: "#d8f8ff",
        }}
      >
        Ověřuji relaci...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LandingDashboard
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        busy={authBusy}
        error={authError}
      />
    );
  }

  if (!selectedGalaxy) {
    return (
      <GalaxySelector3D
        user={user}
        galaxies={galaxies}
        selectedGalaxyId={selectedGalaxyId}
        newGalaxyName={newGalaxyName}
        loading={galaxyLoading}
        busy={galaxyBusy}
        error={galaxyError}
        onSelect={(id) => {
          selectGalaxy(id);
          setLevel(2);
        }}
        onCreate={handleCreateGalaxy}
        onNameChange={setNewGalaxyName}
        onRefresh={loadGalaxies}
        onLogout={logout}
      />
    );
  }

  return (
    <UniverseWorkspace
      galaxy={selectedGalaxy}
      minimalShell
      onCreateGalaxy={createGalaxy}
      onBackToGalaxies={() => {
        selectGalaxy("");
        setLevel(1);
      }}
      onLogout={logout}
    />
  );
}
