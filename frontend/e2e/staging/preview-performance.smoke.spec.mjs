import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { bootstrapWorkspace } from "./workspace-flow.helpers.mjs";
import { evaluatePreviewPerformanceBudget } from "../../src/components/universe/scene/performanceBudget.js";

function parseBadgeCount(values, prefix) {
  const text = values.find((entry) =>
    String(entry || "")
      .trim()
      .toLowerCase()
      .startsWith(prefix)
  );
  if (!text) return 0;
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

test("preview performance smoke: workspace stays within performance envelope", async ({ page, request }) => {
  test.setTimeout(180_000);

  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const user = await ensureAuthBootstrapUser(request, apiBase);

  await page.goto("/");
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(user.password);
  await page.getByTestId("auth-submit-button").click();

  await bootstrapWorkspace(page);

  const sidebar = page.locator("aside").filter({ hasText: "SIDEBAR" }).first();
  const badgeTexts = await sidebar.locator("span").allTextContents();

  const planets = parseBadgeCount(badgeTexts, "planety");
  const moons = parseBadgeCount(badgeTexts, "mesice");
  const links = parseBadgeCount(badgeTexts, "vazby");

  const frameStats = await page.evaluate(async () => {
    const samples = [];
    await new Promise((resolve) => {
      let remaining = 120;
      let last = performance.now();
      const tick = (now) => {
        samples.push(now - last);
        last = now;
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((acc, item) => acc + item, 0) / Math.max(1, samples.length);
    const p95Index = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
    return {
      averageMs: avg,
      p95Ms: sorted[p95Index] || 0,
      maxMs: sorted[sorted.length - 1] || 0,
    };
  });

  const strictPerf =
    String(process.env.PLAYWRIGHT_PERF_STRICT || "")
      .trim()
      .toLowerCase() === "1";

  const report = evaluatePreviewPerformanceBudget(
    {
      planetCount: planets,
      moonCount: moons,
      tableLinkCount: links,
      moonLinkCount: links,
      reducedMotion: true,
    },
    {
      observedFrameP95Ms: strictPerf ? frameStats.p95Ms : null,
      maxFrameP95Ms: strictPerf ? 50 : 300,
    }
  );

  expect(frameStats.maxMs).toBeLessThan(1200);
  expect(frameStats.averageMs).toBeLessThan(600);
  expect(
    report.pass,
    `Performance violations: ${report.violations.join(", ")} (stats=${JSON.stringify(frameStats)})`
  ).toBe(true);
});
