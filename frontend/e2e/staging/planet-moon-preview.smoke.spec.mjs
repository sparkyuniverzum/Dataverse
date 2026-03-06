import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import {
  bootstrapWorkspace,
  createCivilizationRow,
  ensureGridClosed,
  ensureGridOpen,
} from "./workspace-flow.helpers.mjs";

test("planet+moon preview smoke: lifecycle write converges to grid and sidebar guidance", async ({ page, request }) => {
  test.setTimeout(180_000);

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

  await bootstrapWorkspace(page);
  await ensureGridOpen(page);

  const initialCount = await page.getByTestId("quick-grid-row").count();
  const marker = `PreviewMoon-${Date.now()}`;
  await createCivilizationRow(page, marker);

  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThan(initialCount);

  const insertedRow = page.getByTestId("quick-grid-row").filter({ hasText: marker }).first();
  await expect(insertedRow).toBeVisible({ timeout: 30_000 });
  await insertedRow.click();

  await ensureGridClosed(page);

  const sidebar = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  await expect(sidebar).toContainText("Vybrany mesic:", { timeout: 30_000 });

  const builderBlock = sidebar.locator("div").filter({ hasText: "PLANET BUILDER" }).first();
  await expect(builderBlock).toContainText("Mesic:", { timeout: 30_000 });
});
