import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, configureApiAuth } from "../lib/dataverseApi";
import { normalizeGalaxyPublic } from "../lib/workspaceScopeContract";
import {
  AUTH_SESSION_STATUS,
  classifyAuthHttpStatus,
  classifyAuthRuntimeError,
  normalizeAuthApiFailure,
  shouldClearSessionAfterRefreshFailure,
  shouldClearSessionAfterBootstrap,
} from "./authSessionRuntime";

const LEGACY_ACCESS_TOKEN_KEY = "dataverse_auth_token";
const ACCESS_TOKEN_KEY = "dataverse_auth_access_token";
const REFRESH_TOKEN_KEY = "dataverse_auth_refresh_token";

const AuthContext = createContext(null);

function parseErrorMessage(bodyText, fallback) {
  return normalizeAuthApiFailure({ bodyText, fallbackMessage: fallback }).message;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || ""
  );
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [defaultGalaxy, setDefaultGalaxy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const accessTokenRef = useRef(accessToken);
  const refreshTokenRef = useRef(refreshToken);
  const refreshPromiseRef = useRef(null);
  const refreshSessionRef = useRef(async () => false);
  const lastRefreshStatusRef = useRef(AUTH_SESSION_STATUS.OK);

  const persistTokens = useCallback((nextAccessToken, nextRefreshToken) => {
    const safeAccess = String(nextAccessToken || "");
    const safeRefresh = String(nextRefreshToken || "");

    accessTokenRef.current = safeAccess;
    refreshTokenRef.current = safeRefresh;

    setAccessToken(safeAccess);
    setRefreshToken(safeRefresh);

    if (safeAccess) localStorage.setItem(ACCESS_TOKEN_KEY, safeAccess);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);

    if (safeRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, safeRefresh);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);

    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  }, []);

  const clearSession = useCallback(() => {
    refreshPromiseRef.current = null;
    lastRefreshStatusRef.current = AUTH_SESSION_STATUS.OK;
    accessTokenRef.current = "";
    refreshTokenRef.current = "";
    setAccessToken("");
    setRefreshToken("");
    setUser(null);
    setDefaultGalaxy(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  }, []);

  const fetchCurrentUser = useCallback(async (token) => {
    if (!token) {
      return { status: AUTH_SESSION_STATUS.MISSING_TOKEN, user: null };
    }
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { status: classifyAuthHttpStatus(response.status), user: null };
      }
      return { status: AUTH_SESSION_STATUS.OK, user: await response.json() };
    } catch (error) {
      return { status: classifyAuthRuntimeError(error), user: null };
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const inFlight = refreshPromiseRef.current;
    if (inFlight) return inFlight;

    const safeRefreshToken = String(refreshTokenRef.current || "").trim();
    if (!safeRefreshToken) {
      lastRefreshStatusRef.current = AUTH_SESSION_STATUS.MISSING_TOKEN;
      clearSession();
      return false;
    }

    const run = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: safeRefreshToken }),
        });

        if (!response.ok) {
          const refreshError = normalizeAuthApiFailure({
            status: response.status,
            bodyText: await response.text(),
            fallbackMessage: "Obnova session selhala.",
          });
          const refreshStatus = refreshError.sessionStatus;
          lastRefreshStatusRef.current = refreshStatus;
          if (shouldClearSessionAfterRefreshFailure(refreshStatus)) {
            clearSession();
          }
          return false;
        }

        const bodyText = await response.text();
        const body = parseJsonSafe(bodyText);
        const nextAccessToken = String(body?.access_token || "").trim();
        const nextRefreshToken = String(body?.refresh_token || "").trim();
        if (!nextAccessToken || !nextRefreshToken) {
          lastRefreshStatusRef.current = AUTH_SESSION_STATUS.INVALID_PAYLOAD;
          clearSession();
          return false;
        }

        persistTokens(nextAccessToken, nextRefreshToken);
        lastRefreshStatusRef.current = AUTH_SESSION_STATUS.OK;
        return true;
      } catch (error) {
        lastRefreshStatusRef.current = classifyAuthRuntimeError(error);
        return false;
      }
    })();

    refreshPromiseRef.current = run;
    try {
      return await run;
    } finally {
      if (refreshPromiseRef.current === run) {
        refreshPromiseRef.current = null;
      }
    }
  }, [clearSession, persistTokens]);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  const logout = useCallback(
    async ({ remote = true } = {}) => {
      const safeAccessToken = String(accessTokenRef.current || "");
      if (remote && safeAccessToken) {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${safeAccessToken}` },
          });
        } catch {
          // noop
        }
      }
      clearSession();
    },
    [clearSession]
  );

  useEffect(() => {
    configureApiAuth({
      getToken: () => accessTokenRef.current || null,
      onUnauthorized: async () => {
        return refreshSessionRef.current();
      },
    });
  }, []);

  useEffect(() => {
    let alive = true;

    async function bootstrapSession() {
      try {
        const currentAccess = String(accessTokenRef.current || "").trim();
        const currentRefresh = String(refreshTokenRef.current || "").trim();

        if (!currentAccess && !currentRefresh) {
          if (alive) setIsLoading(false);
          return;
        }

        let userResult = await fetchCurrentUser(currentAccess);
        const initialUserStatus = userResult.status;
        let nextUser = userResult.user;
        let refreshAttempted = false;
        let retryUserStatus = AUTH_SESSION_STATUS.OK;
        if (!nextUser && userResult.status === AUTH_SESSION_STATUS.AUTH_INVALID) {
          refreshAttempted = true;
          const refreshed = await refreshSession();
          if (refreshed) {
            userResult = await fetchCurrentUser(accessTokenRef.current);
            nextUser = userResult.user;
            retryUserStatus = userResult.status;
          }
        }

        if (!alive) return;

        if (!nextUser) {
          if (
            shouldClearSessionAfterBootstrap({
              initialUserStatus,
              refreshAttempted,
              refreshStatus: lastRefreshStatusRef.current,
              retryUserStatus,
            })
          ) {
            clearSession();
          }
        } else {
          setUser(nextUser);
        }
      } catch {
        if (!alive) return;
      }
      if (alive) setIsLoading(false);
    }

    void bootstrapSession();
    return () => {
      alive = false;
    };
  }, [clearSession, fetchCurrentUser, refreshSession]);

  const completeAuth = useCallback(
    (body, fallbackTokenError) => {
      const nextAccessToken = String(body?.access_token || "").trim();
      const nextRefreshToken = String(body?.refresh_token || "").trim();
      if (!nextAccessToken || !nextRefreshToken) {
        throw new Error(fallbackTokenError);
      }

      persistTokens(nextAccessToken, nextRefreshToken);
      setUser(body.user || null);
      setDefaultGalaxy(normalizeGalaxyPublic(body.default_galaxy) || null);
      return body;
    },
    [persistTokens]
  );

  const login = useCallback(
    async (email, password) => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(parseErrorMessage(bodyText, "Přihlášení selhalo. Zkontrolujte prosím zadané údaje."));
      }

      const body = parseJsonSafe(bodyText);
      return completeAuth(body, "Při komunikaci se serverem došlo k chybě. Přihlášení nebylo dokončeno.");
    },
    [completeAuth]
  );

  const register = useCallback(
    async (email, password) => {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(parseErrorMessage(bodyText, "Registrace se nezdařila. Zkuste to prosím později."));
      }

      const body = parseJsonSafe(bodyText);
      const hasTokens = Boolean(String(body?.access_token || "").trim() && String(body?.refresh_token || "").trim());
      if (hasTokens) {
        completeAuth(body, "Registrace proběhla, ale nepodařilo se navázat session.");
        return { authenticated: true };
      }

      return {
        authenticated: false,
        message: "Účet byl vytvořen. Dokončete prosím ověření e-mailu a následně se přihlaste.",
      };
    },
    [completeAuth]
  );

  const forgotPassword = useCallback(async (email) => {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(
        parseErrorMessage(bodyText, "Odeslání instrukcí pro obnovu hesla selhalo. Zkuste to prosím později.")
      );
    }

    // The component can show this message to the user upon success.
    return { message: "Pokud e-mail existuje v našem systému, byl na něj odeslán odkaz pro obnovu hesla." };
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    if (!token) {
      throw new Error("Chybí token pro obnovu hesla.");
    }
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(parseErrorMessage(bodyText, "Obnova hesla selhala. Token může být neplatný nebo expirovaný."));
    }

    return { message: "Vaše heslo bylo úspěšně změněno. Nyní se můžete přihlásit." };
  }, []);

  const updateProfile = useCallback(
    async (payload) => {
      const updateData = {};
      if (typeof payload?.email === "string" && payload.email.trim()) {
        updateData.email = payload.email.trim();
      }
      if (typeof payload?.password === "string" && payload.password) {
        updateData.password = payload.password;
      }

      if (Object.keys(updateData).length === 0) return user;

      const token = accessTokenRef.current;
      if (!token) throw new Error("Nelze aktualizovat profil, uživatel není přihlášen.");

      const response = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(parseErrorMessage(bodyText, "Aktualizace profilu selhala. Zkuste to prosím později."));
      }

      const updatedUser = parseJsonSafe(bodyText);
      setUser(updatedUser);
      return updatedUser;
    },
    [user]
  );

  const deleteAccount = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) throw new Error("Nelze smazat účet, uživatel není přihlášen.");

    const response = await fetch(`${API_BASE}/auth/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(parseErrorMessage(bodyText, "Smazání účtu selhalo. Zkuste to prosím později."));
    }

    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      defaultGalaxy,
      isAuthenticated: Boolean(accessToken && user),
      isLoading,
      login,
      register,
      logout,
      refreshSession,
      setDefaultGalaxy,
      forgotPassword,
      resetPassword,
      updateProfile,
      deleteAccount,
    }),
    [
      accessToken,
      defaultGalaxy,
      isLoading,
      login,
      logout,
      refreshSession,
      refreshToken,
      register,
      user,
      forgotPassword,
      resetPassword,
      updateProfile,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
