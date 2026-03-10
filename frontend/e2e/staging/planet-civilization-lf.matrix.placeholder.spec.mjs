import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import {
  assertNoContractViolation,
  createCivilizationRow,
  ensureGridOpen,
  ensureWorkspaceEntered,
  ensureWorkspaceReadyForGrid,
  readWriteFeedback,
  selectGridRowByValue,
} from "./workspace-flow.helpers.mjs";

async function runStep(label, fn, timeoutMs = 30_000) {
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

async function writeMineralAndWaitAck(page, { rowValue, key, value, timeoutMs = 30_000 }) {
  await selectGridRowByValue(page, rowValue);
  const panel = page.getByTestId("quick-grid-minerals-panel");
  await panel.getByPlaceholder("Nerost / sloupec").fill(key);
  await panel.getByPlaceholder("Hodnota (prazdne = remove_soft)").fill(value);
  const saveButton = panel.getByRole("button", { name: "Ulozit nerost" });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  const feedbackBefore = await readWriteFeedback(page).catch(() => "");
  await saveButton.click();
  await expect
    .poll(
      async () => {
        const feedback = await readWriteFeedback(page).catch(() => "");
        if (!feedback || feedback === feedbackBefore) return false;
        if (/Nerost.*ulozen/i.test(feedback)) return true;
        if (/selhal|chyba|conflict|contract/i.test(feedback)) return true;
        return false;
      },
      { timeout: timeoutMs }
    )
    .toBe(true);
  await assertNoContractViolation(page);
}

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

    await expect(page.getByText(/CIVILIZATION ORBIT/i)).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () => {
          const orbitListVisible = await page
            .getByTestId("moon-orbit-list")
            .isVisible()
            .catch(() => false);
          const emptyStateVisible = await page
            .getByText(/Planeta zatim nema civilizacni zaznamy/i)
            .isVisible()
            .catch(() => false);
          return orbitListVisible || emptyStateVisible;
        },
        { timeout: 30_000 }
      )
      .toBe(true);
    await expect(page.getByTestId("quick-grid-semantic-legend")).toContainText("Civilizace", { timeout: 30_000 });
    await expect(page.getByTestId("quick-grid-semantic-legend")).toContainText("Nerost", { timeout: 30_000 });

    const rowLabel = `LF-E2E-${Date.now()}`;
    await runStep(
      "create-row",
      async () => {
        await createCivilizationRow(page, rowLabel);
      },
      45_000
    );
    await expect(page.getByTestId("moon-orbit-list")).toBeVisible({ timeout: 30_000 });

    await runStep("write-mineral", async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowLabel, key: "amount", value: "42" });
    });

    await page.getByTestId("quick-grid-close-button").click();
    await expect(page.getByTestId("quick-grid-overlay")).not.toBeVisible({ timeout: 30_000 });

    await page.getByTestId("workspace-open-command-bar").click();
    await expect(page.getByTestId("workspace-command-bar-modal")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("command-bar-input").fill(`"${rowLabel}"`);
    await page.getByTestId("command-bar-preview-button").click();
    await expect(page.getByText(/Plan.*loh:/i)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("command-bar-cancel-button").click();
    await expect(page.getByTestId("workspace-command-bar-modal")).not.toBeVisible({ timeout: 30_000 });
  });
});
