import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import {
  assertFeedbackOk,
  createCivilizationRow,
  ensureGridOpen,
  ensureWorkspaceEntered,
  selectGridRowByValue,
} from "./workspace-flow.helpers.mjs";

test("planet+civilization+mineral quickpath: existing workspace row write without stage0 bootstrap", async ({
  page,
  request,
}) => {
  test.setTimeout(75_000);

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

  await ensureWorkspaceEntered(page);

  const gridOverlay = page.getByTestId("quick-grid-overlay").first();
  if (!(await gridOverlay.isVisible().catch(() => false))) {
    const openGridButton = page.getByTestId("workspace-open-grid-button").first();
    const canOpenGrid =
      (await openGridButton.isVisible().catch(() => false)) && (await openGridButton.isEnabled().catch(() => false));
    test.skip(!canOpenGrid, "Quickpath requires existing converged planet with enabled grid open button.");
  }

  await ensureGridOpen(page);
  await expect(page.getByTestId("quick-grid-workflow-rail")).toBeVisible({ timeout: 30_000 });

  const marker = `QuickPath-${Date.now()}`;
  await createCivilizationRow(page, marker);
  await assertFeedbackOk(page, /civilizace/i, "quickpath-create-civilization");

  await selectGridRowByValue(page, marker);
  await page.getByPlaceholder("Nerost / sloupec").fill("amount");
  await page.getByPlaceholder("Hodnota (prazdne = remove_soft)").fill("7");
  await page.getByRole("button", { name: "Ulozit nerost" }).click();
  await assertFeedbackOk(page, /nerost/i, "quickpath-write-mineral");
});
