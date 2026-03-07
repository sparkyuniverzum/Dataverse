import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace, ensureGridOpen } from "./workspace-flow.helpers.mjs";

test("workspace resume preview smoke: selected planet + grid state restore after reload", async ({ page, request }) => {
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

  const sidebar = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  const planetSelect = sidebar.locator("select").first();
  await expect(planetSelect).toBeVisible({ timeout: 30_000 });

  const optionCount = await planetSelect.locator("option").count();
  if (optionCount > 1) {
    const targetOption = planetSelect.locator("option").nth(optionCount - 1);
    const targetValue = String((await targetOption.getAttribute("value")) || "").trim();
    if (targetValue) {
      await planetSelect.selectOption(targetValue);
    }
  }

  await ensureGridOpen(page);
  await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 30_000 });

  const selectedTableBeforeReload = String(await planetSelect.inputValue()).trim();
  expect(selectedTableBeforeReload).not.toBe("");

  await expect
    .poll(
      async () =>
        page.evaluate((expectedTableId) => {
          const keys = Object.keys(window.localStorage).filter((key) => key.startsWith("dv:workspace-ui:v1:"));
          return keys.some((key) => {
            try {
              const raw = window.localStorage.getItem(key);
              if (!raw) return false;
              const parsed = JSON.parse(raw);
              return parsed.selected_table_id === expectedTableId && parsed.quick_grid_open === true;
            } catch {
              return false;
            }
          });
        }, selectedTableBeforeReload),
      { timeout: 30_000 }
    )
    .toBe(true);

  await page.reload();

  await expect(page.getByTestId("workspace-root")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("quick-grid-overlay")).toBeVisible({ timeout: 60_000 });

  const sidebarAfterReload = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  const planetSelectAfterReload = sidebarAfterReload.locator("select").first();
  await expect(planetSelectAfterReload).toHaveValue(selectedTableBeforeReload, { timeout: 30_000 });
});
