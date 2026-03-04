import { useCallback, useState } from "react";

import AuthExperience from "./components/app/AuthExperience";
import GalaxyGateScreen from "./components/app/GalaxyGateScreen";
import SessionBootScreen from "./components/app/SessionBootScreen";
import WorkspaceShell from "./components/app/WorkspaceShell";
import { useAuth } from "./context/AuthContext.jsx";
import { useGalaxyGate } from "./hooks/useGalaxyGate";

export default function App() {
  const { user, isAuthenticated, isLoading, login, register, logout, setDefaultGalaxy } = useAuth();

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const galaxyGate = useGalaxyGate({
    isAuthenticated,
    userEmail: user?.email,
    setDefaultGalaxy,
  });
  const {
    selectedGalaxy,
    selectedGalaxyId,
    galaxies,
    loading: galaxyLoading,
    busy: galaxyBusy,
    error: galaxyError,
    newGalaxyName,
    setNewGalaxyName,
    loadGalaxies,
    createAndEnterGalaxy,
    enterGalaxy,
    backToGalaxyGate,
  } = galaxyGate;

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

  if (isLoading) {
    return <SessionBootScreen />;
  }

  if (!isAuthenticated) {
    return (
      <AuthExperience
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        busy={authBusy}
        error={authError}
      />
    );
  }

  if (!selectedGalaxy) {
    return (
      <GalaxyGateScreen
        user={user}
        galaxies={galaxies}
        selectedGalaxyId={selectedGalaxyId}
        newGalaxyName={newGalaxyName}
        loading={galaxyLoading}
        busy={galaxyBusy}
        error={galaxyError}
        onSelect={enterGalaxy}
        onCreate={createAndEnterGalaxy}
        onNameChange={setNewGalaxyName}
        onRefresh={loadGalaxies}
        onLogout={logout}
      />
    );
  }

  return (
    <WorkspaceShell
      galaxy={selectedGalaxy}
      onBackToGalaxies={backToGalaxyGate}
      onLogout={logout}
    />
  );
}
