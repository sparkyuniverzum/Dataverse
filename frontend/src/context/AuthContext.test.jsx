import { describe, expect, it } from "vitest";

import {
  AUTH_SESSION_STATUS,
  classifyAuthHttpStatus,
  classifyAuthRuntimeError,
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
});
