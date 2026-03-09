import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace, createCivilizationRow, ensureGridOpen } from "./workspace-flow.helpers.mjs";

test("planet+civilization+mineral workflow: create two rows, write minerals, archive one", async ({
  page,
  request,
}) => {
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

  await expect(page.getByTestId("quick-grid-workflow-rail")).toBeVisible({ timeout: 30_000 });
  const initialCount = await page.getByTestId("quick-grid-row").count();

  const rowA = `WF-A-${Date.now()}`;
  const rowB = `WF-B-${Date.now()}`;

  await createCivilizationRow(page, rowA);
  await createCivilizationRow(page, rowB);

  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(initialCount + 2);

  const rowALocator = page.getByTestId("quick-grid-row").filter({ hasText: rowA }).first();
  const rowBLocator = page.getByTestId("quick-grid-row").filter({ hasText: rowB }).first();
  await expect(rowALocator).toBeVisible({ timeout: 30_000 });
  await expect(rowBLocator).toBeVisible({ timeout: 30_000 });

  await rowALocator.click();
  await page.getByPlaceholder("Nerost / sloupec").fill("amount");
  await page.getByPlaceholder("Hodnota (prazdne = remove_soft)").fill("1200");
  await page.getByRole("button", { name: "Ulozit nerost" }).click();
  await expect(page.getByTestId("quick-grid-write-feedback")).toContainText("Nerost", { timeout: 30_000 });

  await rowBLocator.click();
  await page.getByPlaceholder("Nerost / sloupec").fill("state");
  await page.getByPlaceholder("Hodnota (prazdne = remove_soft)").fill("active");
  await page.getByRole("button", { name: "Ulozit nerost" }).click();
  await expect(page.getByTestId("quick-grid-write-feedback")).toContainText("Nerost", { timeout: 30_000 });

  const countBeforeArchive = await page.getByTestId("quick-grid-row").count();
  await rowALocator.click();
  await page.getByRole("button", { name: "Archivovat civilizaci" }).click();
  await expect(page.getByTestId("quick-grid-write-feedback")).toContainText("archiv", { timeout: 30_000 });

  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBe(Math.max(0, countBeforeArchive - 1));
});
