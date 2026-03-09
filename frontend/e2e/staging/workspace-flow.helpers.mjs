import { expect } from "@playwright/test";

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

export async function clickViaDom(locator) {
  await locator.evaluate((element) => {
    element.click();
  });
}

export async function ensureWorkspaceEntered(page) {
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

export async function ensureStarLocked(page) {
  const starLockGate = page.getByTestId("stage0-star-lock-gate").first();
  if (!(await isVisible(starLockGate))) return;

  await page.getByTestId("stage0-open-star-heart-button").click();
  const dashboard = page.getByTestId("star-heart-dashboard");
  await expect(dashboard).toBeVisible({ timeout: 30_000 });

  const lockButton = page.getByTestId("star-heart-apply-lock-button");
  await lockButton.click();
  await expect(lockButton).toContainText("Jadro uzamceno", { timeout: 30_000 });
  await page.getByTestId("star-heart-close-button").click();
}

export async function ensureFirstPlanetFlowConverged(page) {
  const introGate = page.getByTestId("stage0-intro-gate").first();
  if (!(await isVisible(introGate))) return;

  await page.getByTestId("stage0-open-blueprint-button").click();
  await expect(page.getByTestId("stage0-blueprint-panel")).toBeVisible({ timeout: 30_000 });

  await dragPlanetToCanvas(page);
  await expect(page.getByTestId("stage0-setup-panel")).toBeVisible({ timeout: 60_000 });

  const presetButtons = page.locator('[data-testid^="stage0-preset-"]');
  await expect(presetButtons.first()).toBeVisible({ timeout: 30_000 });
  const presetCount = await presetButtons.count();
  let presetSelected = false;
  for (let index = 0; index < presetCount; index += 1) {
    const candidate = presetButtons.nth(index);
    if (await candidate.isEnabled()) {
      await clickViaDom(candidate);
      presetSelected = true;
      break;
    }
  }
  if (!presetSelected) {
    throw new Error("No enabled stage0 preset button found.");
  }

  const schemaButtons = page.locator('[data-testid^="stage0-schema-add-"]');
  await expect(schemaButtons.first()).toBeVisible({ timeout: 30_000 });
  const schemaCount = await schemaButtons.count();
  let clickedSchemaSteps = 0;
  for (let index = 0; index < schemaCount; index += 1) {
    const candidate = schemaButtons.nth(index);
    if (!(await candidate.isEnabled())) continue;
    await clickViaDom(candidate);
    clickedSchemaSteps += 1;
    if (clickedSchemaSteps >= 3) break;
  }
  if (clickedSchemaSteps < 3) {
    throw new Error(`Expected to apply at least 3 schema steps, applied ${clickedSchemaSteps}.`);
  }

  const igniteButton = page.getByTestId("stage0-ignite-core-button");
  await expect(igniteButton).toBeEnabled({ timeout: 30_000 });
  await clickViaDom(igniteButton);

  await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);

  await page.getByTestId("quick-grid-close-button").click();
}

export async function ensureGridOpen(page) {
  const overlay = page.getByTestId("quick-grid-overlay").first();
  if (await isVisible(overlay)) return;
  const openGridButton = page.getByTestId("workspace-open-grid-button").first();
  await expect(openGridButton).toBeVisible({ timeout: 30_000 });
  await expect(openGridButton).toBeEnabled({ timeout: 30_000 });
  await openGridButton.click();
  await expect(overlay).toBeVisible({ timeout: 30_000 });
}

export async function ensureGridClosed(page) {
  const overlay = page.getByTestId("quick-grid-overlay").first();
  if (!(await isVisible(overlay))) return;
  await page.getByTestId("quick-grid-close-button").click();
  await expect(overlay).not.toBeVisible({ timeout: 30_000 });
}

export async function bootstrapWorkspace(page) {
  await ensureWorkspaceEntered(page);
  await ensureStarLocked(page);
  await ensureFirstPlanetFlowConverged(page);
}

export async function createCivilizationRow(page, valueText) {
  const createInput = page.getByPlaceholder("Nova hodnota civilizace...");
  await expect(createInput).toBeVisible({ timeout: 30_000 });
  await createInput.fill(valueText);
  await page.getByRole("button", { name: "Pridat civilizaci" }).click();
}
