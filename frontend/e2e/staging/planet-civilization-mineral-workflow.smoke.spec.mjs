import { expect, test } from "@playwright/test";
import { isArchiveOperationAcknowledged } from "../../src/lib/archiveWorkflowGuard";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import {
  createCivilizationRow,
  ensureGridOpen,
  ensureWorkspaceEntered,
  assertNoContractViolation,
  readWriteFeedback,
  ensureWorkspaceReadyForGrid,
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

async function readWriteFeedbackSafe(page) {
  const feedback = page.getByTestId("quick-grid-write-feedback");
  const visible = await feedback.isVisible().catch(() => false);
  if (!visible) return "";
  return String((await feedback.textContent().catch(() => "")) || "").trim();
}

async function writeMineralAndWaitAck(page, { rowValue, key, value, timeoutMs = 30_000 }) {
  await selectGridRowByValue(page, rowValue);
  const mineralComposer = page.getByTestId("quick-grid-mineral-composer");
  await expect(mineralComposer).toContainText(String(rowValue), { timeout: 15_000 });
  const mineralsPanel = page.getByTestId("quick-grid-minerals-panel");
  const normalizedKey = String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const normalizedValue = String(value ?? "").trim();
  const keyInput = mineralsPanel.getByPlaceholder("Nerost / sloupec");
  const valueInput = mineralsPanel.getByPlaceholder("Hodnota (prazdne = remove_soft)");
  await keyInput.fill(normalizedKey);
  await valueInput.fill(normalizedValue);
  await expect(keyInput).toHaveValue(normalizedKey, { timeout: 10_000 });
  await expect(valueInput).toHaveValue(normalizedValue, { timeout: 10_000 });
  const saveButton = mineralsPanel.getByRole("button", { name: "Ulozit nerost" });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  const mineralRouteFragment = `/minerals/${encodeURIComponent(normalizedKey)}`;
  await Promise.all([
    page.waitForResponse(
      (response) => {
        const method = response.request().method().toUpperCase();
        if (method !== "PATCH") return false;
        const url = response.url();
        if (!url.includes(mineralRouteFragment)) return false;
        return response.ok();
      },
      { timeout: timeoutMs }
    ),
    saveButton.click(),
  ]);
  const mineralFilterInput = mineralsPanel.getByPlaceholder("Filtr nerostu...");
  await mineralFilterInput.fill(normalizedKey);
  const mineralItem = page.getByTestId(`quick-grid-mineral-item-${normalizedKey}`).first();
  await expect
    .poll(
      async () => {
        await selectGridRowByValue(page, rowValue);
        const composerText = await mineralComposer.textContent();
        if (!String(composerText || "").includes(String(rowValue))) return false;
        await mineralFilterInput.fill(normalizedKey);
        const itemVisible = await mineralItem.isVisible().catch(() => false);
        if (!itemVisible) return false;
        const itemText = String((await mineralItem.textContent().catch(() => "")) || "").toLowerCase();
        const expectedValue = normalizedValue.toLowerCase();
        return itemText.includes(expectedValue);
      },
      { timeout: timeoutMs }
    )
    .toBe(true);
  const feedbackAfter = await assertNoContractViolation(page);
  if (/selhal|chyba|conflict|contract/i.test(String(feedbackAfter || "").toLowerCase())) {
    throw new Error(`Unexpected feedback after mineral write: ${feedbackAfter}`);
  }
  await mineralFilterInput.fill("");
}

test("planet+civilization+mineral workflow: create two rows, write minerals, archive one", async ({
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
    35_000
  );

  await expect(page.getByTestId("quick-grid-workflow-rail")).toBeVisible({ timeout: 30_000 });

  const rowA = `WF-A-${Date.now()}`;
  const rowB = `WF-B-${Date.now()}`;

  await runStep(
    "create-rowA",
    async () => {
      await createCivilizationRow(page, rowA);
    },
    35_000
  );

  await runStep(
    "write-rowA-code",
    async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "code", value: `${rowA}-code`, timeoutMs: 35_000 });
    },
    45_000
  );

  await runStep(
    "create-rowB",
    async () => {
      await createCivilizationRow(page, rowB);
    },
    35_000
  );

  await runStep(
    "write-rowA-amount",
    async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "amount", value: "1200", timeoutMs: 40_000 });
    },
    45_000
  );

  await runStep(
    "write-rowB-category",
    async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowB, key: "category", value: "active", timeoutMs: 40_000 });
    },
    45_000
  );

  await runStep("archive-rowA", async () => {
    const countBeforeArchive = await page.getByTestId("quick-grid-row").count();
    await selectGridRowByValue(page, rowA);
    const civilizationComposer = page.getByTestId("quick-grid-civilization-composer");
    const modeSelect = civilizationComposer.getByRole("combobox").first();
    await modeSelect.selectOption("ARCHIVE");
    await expect(modeSelect).toHaveValue("ARCHIVE", { timeout: 10_000 });
    await page.getByTestId("quick-grid-apply-civilization-composer-button").click();
    await expect
      .poll(
        async () => {
          const feedback = await readWriteFeedback(page);
          const countNow = await page.getByTestId("quick-grid-row").count();
          return isArchiveOperationAcknowledged({
            feedback,
            countNow,
            countBeforeArchive,
          });
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await expect
      .poll(async () => page.getByTestId("quick-grid-row").count(), { timeout: 30_000 })
      .toBeLessThanOrEqual(Math.max(0, countBeforeArchive - 1));
  });
});
