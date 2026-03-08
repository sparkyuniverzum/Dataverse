import { expect, test } from "@playwright/test";

import {
  ensureAuthBootstrapUser,
  isApiReachable,
  isBrowserCorsReady,
  resolveApiBase,
  resolveFrontendBase,
} from "./auth-bootstrap.mjs";
import { ensureWorkspaceEntered } from "./workspace-flow.helpers.mjs";

function buildContractAwareMinerals({ requiredFields = [], marker, now }) {
  const minerals = {};
  for (const field of Array.isArray(requiredFields) ? requiredFields : []) {
    const key = String(field || "").trim();
    if (!key) continue;
    if (key === "label") {
      minerals[key] = marker;
      continue;
    }
    if (key === "state") {
      minerals[key] = "active";
      continue;
    }
    if (key === "id" || key.endsWith("_id")) {
      minerals[key] = `id-${now}`;
      continue;
    }
    minerals[key] = `${marker}-${key}`;
  }
  if (!Object.prototype.hasOwnProperty.call(minerals, "entity_id")) {
    minerals.entity_id = `id-${now}`;
  }
  if (!Object.prototype.hasOwnProperty.call(minerals, "label")) {
    minerals.label = marker;
  }
  if (!Object.prototype.hasOwnProperty.call(minerals, "state")) {
    minerals.state = "active";
  }
  return minerals;
}

async function resolveRequiredFields(request, apiBase, accessToken, galaxyId, planetId, branchId = "") {
  const params = new URLSearchParams();
  params.set("galaxy_id", galaxyId);
  if (branchId) {
    params.set("branch_id", branchId);
  }
  const response = await request.get(`${apiBase}/contracts/${planetId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    return ["entity_id", "label", "state"];
  }
  const payload = await response.json().catch(() => ({}));
  const fields = payload?.required_fields;
  return Array.isArray(fields) && fields.length ? fields : ["entity_id", "label", "state"];
}

async function createContractAwareCivilization({
  request,
  apiBase,
  accessToken,
  galaxyId,
  planetId,
  marker,
  branchId = "",
}) {
  const now = Date.now();
  const requiredFields = await resolveRequiredFields(request, apiBase, accessToken, galaxyId, planetId, branchId);
  const minerals = buildContractAwareMinerals({ requiredFields, marker, now });
  const response = await request.post(`${apiBase}/civilizations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    data: {
      planet_id: planetId,
      label: marker,
      minerals,
      galaxy_id: galaxyId,
      ...(branchId ? { branch_id: branchId } : {}),
      idempotency_key: `${branchId ? "branch" : "main"}-moon-${now}`,
    },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Civilization create failed (${response.status()}): ${body || "<empty>"}`);
  }
}

async function createBranchViaApi({ request, apiBase, accessToken, galaxyId, name }) {
  const response = await request.post(`${apiBase}/branches`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    data: {
      name,
      galaxy_id: galaxyId,
    },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Branch create failed (${response.status()}): ${body || "<empty>"}`);
  }
  const payload = await response.json().catch(() => ({}));
  const branchId = String(payload?.id || "").trim();
  if (!branchId) {
    throw new Error("Branch create response is missing id.");
  }
  return {
    id: branchId,
    name: String(payload?.name || name || branchId),
  };
}

async function civilizationExistsInMain({ request, apiBase, accessToken, galaxyId, planetId, marker }) {
  const params = new URLSearchParams();
  params.set("galaxy_id", galaxyId);
  params.set("planet_id", planetId);
  const response = await request.get(`${apiBase}/civilizations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    return false;
  }
  const payload = await response.json().catch(() => ({}));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.some((item) => String(item?.label || item?.value || "").includes(marker));
}

async function seedMainTimeline(request, apiBase, user) {
  const galaxyId = String(user?.defaultGalaxyId || "");
  const accessToken = String(user?.tokens?.access_token || "");
  if (!galaxyId || !accessToken) {
    throw new Error("Auth bootstrap did not provide default galaxy scope.");
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const now = Date.now();
  const createPlanet = await request.post(`${apiBase}/planets`, {
    headers: authHeaders,
    data: {
      name: `Smoke Planet ${now}`,
      archetype: "catalog",
      initial_schema_mode: "empty",
      seed_rows: false,
      galaxy_id: galaxyId,
      idempotency_key: `smoke-planet-${now}`,
    },
  });
  if (!createPlanet.ok()) {
    const body = await createPlanet.text();
    throw new Error(`Planet seed failed (${createPlanet.status()}): ${body || "<empty>"}`);
  }
  const createdPlanet = await createPlanet.json().catch(() => ({}));
  const planetId = String(createdPlanet?.table_id || createdPlanet?.table?.table_id || "").trim();
  if (!planetId) {
    throw new Error("Planet seed response is missing table_id.");
  }

  await createContractAwareCivilization({
    request,
    apiBase,
    accessToken,
    galaxyId,
    planetId,
    marker: `Seed-${now}`,
  });
  return { galaxyId, planetId };
}

test("branch scope smoke: create branch -> write row -> promote -> main convergence", async ({ page, request }) => {
  test.setTimeout(180_000);

  const apiBase = resolveApiBase();
  const frontendBase = resolveFrontendBase();
  const reachable = await isApiReachable(request, apiBase);
  test.skip(!reachable, `API ${apiBase} is not reachable in this environment.`);
  const corsReady = await isBrowserCorsReady(request, apiBase, frontendBase);
  test.skip(!corsReady, `CORS from ${frontendBase} to ${apiBase} is not enabled in this environment.`);

  const user = await ensureAuthBootstrapUser(request, apiBase);
  const seeded = await seedMainTimeline(request, apiBase, user);

  await page.goto("/");
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(user.password);
  await page.getByTestId("auth-submit-button").click();

  await ensureWorkspaceEntered(page);

  const branch = await createBranchViaApi({
    request,
    apiBase,
    accessToken: user.tokens.access_token,
    galaxyId: seeded.galaxyId,
    name: `smoke-branch-${Date.now()}`,
  });
  await page.reload();
  await ensureWorkspaceEntered(page);

  const branchSelect = page.getByTestId("workspace-branch-select");
  await expect.poll(async () => (await branchSelect.locator(`option[value="${branch.id}"]`).count()) > 0).toBe(true);
  await branchSelect.selectOption(branch.id);
  await expect.poll(async () => String((await branchSelect.inputValue()) || "")).toBe(branch.id);
  const selectedBranchId = String((await branchSelect.inputValue()) || "").trim();
  expect(selectedBranchId).not.toBe("");

  const marker = `BranchRow-${Date.now()}`;
  await createContractAwareCivilization({
    request,
    apiBase,
    accessToken: user.tokens.access_token,
    galaxyId: seeded.galaxyId,
    planetId: seeded.planetId,
    marker,
    branchId: selectedBranchId,
  });

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByTestId("workspace-branch-promote-button").click();

  await expect(page.getByTestId("branch-promote-summary")).toContainText("promotnut", { timeout: 30_000 });
  await expect.poll(async () => String((await branchSelect.inputValue()) || "")).toBe("");
  await expect
    .poll(
      async () =>
        civilizationExistsInMain({
          request,
          apiBase,
          accessToken: user.tokens.access_token,
          galaxyId: seeded.galaxyId,
          planetId: seeded.planetId,
          marker,
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
});
