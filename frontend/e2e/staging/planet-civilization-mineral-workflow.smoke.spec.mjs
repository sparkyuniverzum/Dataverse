import { expect, test } from "@playwright/test";
import { isArchiveOperationAcknowledged } from "../../src/lib/archiveWorkflowGuard";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  loginIntoWorkspace,
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
  const stepPromise = Promise.resolve().then(fn);
  // Keep late rejections from the losing race branch out of unhandled rejection noise.
  stepPromise.catch(() => {});
  try {
    return await Promise.race([
      stepPromise,
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WRITE_FAILURE_PATTERN =
  /selhal|chyba|conflict|contract|neni v aktualni projekci|není v aktuální projekci|neni vybrana|není vybrána|neni povolena|není povolena|nelze|blocked|failed|error|offline|pozastavene/i;

function isWriteFailureFeedback(value) {
  return WRITE_FAILURE_PATTERN.test(String(value || "").toLowerCase());
}

function extractCivilizationIdFromPatchUrl(url) {
  const match = String(url || "").match(/\/(?:civilizations|moons)\/([^/?#]+)/i);
  if (!match) return "";
  try {
    return decodeURIComponent(String(match[1] || "")).trim();
  } catch {
    return String(match[1] || "").trim();
  }
}

function createPatchMutationTracker(page, { civilizationId = "" } = {}) {
  const targetCivilizationId = String(civilizationId || "").trim();
  const events = [];
  const handler = (response) => {
    try {
      const request = response.request();
      if (String(request.method() || "").toUpperCase() !== "PATCH") return;
      const url = String(response.url() || "");
      if (!/\/(civilizations|moons)\//.test(url)) return;
      if (targetCivilizationId) {
        const urlCivilizationId = extractCivilizationIdFromPatchUrl(url);
        if (!urlCivilizationId || urlCivilizationId !== targetCivilizationId) return;
      }
      events.push({
        url,
        status: Number(response.status()),
        ok: response.ok(),
      });
    } catch {
      // Ignore tracker sampling failures; they should not mask the real workflow error.
    }
  };
  page.on("response", handler);
  return {
    dispose() {
      page.off("response", handler);
    },
    snapshot() {
      return {
        count: events.length,
        sawOk: events.some((item) => item.ok),
        last: events.length ? events[events.length - 1] : null,
      };
    },
  };
}

async function setInputValueViaDom(locator, nextValue) {
  await locator.evaluate((element, value) => {
    element.value = String(value ?? "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, nextValue);
}

async function clearGridSearchQuery(page) {
  const gridSearch = page.getByPlaceholder("Filtr radku a bunek...");
  const canUseSearch =
    (await gridSearch.isVisible().catch(() => false)) && (await gridSearch.isEnabled().catch(() => false));
  if (!canUseSearch) return;
  await setInputValueViaDom(gridSearch, "").catch(() => {});
}

async function readVisibleRowValues(page, limit = 12) {
  const rows = page.getByTestId("quick-grid-row");
  const count = await rows.count();
  const values = [];
  for (let index = 0; index < Math.min(count, limit); index += 1) {
    const value = await rows
      .nth(index)
      .getAttribute("data-row-value")
      .catch(() => "");
    values.push(String(value || "<empty>").trim() || "<empty>");
  }
  return values;
}

async function waitForRowCountAtLeast(page, minRows, timeoutMs = 25_000) {
  await expect
    .poll(
      async () => {
        await clearGridSearchQuery(page);
        return page.getByTestId("quick-grid-row").count();
      },
      { timeout: timeoutMs }
    )
    .toBeGreaterThanOrEqual(minRows);
}

async function ensureRowSelectable(page, rowValue, timeoutMs = 20_000) {
  const targetValue = String(rowValue || "").trim();
  if (!targetValue) {
    throw new Error("ensureRowSelectable requires non-empty rowValue.");
  }
  const deadline = Date.now() + timeoutMs;
  let refreshAttempts = 0;
  while (Date.now() < deadline) {
    await clearGridSearchQuery(page);
    const selected = await trySelectGridRowByValueFast(page, targetValue, 2_000);
    if (selected) return;

    if (refreshAttempts < 2) {
      const refreshButton = page.getByRole("button", { name: "Obnovit" }).first();
      const refreshVisible = await refreshButton.isVisible().catch(() => false);
      const refreshEnabled = refreshVisible && (await refreshButton.isEnabled().catch(() => false));
      if (refreshEnabled) {
        await refreshButton.dispatchEvent("click").catch(() => {});
        refreshAttempts += 1;
      }
    }
    await page.waitForTimeout(250);
  }
  const visibleRows = await readVisibleRowValues(page);
  throw new Error(`Unable to select row '${targetValue}'. visible_rows=[${visibleRows.join(", ")}]`);
}

async function waitForBusyCycle(saveButton, timeoutMs = 1_500) {
  const deadline = Date.now() + timeoutMs;
  let busySeen = false;
  while (Date.now() < deadline) {
    const disabled = await saveButton.isDisabled().catch(() => false);
    if (disabled) busySeen = true;
    if (busySeen && !disabled) return true;
    await saveButton.page().waitForTimeout(100);
  }
  return false;
}

async function waitForArchiveAcknowledgement(page, { countBeforeArchive, timeoutMs = 8_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const feedback = await readWriteFeedbackSafe(page);
    const countNow = await page.getByTestId("quick-grid-row").count();
    if (isArchiveOperationAcknowledged({ feedback, countNow, countBeforeArchive })) {
      return { ok: true, feedback, countNow };
    }
    if (feedback && isWriteFailureFeedback(feedback)) {
      return {
        ok: false,
        failure: `Archive failed by feedback: ${feedback}`,
        feedback,
        countNow,
      };
    }
    await page.waitForTimeout(250);
  }
  const feedback = await readWriteFeedbackSafe(page);
  const countNow = await page.getByTestId("quick-grid-row").count();
  return {
    ok: false,
    failure: "Archive acknowledgement timeout",
    feedback,
    countNow,
  };
}

async function applyArchiveWithFallback(page, { countBeforeArchive, timeoutMs = 30_000 }) {
  const civilizationComposer = page.getByTestId("quick-grid-civilization-composer");
  const modeSelect = civilizationComposer.getByRole("combobox").first();
  await modeSelect.selectOption("ARCHIVE");
  await expect(modeSelect).toHaveValue("ARCHIVE", { timeout: 10_000 });

  const applyButton = page.getByTestId("quick-grid-apply-civilization-composer-button");
  await expect(applyButton).toBeVisible({ timeout: 10_000 });
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });

  const advancedPanel = page.getByTestId("quick-grid-civilization-advanced").first();
  const advancedVisible = await advancedPanel.isVisible().catch(() => false);
  if (!advancedVisible) {
    const toggle = page.getByTestId("quick-grid-civilization-advanced-toggle").first();
    await toggle.dispatchEvent("click").catch(() => {});
    await expect(advancedPanel).toBeVisible({ timeout: 10_000 });
  }
  const directArchiveButton = page.getByRole("button", { name: "Archivovat civilizaci" }).first();

  const deadline = Date.now() + timeoutMs;
  const attempts = [
    {
      label: "composer-click",
      run: async () => {
        await applyButton.scrollIntoViewIfNeeded().catch(() => {});
        await applyButton.click({ timeout: 4_000 });
      },
    },
    {
      label: "composer-dom-click",
      run: async () => {
        await applyButton.dispatchEvent("click");
      },
    },
    {
      label: "direct-click",
      run: async () => {
        await directArchiveButton.scrollIntoViewIfNeeded().catch(() => {});
        await directArchiveButton.click({ timeout: 4_000 });
      },
    },
    {
      label: "direct-dom-click",
      run: async () => {
        await directArchiveButton.dispatchEvent("click");
      },
    },
  ];

  const attemptFailures = [];
  for (const attempt of attempts) {
    if (Date.now() >= deadline) break;
    try {
      await attempt.run();
    } catch (error) {
      attemptFailures.push(`${attempt.label}: submit failed (${error?.message || "unknown"})`);
      continue;
    }
    const remaining = Math.max(1_500, deadline - Date.now());
    const ack = await waitForArchiveAcknowledgement(page, {
      countBeforeArchive,
      timeoutMs: Math.min(7_000, remaining),
    });
    if (ack.ok) return;
    attemptFailures.push(
      `${attempt.label}: ${ack.failure}; feedback=${ack.feedback || "<empty>"} count=${ack.countNow}`
    );
  }

  const finalFeedback = await readWriteFeedbackSafe(page);
  const finalCount = await page.getByTestId("quick-grid-row").count();
  throw new Error(
    `Archive apply failed after fallback chain: ${attemptFailures.join(" | ")} | final_feedback=${finalFeedback || "<empty>"} final_count=${finalCount}`
  );
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
  const targetRowLocator = rowValue
    ? page.locator(`[data-testid="quick-grid-row"][data-row-value="${escapeCssAttribute(String(rowValue))}"]`).first()
    : page.locator('[data-testid="quick-grid-row"][data-selected="true"]').first();
  const targetRowId = String((await targetRowLocator.getAttribute("data-row-id").catch(() => "")) || "").trim();
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
  const successPattern = new RegExp(
    `Nerost(?:\\s+'?${escapeRegExp(normalizedKey)}.*?)?\\s+.*ulozen|Nerost byl ulozen`,
    "i"
  );
  const successValuePattern = new RegExp(escapeRegExp(normalizedValue), "i");
  const mineralFact = page.getByTestId(`quick-grid-mineral-item-${normalizedKey}`).first();
  const mutationTracker = createPatchMutationTracker(page, { civilizationId: targetRowId });
  const waitDeadline = Date.now() + timeoutMs;
  const noMutationDeadline = Date.now() + Math.min(12_000, Math.max(6_000, Math.floor(timeoutMs * 0.35)));
  let submitTriggered = false;
  let busyCycleSeen = false;
  let unexpectedFeedback = "";
  const attempts = [
    {
      label: "enter",
      run: async () => {
        await valueInput.focus();
        await valueInput.press("Enter");
      },
    },
    {
      label: "click",
      run: async () => {
        await saveButton.click();
      },
    },
    {
      label: "dom-click",
      run: async () => {
        await saveButton.dispatchEvent("click");
      },
    },
  ];

  try {
    for (const attempt of attempts) {
      const currentFeedback = await readWriteFeedbackSafe(page);
      const mineralFactVisible = await mineralFact.isVisible().catch(() => false);
      const mineralFactText = mineralFactVisible
        ? String((await mineralFact.textContent().catch(() => "")) || "").trim()
        : "";
      if (
        (currentFeedback && currentFeedback !== feedbackBefore && successPattern.test(currentFeedback)) ||
        (mineralFactVisible && successValuePattern.test(mineralFactText))
      ) {
        submitTriggered = true;
        break;
      }

      await attempt.run();
      submitTriggered = true;
      const sawBusyCycle = await waitForBusyCycle(saveButton, 1_800);
      if (sawBusyCycle) {
        busyCycleSeen = true;
        break;
      }
      const postAttemptFeedback = await readWriteFeedbackSafe(page);
      if (
        postAttemptFeedback &&
        postAttemptFeedback !== feedbackBefore &&
        isWriteFailureFeedback(postAttemptFeedback)
      ) {
        throw new Error(
          `Mineral write failed at key '${normalizedKey}' after ${attempt.label}: ${postAttemptFeedback}`
        );
      }
    }

    while (Date.now() < waitDeadline) {
      if (page.isClosed()) {
        throw new Error(`Page closed while waiting mineral write ack for '${normalizedKey}'.`);
      }
      const currentFeedback = await readWriteFeedbackSafe(page);
      if (currentFeedback && currentFeedback !== feedbackBefore) {
        if (isWriteFailureFeedback(currentFeedback)) {
          throw new Error(`Mineral write failed at key '${normalizedKey}': ${currentFeedback}`);
        }
        if (successPattern.test(currentFeedback)) break;
        if (!unexpectedFeedback) {
          unexpectedFeedback = currentFeedback;
        }
      }

      const mineralFactVisible = await mineralFact.isVisible().catch(() => false);
      if (mineralFactVisible) {
        const mineralFactText = String((await mineralFact.textContent().catch(() => "")) || "").trim();
        if (successValuePattern.test(mineralFactText)) {
          break;
        }
      }

      const mutationSnapshot = mutationTracker.snapshot();
      if (!busyCycleSeen && !mutationSnapshot.count && Date.now() >= noMutationDeadline) {
        throw new Error(
          `Mineral write did not trigger PATCH for '${normalizedKey}': feedback=${currentFeedback || "<empty>"}`
        );
      }
      if (unexpectedFeedback && !mutationSnapshot.count && Date.now() >= noMutationDeadline) {
        throw new Error(`Unexpected write feedback for '${normalizedKey}' without mutation: ${unexpectedFeedback}`);
      }
      await page.waitForTimeout(250);
    }

    const successFeedback = await readWriteFeedbackSafe(page);
    const mineralFactVisible = await mineralFact.isVisible().catch(() => false);
    const mineralFactText = mineralFactVisible
      ? String((await mineralFact.textContent().catch(() => "")) || "").trim()
      : "";
    const successByFeedback = Boolean(
      successFeedback && successFeedback !== feedbackBefore && successPattern.test(successFeedback)
    );
    const successByFact = mineralFactVisible && successValuePattern.test(mineralFactText);
    if (!successByFeedback && !successByFact) {
      const mutationSnapshot = mutationTracker.snapshot();
      throw new Error(
        `Missing mineral success acknowledgement for '${normalizedKey}': submitted=${submitTriggered} busy_cycle=${busyCycleSeen} patch_count=${mutationSnapshot.count} patch_ok=${mutationSnapshot.sawOk} last_patch=${mutationSnapshot.last ? `${mutationSnapshot.last.status} ${mutationSnapshot.last.url}` : "<none>"} feedback=${successFeedback || "<empty>"} fact=${mineralFactText || "<missing>"}`
      );
    }
    const feedbackAfter = await assertNoContractViolation(page);
    if (/selhal|chyba|conflict|contract/i.test(String(feedbackAfter || "").toLowerCase())) {
      throw new Error(`Unexpected feedback after mineral write: ${feedbackAfter}`);
    }
  } finally {
    mutationTracker.dispose();
  }
}

test("planet+civilization+mineral workflow: create two rows, write minerals, archive one", async ({
  page,
  request,
}) => {
  // End-to-end flow includes auth bootstrap + 3 writes + archive and can exceed 5 minutes on slower CI/dev machines.
  test.setTimeout(420_000);

  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  const user = await ensureAuthBootstrapUser(request, apiBase);

  await runStep("login", async () => {
    await loginIntoWorkspace(page, user);
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
  await clearGridSearchQuery(page);

  const rowA = `WF-A-${Date.now()}`;
  const rowB = `WF-B-${Date.now()}`;
  const baselineRowCount = await page.getByTestId("quick-grid-row").count();

  await runStep(
    "create-rowA",
    async () => {
      await createCivilizationRow(page, rowA);
      await waitForRowCountAtLeast(page, baselineRowCount + 1, 35_000);
    },
    70_000
  );

  await runStep(
    "write-rowA-code",
    async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "code", value: `${rowA}-code`, timeoutMs: 45_000 });
    },
    70_000
  );

  await runStep(
    "create-rowB",
    async () => {
      await createCivilizationRow(page, rowB);
      await waitForRowCountAtLeast(page, baselineRowCount + 2, 35_000);
    },
    70_000
  );

  await runStep(
    "write-rowA-amount",
    async () => {
      await writeMineralAndWaitAck(page, { rowValue: rowA, key: "amount", value: "1200", timeoutMs: 45_000 });
    },
    70_000
  );

  await runStep(
    "write-rowB-category",
    async () => {
      await ensureRowSelectable(page, rowB, 22_000);
      await writeMineralAndWaitAck(page, {
        rowValue: rowB,
        key: "category",
        value: "active",
        timeoutMs: 35_000,
        skipRowSelect: true,
      });
    },
    80_000
  );

  await runStep(
    "archive-rowA",
    async () => {
      const countBeforeArchive = await page.getByTestId("quick-grid-row").count();
      await selectGridRowByValue(page, rowA);
      await applyArchiveWithFallback(page, { countBeforeArchive, timeoutMs: 30_000 });
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
    },
    95_000
  );
});
