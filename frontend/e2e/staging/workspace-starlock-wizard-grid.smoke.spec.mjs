import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  loginIntoWorkspace,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { clickViaDom, ensureWorkspaceEntered } from "./workspace-flow.helpers.mjs";

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function dragPlanetToCanvas(page) {
  const source = page.getByTestId("stage0-draggable-planet-card");
  const target = page.getByTestId("stage0-drop-zone");

  await expect(source).toBeVisible({ timeout: 20_000 });

  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error("Unable to resolve draggable planet bounding box.");
  }

  const startX = sourceBox.x + sourceBox.width * 0.52;
  const startY = sourceBox.y + sourceBox.height * 0.52;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 24, startY + 24, { steps: 4 });

  await expect(target).toBeVisible({ timeout: 20_000 });
  const targetBox = await target.boundingBox();
  if (!targetBox) {
    throw new Error("Unable to resolve stage0 drop zone bounding box after drag start.");
  }

  const endX = targetBox.x + targetBox.width * 0.55;
  const endY = targetBox.y + targetBox.height * 0.5;

  await page.mouse.move(endX, endY, { steps: 24 });
  await page.mouse.up();
}

test("real workspace flow: star-lock -> first planet wizard -> grid convergence", async ({ page, request }) => {
  test.setTimeout(180_000);
  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  const user = await ensureAuthBootstrapUser(request, apiBase);

  await loginIntoWorkspace(page, user);

  await ensureWorkspaceEntered(page);

  await expect(page.getByTestId("stage0-star-lock-gate")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("stage0-open-star-heart-button").click();

  await expect(page.getByTestId("star-heart-dashboard")).toBeVisible({ timeout: 30_000 });
  const lockButton = page.getByTestId("star-heart-apply-lock-button");
  await lockButton.click();
  await expect(lockButton).toContainText("Jadro uzamceno", { timeout: 30_000 });

  await page.getByTestId("star-heart-close-button").click();

  await expect(page.getByTestId("stage0-intro-gate")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("stage0-open-blueprint-button").click();

  await expect(page.getByTestId("stage0-blueprint-panel")).toBeVisible({ timeout: 30_000 });
  await dragPlanetToCanvas(page);

  await expect(page.getByTestId("stage0-setup-panel")).toBeVisible({ timeout: 60_000 });
  const presetButtons = page.locator('[data-testid^="stage0-preset-"]');
  let selectedPreset = false;
  const preferredPreset = page.getByTestId("stage0-preset-personal_cashflow").first();
  if ((await isVisible(preferredPreset)) && (await preferredPreset.isEnabled())) {
    await clickViaDom(preferredPreset);
    selectedPreset = true;
  } else {
    const presetCount = await presetButtons.count();
    for (let idx = 0; idx < presetCount; idx += 1) {
      const presetButton = presetButtons.nth(idx);
      if (await presetButton.isEnabled()) {
        await clickViaDom(presetButton);
        selectedPreset = true;
        break;
      }
    }
  }
  if (!selectedPreset) {
    throw new Error("No enabled stage0 preset button found.");
  }

  const schemaButtons = page.locator('[data-testid^="stage0-schema-add-"]');
  const schemaCount = await schemaButtons.count();
  for (let idx = 0; idx < Math.min(schemaCount, 3); idx += 1) {
    const button = schemaButtons.nth(idx);
    if (await button.isEnabled()) {
      await clickViaDom(button);
    }
  }

  const igniteButton = page.getByTestId("stage0-ignite-core-button");
  await expect(igniteButton).toBeEnabled({ timeout: 30_000 });
  await clickViaDom(igniteButton);

  await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("quick-grid-workflow-rail")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("quick-grid-workflow-rail")).toContainText("1 planeta OK", { timeout: 30_000 });
  await expect(page.getByTestId("quick-grid-workflow-rail")).toContainText("2 civilizace/mesic", { timeout: 30_000 });

  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page.locator("text=Table contract violation").first()).toHaveCount(0);
  await expect(page.getByTestId("quick-grid-columns-badge")).toContainText("sloupce", { timeout: 10_000 });
});
