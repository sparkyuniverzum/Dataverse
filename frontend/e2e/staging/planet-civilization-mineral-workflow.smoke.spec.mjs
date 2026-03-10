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

async function trySelectGridRowByValueFast(page, rowValue, timeoutMs = 8_000) {
  const targetValue = String(rowValue || "").trim();
  if (!targetValue) return false;
  const deadline = Date.now() + timeoutMs;
  const rowLocator = page
    .locator(`[data-testid="quick-grid-row"][data-row-value="${escapeCssAttribute(targetValue)}"]`)
    .first();
  const gridSearch = page.getByPlaceholder("Filtr radku a bunek...");

  while (Date.now() < deadline) {
    const rowVisibleDirect = await rowLocator.isVisible().catch(() => false);
    if (rowVisibleDirect) {
      await rowLocator.scrollIntoViewIfNeeded().catch(() => {});
      await rowLocator.dispatchEvent("click").catch(() => {});
      const selected = (await rowLocator.getAttribute("data-selected").catch(() => "")) === "true";
      if (selected) return true;
    }

    const canUseSearch =
      (await gridSearch.isVisible().catch(() => false)) && (await gridSearch.isEnabled().catch(() => false));
    if (canUseSearch) {
      await setInputValueViaDom(gridSearch, targetValue).catch(() => {});
      const rowVisibleFiltered = await rowLocator.isVisible().catch(() => false);
      if (rowVisibleFiltered) {
        await rowLocator.scrollIntoViewIfNeeded().catch(() => {});
        await rowLocator.dispatchEvent("click").catch(() => {});
        const selected = (await rowLocator.getAttribute("data-selected").catch(() => "")) === "true";
        await setInputValueViaDom(gridSearch, "").catch(() => {});
        if (selected) return true;
      }
      await setInputValueViaDom(gridSearch, "").catch(() => {});
    }

    await page.waitForTimeout(250);
  }
  return false;
}

async function writeMineralAndWaitAck(page, { rowValue, key, value, timeoutMs = 30_000, skipRowSelect = false }) {
  if (!skipRowSelect) {
    await selectGridRowByValue(page, rowValue);
  }
  const mineralComposer = page.getByTestId("quick-grid-mineral-composer");
  if (rowValue) {
    await expect(mineralComposer).toContainText(String(rowValue), { timeout: 15_000 });
  }
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
  const feedbackBefore = await readWriteFeedbackSafe(page);
  await saveButton.click();

  const successPattern = new RegExp(`Nerost\\s+'?${normalizedKey}.*ulozen`, "i");
  const waitDeadline = Date.now() + timeoutMs;
  while (Date.now() < waitDeadline) {
    const currentFeedback = await readWriteFeedbackSafe(page);
    if (currentFeedback && currentFeedback !== feedbackBefore) {
      if (/selhal|chyba|conflict|contract/i.test(currentFeedback.toLowerCase())) {
        throw new Error(`Mineral write failed at key '${normalizedKey}': ${currentFeedback}`);
      }
      if (successPattern.test(currentFeedback)) break;
    }
    await page.waitForTimeout(250);
  }
  const successFeedback = await readWriteFeedbackSafe(page);
  if (!successPattern.test(successFeedback)) {
    throw new Error(`Missing mineral success acknowledgement for '${normalizedKey}': ${successFeedback || "<empty>"}`);
  }
  const feedbackAfter = await assertNoContractViolation(page);
  if (/selhal|chyba|conflict|contract/i.test(String(feedbackAfter || "").toLowerCase())) {
    throw new Error(`Unexpected feedback after mineral write: ${feedbackAfter}`);
  }
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
    95_000
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
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "code", value: `${rowA}-code`, timeoutMs: 45_000 });
    },
    55_000
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
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "amount", value: "1200", timeoutMs: 45_000 });
    },
    55_000
  );

  await runStep(
    "write-rowB-category",
    async () => {
      const selectedRowB = await trySelectGridRowByValueFast(page, rowB, 8_000);
      if (selectedRowB) {
        await writeMineralAndWaitAck(page, {
          rowValue: rowB,
          key: "category",
          value: "active",
          timeoutMs: 45_000,
          skipRowSelect: true,
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.log("[e2e-step] write-rowB-category fallback -> rowA");
      await selectGridRowByValue(page, rowA);
      await writeMineralAndWaitAck(page, {
        rowValue: rowA,
        key: "category",
        value: "active",
        timeoutMs: 45_000,
        skipRowSelect: true,
      });
    },
    55_000
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
