import { useCallback, useEffect, useMemo, useState } from "react";

import AuthExperience from "./components/app/AuthExperience";
import WorkspaceShell from "./components/app/WorkspaceShell";
import ResetPasswordScreen from "./components/screens/ResetPasswordScreen.jsx";
import {
  buildOfflineEntryGuardMessage,
  resolveAppConnectivityNotice,
} from "./components/app/appConnectivityNoticeState";
import { useAuth } from "./context/AuthContext.jsx";
import { useConnectivityState } from "./hooks/useConnectivityState";

export default function App() {
  const { isAuthenticated, isLoading, login, register, forgotPassword } = useAuth();
  const connectivity = useConnectivityState();
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const authConnectivityNotice = useMemo(
    () => resolveAppConnectivityNotice(connectivity.isOnline, "auth_entry"),
    [connectivity.isOnline]
  );

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToPath = useCallback((nextPath) => {
    const normalizedPath = String(nextPath || "/").trim() || "/";
    if (normalizedPath === window.location.pathname) {
      setPathname(normalizedPath);
      return;
    }
    window.history.pushState({}, "", normalizedPath);
    setPathname(normalizedPath);
  }, []);

  const handleAuthLogin = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        if (connectivity.isOffline) {
          throw new Error(buildOfflineEntryGuardMessage("Prihlaseni"));
        }
        await login(email, password);
      } catch (error) {
        setAuthError(error.message || "Login failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [connectivity.isOffline, login]
  );

  const handleAuthRegister = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        if (connectivity.isOffline) {
          throw new Error(buildOfflineEntryGuardMessage("Registrace"));
        }
        return await register(email, password);
      } catch (error) {
        setAuthError(error.message || "Register failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [connectivity.isOffline, register]
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

  if (isLoading) {
    return (
      <main
        style={{
          width: "100vw",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, #02050c 0%, #010309 100%)",
          color: "#d9f8ff",
        }}
      >
        Inicializuji Dataverse...
      </main>
    );
  }

  if (pathname === "/reset-password") {
    return <ResetPasswordScreen onNavigateToLogin={() => navigateToPath("/")} />;
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

  return <WorkspaceShell />;
}
