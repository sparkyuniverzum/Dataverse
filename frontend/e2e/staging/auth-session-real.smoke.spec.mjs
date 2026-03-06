import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";

const ACCESS_TOKEN_KEY = "dataverse_auth_access_token";
const REFRESH_TOKEN_KEY = "dataverse_auth_refresh_token";

test("real auth session flow: login -> me -> refresh -> logout", async ({ page, request }) => {
  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  const user = await ensureAuthBootstrapUser(request, apiBase);

  await page.goto("/");
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(user.password);
  await page.getByTestId("auth-submit-button").click();

  await page.waitForFunction(
    ({ accessKey, refreshKey }) => {
      return Boolean(localStorage.getItem(accessKey) && localStorage.getItem(refreshKey));
    },
    { accessKey: ACCESS_TOKEN_KEY, refreshKey: REFRESH_TOKEN_KEY },
    { timeout: 30_000 }
  );

  const tokens = await page.evaluate(
    ({ accessKey, refreshKey }) => {
      return {
        accessToken: String(localStorage.getItem(accessKey) || ""),
        refreshToken: String(localStorage.getItem(refreshKey) || ""),
      };
    },
    { accessKey: ACCESS_TOKEN_KEY, refreshKey: REFRESH_TOKEN_KEY }
  );
  expect(tokens.accessToken).toBeTruthy();
  expect(tokens.refreshToken).toBeTruthy();

  const meResponse = await request.get(`${apiBase}/auth/me`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
  expect(meResponse.ok()).toBeTruthy();
  const meBody = await meResponse.json();
  expect(String(meBody?.email || "")).toBe(user.email);

  const refreshResponse = await request.post(`${apiBase}/auth/refresh`, {
    data: {
      refresh_token: tokens.refreshToken,
    },
  });
  expect(refreshResponse.ok()).toBeTruthy();
  const refreshBody = await refreshResponse.json();
  const refreshedAccessToken = String(refreshBody?.access_token || "");
  const refreshedRefreshToken = String(refreshBody?.refresh_token || "");
  expect(refreshedAccessToken).toBeTruthy();
  expect(refreshedRefreshToken).toBeTruthy();

  await page.evaluate(
    ({ accessKey, refreshKey, accessToken, refreshToken }) => {
      localStorage.setItem(accessKey, accessToken);
      localStorage.setItem(refreshKey, refreshToken);
    },
    {
      accessKey: ACCESS_TOKEN_KEY,
      refreshKey: REFRESH_TOKEN_KEY,
      accessToken: refreshedAccessToken,
      refreshToken: refreshedRefreshToken,
    }
  );
  await page.reload();

  const logoutButton = page.getByTestId("auth-logout-button").first();
  await expect(logoutButton).toBeVisible({ timeout: 30_000 });
  await logoutButton.click();

  await expect(page.getByTestId("auth-submit-button")).toBeVisible({ timeout: 30_000 });

  const afterLogout = await page.evaluate(
    ({ accessKey, refreshKey }) => {
      return {
        accessToken: localStorage.getItem(accessKey),
        refreshToken: localStorage.getItem(refreshKey),
      };
    },
    { accessKey: ACCESS_TOKEN_KEY, refreshKey: REFRESH_TOKEN_KEY }
  );
  expect(afterLogout.accessToken).toBeNull();
  expect(afterLogout.refreshToken).toBeNull();
});
