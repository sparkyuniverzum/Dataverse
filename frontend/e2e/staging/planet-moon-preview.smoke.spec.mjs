import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import {
  createCivilizationRow,
  ensureGridClosed,
  ensureGridOpen,
  ensureWorkspaceEntered,
  ensureWorkspaceReadyForGrid,
  selectGridRowByValue,
} from "./workspace-flow.helpers.mjs";

async function runStep(label, fn, timeoutMs = 35_000) {
  // eslint-disable-next-line no-console
  console.log(`[e2e-step] ${label}`);
  let timer = null;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Step timeout: ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

test("planet+moon preview smoke: lifecycle write converges to grid and sidebar guidance", async ({ page, request }) => {
  test.setTimeout(180_000);

  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  const user = await ensureAuthBootstrapUser(request, apiBase);

  await runStep("login", async () => {
    await page.goto("/");
    await page.getByTestId("auth-mode-login").click();
    await page.getByTestId("auth-email-input").fill(user.email);
    await page.getByTestId("auth-password-input").fill(user.password);
    await page.getByTestId("auth-submit-button").click();
  });

  await runStep(
    "workspace-ready",
    async () => {
      await ensureWorkspaceEntered(page);
      await ensureWorkspaceReadyForGrid(page);
      await ensureGridOpen(page);
    },
    45_000
  );

  const marker = `PreviewMoon-${Date.now()}`;
  await runStep(
    "create-row",
    async () => {
      await createCivilizationRow(page, marker);
    },
    45_000
  );
  await runStep("select-row", async () => {
    await selectGridRowByValue(page, marker);
  });
  await runStep("close-grid", async () => {
    await ensureGridClosed(page);
  });

  const sidebar = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  await expect(sidebar).toContainText("Vybrana civilizace:", { timeout: 30_000 });
  await expect(sidebar).toContainText(marker, { timeout: 30_000 });
  await expect(sidebar.getByTestId("moon-inspector-card")).toBeVisible({ timeout: 30_000 });

  const builderBlock = sidebar.locator("div").filter({ hasText: "PLANET BUILDER" }).first();
  await expect(builderBlock).toContainText(/Mesic:|Civilizace:/i, { timeout: 30_000 });
});
