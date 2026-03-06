import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";

function buildWorkspaceName() {
  return `E2E Workspace ${Date.now()}`;
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function ensureWorkspaceEntered(page) {
  const workspaceEntry = page.getByTestId("workspace-open-star-heart-button").first();
  const galaxyGate = page.getByTestId("galaxy-gate-screen").first();

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isVisible(workspaceEntry)) return;

    if (await isVisible(galaxyGate)) {
      const enterButton = page.getByTestId("galaxy-enter-button").first();
      if (await isVisible(enterButton)) {
        if (await enterButton.isEnabled()) {
          await enterButton.click();
        }
      }

      const createButton = page.getByTestId("galaxy-create-submit").first();
      if (await isVisible(createButton)) {
        const createInput = page.getByTestId("galaxy-create-input").first();
        const value = String((await createInput.inputValue()) || "").trim();
        if (!value) {
          await createInput.fill(buildWorkspaceName());
        }
        if (await createButton.isEnabled()) {
          await createButton.click();
        }
      }

      const launchButton = page.getByTestId("galaxy-launch-submit").first();
      if (await isVisible(launchButton)) {
        const launchInput = page.getByTestId("galaxy-launch-input").first();
        const value = String((await launchInput.inputValue()) || "").trim();
        if (!value) {
          await launchInput.fill(buildWorkspaceName());
        }
        if (await launchButton.isEnabled()) {
          await launchButton.click();
        }
      }
    }

    await page.waitForTimeout(350);
  }

  throw new Error("Workspace entry timeout: neither workspace shell nor stable galaxy gate transition completed.");
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

async function clickViaDom(locator) {
  await locator.evaluate((element) => {
    element.click();
  });
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

  await page.goto("/");
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(user.password);
  await page.getByTestId("auth-submit-button").click();

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
  const presetButton = page.getByTestId("stage0-preset-personal_cashflow");
  await expect(presetButton).toBeEnabled({ timeout: 30_000 });
  await clickViaDom(presetButton);

  const schemaKeys = ["transactionName", "amount", "transactionType"];
  for (const key of schemaKeys) {
    const button = page.getByTestId(`stage0-schema-add-${key}`);
    await expect(button).toBeEnabled({ timeout: 30_000 });
    await clickViaDom(button);
  }

  const igniteButton = page.getByTestId("stage0-ignite-core-button");
  await expect(igniteButton).toBeEnabled({ timeout: 30_000 });
  await clickViaDom(igniteButton);

  await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 60_000 });

  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("quick-grid-columns-badge")).toContainText("sloupce", { timeout: 10_000 });
});
