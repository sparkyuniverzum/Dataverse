import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, configureApiAuth } from "../lib/dataverseApi";
import { normalizeGalaxyPublic } from "../lib/workspaceScopeContract";

const LEGACY_ACCESS_TOKEN_KEY = "dataverse_auth_token";
const ACCESS_TOKEN_KEY = "dataverse_auth_access_token";
const REFRESH_TOKEN_KEY = "dataverse_auth_refresh_token";

const AuthContext = createContext(null);

function parseErrorMessage(bodyText, fallback) {
  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail;
    if (typeof parsed?.detail?.message === "string" && parsed.detail.message) return parsed.detail.message;
  } catch {
    // Ignore invalid JSON response body and use fallback below.
  }
  return bodyText || fallback;
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
    if (!token) return null;
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return response.json();
  }, []);

  const refreshSession = useCallback(async () => {
    const inFlight = refreshPromiseRef.current;
    if (inFlight) return inFlight;

    const safeRefreshToken = String(refreshTokenRef.current || "").trim();
    if (!safeRefreshToken) {
      clearSession();
      return false;
    }

    const run = (async () => {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: safeRefreshToken }),
      });

      if (!response.ok) {
        clearSession();
        return false;
      }

      const bodyText = await response.text();
      const body = parseJsonSafe(bodyText);
      const nextAccessToken = String(body?.access_token || "").trim();
      const nextRefreshToken = String(body?.refresh_token || "").trim();
      if (!nextAccessToken || !nextRefreshToken) {
        clearSession();
        return false;
      }

      persistTokens(nextAccessToken, nextRefreshToken);
      return true;
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
      const currentAccess = String(accessTokenRef.current || "").trim();
      const currentRefresh = String(refreshTokenRef.current || "").trim();

      if (!currentAccess && !currentRefresh) {
        if (alive) setIsLoading(false);
        return;
      }

      let nextUser = await fetchCurrentUser(currentAccess);
      if (!nextUser) {
        const refreshed = await refreshSession();
        if (refreshed) {
          nextUser = await fetchCurrentUser(accessTokenRef.current);
        }
      }

      if (!alive) return;

      if (!nextUser) {
        clearSession();
      } else {
        setUser(nextUser);
      }
      setIsLoading(false);
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
        throw new Error(parseErrorMessage(bodyText, "Přihlášení selhalo"));
      }

      const body = parseJsonSafe(bodyText);
      return completeAuth(body, "Backend nevrátil access/refresh token");
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
        throw new Error(parseErrorMessage(bodyText, "Registrace selhala"));
      }

      const body = parseJsonSafe(bodyText);
      return completeAuth(body, "Backend nevrátil access/refresh token");
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
      throw new Error(parseErrorMessage(bodyText, "Odeslání odkazu pro obnovu hesla selhalo"));
    }

    // The component can show this message to the user upon success.
    return { message: "Pokud e-mail existuje v našem systému, byl na něj odeslán odkaz pro obnovu hesla." };
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
        throw new Error(parseErrorMessage(bodyText, "Aktualizace profilu selhala"));
      }

      const updatedUser = parseJsonSafe(bodyText);
      setUser(updatedUser);
      return updatedUser;
    },
    [user]
  );

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
      updateProfile,
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
      updateProfile,
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
