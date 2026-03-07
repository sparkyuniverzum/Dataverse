import { useCallback, useState } from "react";

import AuthExperience from "./components/app/AuthExperience";
import GalaxyGateScreen from "./components/app/GalaxyGateScreen";
import PlanetBuilderSmokeScreen from "./components/app/PlanetBuilderSmokeScreen";
import SessionBootScreen from "./components/app/SessionBootScreen";
import WorkspaceShell from "./components/app/WorkspaceShell";
import { useAuth } from "./context/AuthContext.jsx";
import { useGalaxyGate } from "./hooks/useGalaxyGate";

export default function App() {
  const { user, isAuthenticated, isLoading, login, register, logout, setDefaultGalaxy } = useAuth();
  const pathname = typeof window !== "undefined" ? String(window.location.pathname || "") : "";

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const galaxyGate = useGalaxyGate({
    isAuthenticated,
    isAuthLoading: isLoading,
    userEmail: user?.email,
    setDefaultGalaxy,
  });
  const {
    selectedGalaxy,
    selectedGalaxyId,
    galaxies,
    branches,
    onboarding,
    branchesByGalaxyId,
    onboardingByGalaxyId,
    loading: galaxyLoading,
    busy: galaxyBusy,
    error: galaxyError,
    newGalaxyName,
    setNewGalaxyName,
    loadGalaxies,
    createAndEnterGalaxy,
    enterGalaxy,
    loadBranchesForGalaxy,
    loadOnboardingForGalaxy,
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

  if (pathname === "/smoke/planet-builder") {
    return <PlanetBuilderSmokeScreen />;
  }

  if (isLoading) {
    return <SessionBootScreen />;
  }

  if (!isAuthenticated) {
    return (
      <AuthExperience onLogin={handleAuthLogin} onRegister={handleAuthRegister} busy={authBusy} error={authError} />
    );
  }

  if (!selectedGalaxy) {
    return (
      <GalaxyGateScreen
        user={user}
        galaxies={galaxies}
        selectedGalaxyId={selectedGalaxyId}
        branchesByGalaxyId={branchesByGalaxyId}
        onboardingByGalaxyId={onboardingByGalaxyId}
        newGalaxyName={newGalaxyName}
        loading={galaxyLoading}
        busy={galaxyBusy}
        error={galaxyError}
        onSelect={enterGalaxy}
        onCreate={createAndEnterGalaxy}
        onNameChange={setNewGalaxyName}
        onLoadBranches={loadBranchesForGalaxy}
        onLoadOnboarding={loadOnboardingForGalaxy}
        onRefresh={loadGalaxies}
        onLogout={logout}
      />
    );
  }

  return (
    <WorkspaceShell
      galaxy={selectedGalaxy}
      branches={branches}
      onboarding={onboarding}
      onBackToGalaxies={backToGalaxyGate}
      onLogout={logout}
    />
  );
}
