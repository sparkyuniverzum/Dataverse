import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace, ensureGridClosed } from "./workspace-flow.helpers.mjs";

async function resolvePlanetValues(select) {
  return select.evaluate((node) =>
    Array.from(node.options)
      .map((option) => String(option.value || "").trim())
      .filter(Boolean)
  );
}

test("camera focus flow smoke: star focus, planet focus, and grid open/close stay deterministic", async ({
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
  await expect(page.getByTestId("workspace-root")).toBeVisible({ timeout: 60_000 });

  const sidebar = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  const planetSelect = sidebar.locator("select").first();
  await expect(planetSelect).toBeVisible({ timeout: 30_000 });

  const planetValues = await resolvePlanetValues(planetSelect);
  expect(planetValues.length).toBeGreaterThan(0);

  const starHeartButton = page.getByTestId("workspace-open-star-heart-button").first();
  const starHeartDashboard = page.getByTestId("star-heart-dashboard");
  const gridOverlay = page.getByTestId("quick-grid-overlay").first();

  let expectedPlanetValue = String(await planetSelect.inputValue()).trim();
  if (planetValues.length > 1 && !expectedPlanetValue) {
    expectedPlanetValue = planetValues[0];
    await planetSelect.selectOption(expectedPlanetValue);
    await expect(planetSelect).toHaveValue(expectedPlanetValue, { timeout: 20_000 });
  }

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await starHeartButton.click();
    await expect(starHeartDashboard).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("star-heart-close-button").click();
    await expect(starHeartDashboard).not.toBeVisible({ timeout: 30_000 });

    if (planetValues.length > 1) {
      const currentValue = String(await planetSelect.inputValue()).trim();
      const fallback = planetValues[0];
      const nextValue = planetValues.find((value) => value !== currentValue) || fallback;
      expectedPlanetValue = nextValue;
      await planetSelect.selectOption(nextValue);
      await expect(planetSelect).toHaveValue(nextValue, { timeout: 20_000 });
    }

    await page.getByTestId("workspace-open-grid-button").first().click();
    await expect(gridOverlay).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await ensureGridClosed(page);

    await expect(planetSelect).toHaveValue(expectedPlanetValue, { timeout: 20_000 });
    await expect(starHeartButton).toBeVisible({ timeout: 20_000 });
  }

  await expect(page.getByTestId("workspace-root")).toBeVisible({ timeout: 30_000 });
});
