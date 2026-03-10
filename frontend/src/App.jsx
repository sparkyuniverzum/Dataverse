import { useCallback, useMemo, useState } from "react";

import AuthExperience from "./components/app/AuthExperience";
import GalaxyGateScreen from "./components/app/GalaxyGateScreen";
import PlanetBuilderSmokeScreen from "./components/app/PlanetBuilderSmokeScreen";
import SessionBootScreen from "./components/app/SessionBootScreen";
import WorkspaceShell from "./components/app/WorkspaceShell";
import {
  buildOfflineEntryGuardMessage,
  resolveAppConnectivityNotice,
} from "./components/app/appConnectivityNoticeState";
import { useAuth } from "./context/AuthContext.jsx";
import { useConnectivityState } from "./hooks/useConnectivityState";
import { useGalaxyGate } from "./hooks/useGalaxyGate";

export default function App() {
  const { user, isAuthenticated, isLoading, login, register, forgotPassword, logout, setDefaultGalaxy } = useAuth();
  const pathname = typeof window !== "undefined" ? String(window.location.pathname || "") : "";
  const connectivity = useConnectivityState();

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const authConnectivityNotice = useMemo(
    () => resolveAppConnectivityNotice(connectivity.isOnline, "auth_entry"),
    [connectivity.isOnline]
  );
  const bootConnectivityNotice = useMemo(
    () => resolveAppConnectivityNotice(connectivity.isOnline, "session_boot"),
    [connectivity.isOnline]
  );
  const galaxyConnectivityNotice = useMemo(
    () => resolveAppConnectivityNotice(connectivity.isOnline, "galaxy_gate"),
    [connectivity.isOnline]
  );

  const galaxyGate = useGalaxyGate({
    isAuthenticated,
    isAuthLoading: isLoading,
    setDefaultGalaxy,
    authUserId: user?.id || "",
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
        if (connectivity.isOffline) {
          throw new Error(buildOfflineEntryGuardMessage("Prihlaseni"));
        }
        await login(email, password);
        await loadGalaxies();
      } catch (error) {
        setAuthError(error.message || "Login failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [connectivity.isOffline, loadGalaxies, login]
  );

  const handleAuthRegister = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        if (connectivity.isOffline) {
          throw new Error(buildOfflineEntryGuardMessage("Registrace"));
        }
        const result = await register(email, password);
        if (result?.authenticated) {
          await loadGalaxies();
        }
        return result;
      } catch (error) {
        setAuthError(error.message || "Register failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [connectivity.isOffline, loadGalaxies, register]
  );
  const handleAuthForgotPassword = useCallback(
    async (email) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        if (connectivity.isOffline) {
          throw new Error(buildOfflineEntryGuardMessage("Obnova hesla"));
        }
        return await forgotPassword(email);
      } catch (error) {
        setAuthError(error.message || "Reset password request failed");
        throw error;
      } finally {
        setAuthBusy(false);
      }
    },
    [connectivity.isOffline, forgotPassword]
  );

  if (pathname === "/smoke/planet-builder") {
    return <PlanetBuilderSmokeScreen />;
  }

  if (isLoading) {
    return <SessionBootScreen connectivityNotice={bootConnectivityNotice} />;
  }

  if (!isAuthenticated) {
    return (
      <AuthExperience
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        onForgotPassword={handleAuthForgotPassword}
        busy={authBusy}
        error={authError}
        connectivityNotice={authConnectivityNotice}
      />
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
        connectivityNotice={galaxyConnectivityNotice}
        interactionLocked={connectivity.isOffline}
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
      onRefreshScopes={() => {
        if (!selectedGalaxyId) return;
        void loadBranchesForGalaxy(selectedGalaxyId);
        void loadOnboardingForGalaxy(selectedGalaxyId);
      }}
    />
  );
}
