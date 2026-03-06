import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace, ensureGridClosed } from "./workspace-flow.helpers.mjs";

test("preview accessibility smoke: reduced-motion + keyboard core actions", async ({ page, request }) => {
  test.setTimeout(180_000);

  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  await page.emulateMedia({ reducedMotion: "reduce" });

  const user = await ensureAuthBootstrapUser(request, apiBase);

  await page.goto("/");
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(user.password);
  await page.getByTestId("auth-submit-button").click();

  await bootstrapWorkspace(page);

  const workspaceRoot = page.getByTestId("workspace-root");
  await expect(workspaceRoot).toHaveAttribute("data-reduced-motion", "true", { timeout: 30_000 });

  await page.keyboard.press("h");
  await expect(page.getByTestId("star-heart-dashboard")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("star-heart-dashboard")).not.toBeVisible({ timeout: 30_000 });

  const openGridButton = page.getByTestId("workspace-open-grid-button").first();
  if (await openGridButton.isEnabled()) {
    await page.keyboard.press("g");
    await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await ensureGridClosed(page);
  }

  await expect(page.locator("[role='status'][aria-live='polite']").first()).toBeVisible({ timeout: 30_000 });
});
