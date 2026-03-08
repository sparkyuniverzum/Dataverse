const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEFAULT_PASSWORD = "E2eSmoke!12345";
const DEFAULT_FRONTEND_BASE = "http://127.0.0.1:4173";

export function resolveApiBase() {
  return String(process.env.DATAVERSE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function resolveFrontendBase() {
  return String(process.env.PLAYWRIGHT_BASE_URL || DEFAULT_FRONTEND_BASE).replace(/\/+$/, "");
}

function resolveRunSuffix() {
  const explicit = String(process.env.E2E_RUN_ID || "").trim();
  if (explicit) return explicit;
  const githubRunId = String(process.env.GITHUB_RUN_ID || "").trim();
  if (githubRunId) return `gh-${githubRunId}`;
  return `local-${Date.now()}`;
}

export function resolveBootstrapCredentials() {
  const explicitEmail = String(process.env.E2E_AUTH_EMAIL || "").trim();
  const explicitPassword = String(process.env.E2E_AUTH_PASSWORD || "").trim();
  if (explicitEmail && explicitPassword) {
    return {
      email: explicitEmail,
      password: explicitPassword,
    };
  }
  const suffix = resolveRunSuffix();
  return {
    email: `e2e-smoke-auth-${suffix}@dataverse.local`,
    password: explicitPassword || DEFAULT_PASSWORD,
  };
}

export async function isApiReachable(request, apiBase) {
  try {
    const response = await request.get(`${apiBase}/openapi.json`);
    return response.ok();
  } catch {
    return false;
  }
}

export async function isBrowserCorsReady(request, apiBase, frontendBase) {
  try {
    const response = await request.fetch(`${apiBase}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: frontendBase,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const allowOrigin = String(response.headers()["access-control-allow-origin"] || "").trim();
    if (!allowOrigin) return false;
    return allowOrigin === "*" || allowOrigin === frontendBase;
  } catch {
    return false;
  }
}

export async function ensureAuthBootstrapUser(request, apiBase) {
  const credentials = resolveBootstrapCredentials();
  const registerResponse = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  const registerStatus = registerResponse.status();
  const registerOk = registerResponse.ok();
  const registerBodyText = registerOk ? "" : await registerResponse.text();

  if (registerOk) {
    const body = await registerResponse.json().catch(() => ({}));
    return {
      ...credentials,
      registerStatus,
      defaultGalaxyId: String(body?.default_galaxy?.id || ""),
      tokens: {
        access_token: String(body?.access_token || ""),
        refresh_token: String(body?.refresh_token || ""),
      },
    };
  }

  const loginResponse = await request.post(`${apiBase}/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  if (!loginResponse.ok()) {
    const loginBody = await loginResponse.text();
    throw new Error(
      `Auth bootstrap failed (register=${registerStatus}, login=${loginResponse.status()}): register_body=${registerBodyText || "<empty>"}; login_body=${loginBody || "<empty>"}`
    );
  }
  const loginBody = await loginResponse.json().catch(() => ({}));
  return {
    ...credentials,
    registerStatus,
    defaultGalaxyId: String(loginBody?.default_galaxy?.id || ""),
    tokens: {
      access_token: String(loginBody?.access_token || ""),
      refresh_token: String(loginBody?.refresh_token || ""),
    },
  };
}
