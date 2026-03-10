import { normalizeApiErrorPayload } from "../lib/dataverseApi";

export const AUTH_SESSION_STATUS = Object.freeze({
  OK: "ok",
  AUTH_INVALID: "auth_invalid",
  NETWORK_ERROR: "network_error",
  RETRYABLE_ERROR: "retryable_error",
  MISSING_TOKEN: "missing_token",
  INVALID_PAYLOAD: "invalid_payload",
});

export function classifyAuthHttpStatus(status) {
  const normalized = Number(status || 0);
  if (normalized === 401 || normalized === 403) {
    return AUTH_SESSION_STATUS.AUTH_INVALID;
  }
  return AUTH_SESSION_STATUS.RETRYABLE_ERROR;
}

export function normalizeAuthApiFailure({ status = 0, bodyText = "", fallbackMessage = "Request failed" } = {}) {
  const payload = (() => {
    try {
      return bodyText ? JSON.parse(String(bodyText)) : null;
    } catch {
      return bodyText ? { detail: String(bodyText) } : null;
    }
  })();
  const normalized = normalizeApiErrorPayload(payload, { status, fallbackMessage });
  return {
    ...normalized,
    sessionStatus: classifyAuthHttpStatus(status),
  };
}

export function classifyAuthRuntimeError(error) {
  const message = String(error?.message || "")
    .trim()
    .toLowerCase();
  if (
    error instanceof TypeError ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  ) {
    return AUTH_SESSION_STATUS.NETWORK_ERROR;
  }
  return AUTH_SESSION_STATUS.RETRYABLE_ERROR;
}

export function shouldClearSessionAfterBootstrap({
  initialUserStatus,
  refreshAttempted,
  refreshStatus,
  retryUserStatus,
}) {
  if (initialUserStatus !== AUTH_SESSION_STATUS.AUTH_INVALID) {
    return false;
  }
  if (!refreshAttempted) {
    return true;
  }
  if (refreshStatus !== AUTH_SESSION_STATUS.OK) {
    return (
      refreshStatus === AUTH_SESSION_STATUS.AUTH_INVALID ||
      refreshStatus === AUTH_SESSION_STATUS.MISSING_TOKEN ||
      refreshStatus === AUTH_SESSION_STATUS.INVALID_PAYLOAD
    );
  }
  return retryUserStatus === AUTH_SESSION_STATUS.AUTH_INVALID;
}

export function shouldClearSessionAfterRefreshFailure(status) {
  return (
    status === AUTH_SESSION_STATUS.AUTH_INVALID ||
    status === AUTH_SESSION_STATUS.MISSING_TOKEN ||
    status === AUTH_SESSION_STATUS.INVALID_PAYLOAD
  );
}
