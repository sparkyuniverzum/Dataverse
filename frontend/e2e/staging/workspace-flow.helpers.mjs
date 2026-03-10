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

function escapeCssAttribute(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

async function setInputValueViaDom(locator, nextValue) {
  await locator.evaluate((element, value) => {
    element.value = String(value ?? "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, nextValue);
}

export async function clickViaDom(locator) {
  await locator.dispatchEvent("click");
}

export async function readWriteFeedback(page) {
  const feedback = page.getByTestId("quick-grid-write-feedback");
  await expect(feedback).toBeVisible({ timeout: 30_000 });
  return String((await feedback.textContent()) || "").trim();
}

export async function assertNoContractViolation(page) {
  const feedbackText = await readWriteFeedback(page);
  const normalized = feedbackText.toLowerCase();
  if (
    normalized.includes("contract violation") ||
    normalized.includes("required field") ||
    normalized.includes("unikatni pravidlo") ||
    normalized.includes("conflict") ||
    normalized.includes("selhal") ||
    normalized.includes("chyba")
  ) {
    throw new Error(`Workflow blocked by contract/validation issue: ${feedbackText}`);
  }
  return feedbackText;
}

export async function assertFeedbackOk(page, expectedRegex, contextLabel = "workflow step") {
  const feedbackText = await assertNoContractViolation(page);
  if (!expectedRegex.test(feedbackText)) {
    throw new Error(`Unexpected feedback at ${contextLabel}: ${feedbackText}`);
  }
  return feedbackText;
}

export async function ensureWorkspaceEntered(page) {
  await page.waitForLoadState("domcontentloaded");
  const workspaceEntry = page.getByTestId("workspace-open-star-heart-button").first();
  const workspaceRoot = page.getByTestId("workspace-root").first();
  const galaxyGate = page.getByTestId("galaxy-gate-screen").first();
  const stage0StarLockGate = page.getByTestId("stage0-star-lock-gate").first();
  const stage0IntroGate = page.getByTestId("stage0-intro-gate").first();
  const stage0SetupPanel = page.getByTestId("stage0-setup-panel").first();
  const quickGridOverlay = page.getByTestId("quick-grid-overlay").first();
  const authSubmitButton = page.getByTestId("auth-submit-button").first();

  const deadline = Date.now() + 90_000;
  let reloaded = false;
  while (Date.now() < deadline) {
    if (await isVisible(workspaceRoot)) return;
    if (await isVisible(workspaceEntry)) return;
    if (await isVisible(stage0StarLockGate)) return;
    if (await isVisible(stage0IntroGate)) return;
    if (await isVisible(stage0SetupPanel)) return;
    if (await isVisible(quickGridOverlay)) return;

    if (await isVisible(authSubmitButton)) {
      if (await authSubmitButton.isEnabled()) {
        await authSubmitButton.click();
      }
    }

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

    if (!reloaded && Date.now() > deadline - 45_000) {
      await page.reload({ waitUntil: "domcontentloaded" });
      reloaded = true;
      continue;
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
  let presetSelected = false;
  const preferredPreset = page.getByTestId("stage0-preset-personal_cashflow").first();
  if ((await isVisible(preferredPreset)) && (await preferredPreset.isEnabled())) {
    await clickViaDom(preferredPreset);
    presetSelected = true;
  } else {
    const presetCount = await presetButtons.count();
    for (let index = 0; index < presetCount; index += 1) {
      const candidate = presetButtons.nth(index);
      if (await candidate.isEnabled()) {
        await clickViaDom(candidate);
        presetSelected = true;
        break;
      }
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
  await expect(page.getByTestId("quick-grid-workflow-rail")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("quick-grid-workflow-rail")).toContainText("1 planeta OK", { timeout: 30_000 });
  await expect(page.getByTestId("quick-grid-workflow-rail")).toContainText("2 civilizace/mesic", { timeout: 30_000 });
  await expect
    .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page.locator("text=Table contract violation").first()).toHaveCount(0);

  await page.getByTestId("quick-grid-close-button").click();
}

export async function ensureGridOpen(page) {
  const overlay = page.getByTestId("quick-grid-overlay").first();
  if (await isVisible(overlay)) return;
  const openGridButton = page.getByTestId("workspace-open-grid-button").first();
  await expect(openGridButton).toBeVisible({ timeout: 30_000 });
  await expect(openGridButton).toBeEnabled({ timeout: 30_000 });
  await openGridButton.scrollIntoViewIfNeeded().catch(() => {});
  await openGridButton.dispatchEvent("click");
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

export async function ensureWorkspaceReadyForGrid(page) {
  await ensureWorkspaceEntered(page);

  const overlay = page.getByTestId("quick-grid-overlay").first();
  if (await isVisible(overlay)) return;

  const openGridButton = page.getByTestId("workspace-open-grid-button").first();
  const canOpenGrid = (await isVisible(openGridButton)) && (await openGridButton.isEnabled().catch(() => false));
  if (canOpenGrid) return;

  const addPlanetButton = page.getByTestId("workspace-add-planet-button").first();
  const canAddPlanet = (await isVisible(addPlanetButton)) && (await addPlanetButton.isEnabled().catch(() => false));
  if (!canAddPlanet) {
    throw new Error("Workspace is not grid-ready and sidebar add-planet path is not available.");
  }
  await addPlanetButton.dispatchEvent("click");
  await expect
    .poll(
      async () => {
        const openButton = page.getByTestId("workspace-open-grid-button").first();
        return (await isVisible(openButton)) && (await openButton.isEnabled().catch(() => false));
      },
      { timeout: 30_000 }
    )
    .toBe(true);
}

export async function isWorkspaceGridReady(page) {
  const overlay = page.getByTestId("quick-grid-overlay").first();
  if (await isVisible(overlay)) return true;
  const openGridButton = page.getByTestId("workspace-open-grid-button").first();
  return (await isVisible(openGridButton)) && (await openGridButton.isEnabled().catch(() => false));
}

export async function createCivilizationRow(page, valueText) {
  const targetValue = String(valueText || "").trim();
  if (!targetValue) {
    throw new Error("createCivilizationRow requires non-empty valueText.");
  }

  const advancedPanel = page.getByTestId("quick-grid-civilization-advanced").first();
  if (!(await isVisible(advancedPanel))) {
    const toggle = page.getByTestId("quick-grid-civilization-advanced-toggle").first();
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    await toggle.dispatchEvent("click");
    await expect(advancedPanel).toBeVisible({ timeout: 30_000 });
  }

  const createInput = page.getByPlaceholder("Nova hodnota civilizace...");
  await expect(createInput).toBeVisible({ timeout: 30_000 });
  await createInput.fill(valueText);
  const composer = page.getByTestId("quick-grid-civilization-composer");
  const modeSelect = composer.getByRole("combobox").first();
  await modeSelect.selectOption("CREATE");
  const applyButton = page.getByTestId("quick-grid-apply-civilization-composer-button");
  await expect(applyButton).toBeEnabled({ timeout: 15_000 });
  await applyButton.click();
  const writeFeedback = page.getByTestId("quick-grid-write-feedback");
  await expect(writeFeedback).toBeVisible({ timeout: 30_000 });
  const feedbackText = String((await writeFeedback.textContent()) || "");
  const normalizedFeedback = feedbackText.toLowerCase();
  if (
    normalizedFeedback.includes("selhal") ||
    normalizedFeedback.includes("chyba") ||
    normalizedFeedback.includes("contract") ||
    normalizedFeedback.includes("conflict")
  ) {
    throw new Error(`Civilization create failed for '${targetValue}': ${feedbackText}`);
  }

  const gridSearch = page.getByPlaceholder("Filtr radku a bunek...");
  if (await isVisible(gridSearch)) {
    await setInputValueViaDom(gridSearch, targetValue);
  }
  const createdRow = page
    .locator(`[data-testid="quick-grid-row"][data-row-value="${escapeCssAttribute(targetValue)}"]`)
    .first();
  await expect(createdRow).toBeVisible({
    timeout: 30_000,
  });
  await expect(createdRow).toHaveAttribute("data-row-value", targetValue, { timeout: 15_000 });
  if (await isVisible(gridSearch)) {
    await setInputValueViaDom(gridSearch, "");
  }
}

export async function selectGridRowByValue(page, rowValue) {
  const targetValue = String(rowValue || "").trim();
  if (!targetValue) {
    throw new Error("selectGridRowByValue requires non-empty rowValue.");
  }
  const gridSearch = page.getByPlaceholder("Filtr radku a bunek...");
  if (await isVisible(gridSearch)) {
    await setInputValueViaDom(gridSearch, "");
    await setInputValueViaDom(gridSearch, targetValue);
  }
  const row = page
    .locator(`[data-testid="quick-grid-row"][data-row-value="${escapeCssAttribute(targetValue)}"]`)
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await row.dispatchEvent("click");
  await expect(row).toHaveAttribute("data-selected", "true", { timeout: 15_000 });
  await expect(row).toHaveAttribute("data-row-value", targetValue, { timeout: 15_000 });
  if (await isVisible(gridSearch)) {
    await setInputValueViaDom(gridSearch, "");
  }
}
