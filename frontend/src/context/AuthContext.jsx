import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE, configureApiAuth } from "../lib/dataverseApi";

const TOKEN_KEY = "dataverse_auth_token";

const AuthContext = createContext(null);

function parseErrorMessage(bodyText, fallback) {
  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail;
  } catch {
    // Ignore invalid JSON response body and use fallback below.
  }
  return bodyText || fallback;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [defaultGalaxy, setDefaultGalaxy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef(token);

  const logout = useCallback(() => {
    tokenRef.current = "";
    setToken("");
    setUser(null);
    setDefaultGalaxy(null);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    configureApiAuth({
      getToken: () => tokenRef.current || null,
      onUnauthorized: () => logout(),
    });
  }, [logout]);

  useEffect(() => {
    let alive = true;
    async function validateToken() {
      if (!token) {
        if (alive) setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (alive) logout();
          return;
        }
        const body = await res.json();
        if (!alive) return;
        setUser(body);
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    validateToken();
    return () => {
      alive = false;
    };
  }, [token, logout]);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(parseErrorMessage(bodyText, "Přihlášení selhalo"));
    }

    const body = JSON.parse(bodyText);
    const nextToken = body?.access_token || "";
    if (!nextToken) {
      throw new Error("Backend nevrátil access token");
    }

    tokenRef.current = nextToken;
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(body.user || null);
    setDefaultGalaxy(body.default_galaxy || null);
    return body;
  }, []);

  const register = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(parseErrorMessage(bodyText, "Registrace selhala"));
    }

    const body = JSON.parse(bodyText);
    const nextToken = body?.access_token || "";
    if (!nextToken) {
      throw new Error("Backend nevrátil access token");
    }

    tokenRef.current = nextToken;
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(body.user || null);
    setDefaultGalaxy(body.default_galaxy || null);
    return body;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      defaultGalaxy,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      register,
      logout,
      setDefaultGalaxy,
    }),
    [user, token, defaultGalaxy, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
