import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace, ensureGridOpen } from "./workspace-flow.helpers.mjs";

test.describe("planet-civilization logical-flow smoke", () => {
  test("LF-01..LF-08 core user path is executable", async ({ page, request }) => {
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

    await expect(page.getByTestId("moon-orbit-list")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("quick-grid-semantic-legend")).toContainText("Civilizace");
    await expect(page.getByTestId("quick-grid-semantic-legend")).toContainText("Nerost");

    const rowLabel = `LF-E2E-${Date.now()}`;
    await page.getByPlaceholder("Nova hodnota civilizace...").fill(rowLabel);
    await page.getByRole("button", { name: "Pridat civilizaci" }).click();
    await expect(page.getByTestId("quick-grid-write-feedback")).toContainText("Civilizace");

    await page.getByPlaceholder("Nerost / sloupec").fill("amount");
    await page.getByPlaceholder("Hodnota (prazdne = remove_soft)").fill("42");
    await page.getByRole("button", { name: "Ulozit nerost" }).click();
    await expect(page.getByTestId("quick-grid-write-feedback")).toContainText("Nerost");

    await page.getByTestId("quick-grid-close-button").click();
    await expect(page.getByTestId("quick-grid-overlay")).not.toBeVisible({ timeout: 30_000 });

    await page.getByTestId("workspace-open-command-bar").click();
    await expect(page.getByTestId("workspace-command-bar-modal")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("command-bar-input").fill(`"${rowLabel}"`);
    await page.getByTestId("command-bar-preview-button").click();
    await expect(page.getByText(/Plan uloh:/i)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("command-bar-cancel-button").click();
    await expect(page.getByTestId("workspace-command-bar-modal")).not.toBeVisible({ timeout: 30_000 });
  });
});
