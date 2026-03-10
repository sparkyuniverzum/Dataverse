import { describe, expect, it } from "vitest";

import {
  AUTH_SESSION_STATUS,
  classifyAuthHttpStatus,
  classifyAuthRuntimeError,
  normalizeAuthApiFailure,
  shouldClearSessionAfterRefreshFailure,
  shouldClearSessionAfterBootstrap,
} from "./authSessionRuntime";

describe("authSessionRuntime", () => {
  it("treats only 401/403 as explicit auth invalid", () => {
    expect(classifyAuthHttpStatus(401)).toBe(AUTH_SESSION_STATUS.AUTH_INVALID);
    expect(classifyAuthHttpStatus(403)).toBe(AUTH_SESSION_STATUS.AUTH_INVALID);
    expect(classifyAuthHttpStatus(500)).toBe(AUTH_SESSION_STATUS.RETRYABLE_ERROR);
  });

  it("classifies fetch transport failures as network errors", () => {
    expect(classifyAuthRuntimeError(new TypeError("Failed to fetch"))).toBe(AUTH_SESSION_STATUS.NETWORK_ERROR);
    expect(classifyAuthRuntimeError(new Error("Network request failed"))).toBe(AUTH_SESSION_STATUS.NETWORK_ERROR);
    expect(classifyAuthRuntimeError(new Error("boom"))).toBe(AUTH_SESSION_STATUS.RETRYABLE_ERROR);
  });

  it("preserves session on transient bootstrap network failure", () => {
    expect(
      shouldClearSessionAfterBootstrap({
        initialUserStatus: AUTH_SESSION_STATUS.NETWORK_ERROR,
        refreshAttempted: false,
        refreshStatus: AUTH_SESSION_STATUS.OK,
        retryUserStatus: AUTH_SESSION_STATUS.OK,
      })
    ).toBe(false);
  });

  it("clears session only when auth invalid remains explicit after refresh path", () => {
    expect(
      shouldClearSessionAfterBootstrap({
        initialUserStatus: AUTH_SESSION_STATUS.AUTH_INVALID,
        refreshAttempted: true,
        refreshStatus: AUTH_SESSION_STATUS.AUTH_INVALID,
        retryUserStatus: AUTH_SESSION_STATUS.OK,
      })
    ).toBe(true);

    expect(
      shouldClearSessionAfterBootstrap({
        initialUserStatus: AUTH_SESSION_STATUS.AUTH_INVALID,
        refreshAttempted: true,
        refreshStatus: AUTH_SESSION_STATUS.NETWORK_ERROR,
        retryUserStatus: AUTH_SESSION_STATUS.OK,
      })
    ).toBe(false);
  });

  it("normalizes auth api failures into message + session status", () => {
    expect(
      normalizeAuthApiFailure({
        status: 401,
        bodyText: JSON.stringify({ detail: { code: "AUTH_INVALID", message: "Session expired" } }),
        fallbackMessage: "Auth failed",
      })
    ).toMatchObject({
      status: 401,
      code: "AUTH_INVALID",
      message: "Session expired",
      sessionStatus: AUTH_SESSION_STATUS.AUTH_INVALID,
    });

    expect(
      normalizeAuthApiFailure({
        status: 503,
        bodyText: "",
        fallbackMessage: "Auth failed",
      }).sessionStatus
    ).toBe(AUTH_SESSION_STATUS.RETRYABLE_ERROR);
  });

  it("clears session only for hard refresh failure statuses", () => {
    expect(shouldClearSessionAfterRefreshFailure(AUTH_SESSION_STATUS.AUTH_INVALID)).toBe(true);
    expect(shouldClearSessionAfterRefreshFailure(AUTH_SESSION_STATUS.INVALID_PAYLOAD)).toBe(true);
    expect(shouldClearSessionAfterRefreshFailure(AUTH_SESSION_STATUS.NETWORK_ERROR)).toBe(false);
  });
});
