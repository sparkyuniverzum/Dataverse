import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  API_V1_CONTRACT_DOC,
  API_V1_CONTRACT_SCOPE,
  API_V1_CONTRACT_VERSION,
  API_V1_AUTH_SESSION_SIGNATURES,
  API_V1_FE_ENDPOINT_SIGNATURES,
  API_V1_FE_HELPER_SIGNATURES,
  API_V1_SOFT_DELETE_ROUTE_PREFIXES,
  API_V1_SOFT_DELETE_SIGNATURES,
  apiV1ContractDiff,
} from "./apiV1Contract";
import {
  buildAsteroidExtinguishUrl,
  buildBondExtinguishUrl,
  buildBranchesUrl,
  buildGalaxyBondsUrl,
  buildGalaxyEventsStreamUrl,
  buildGalaxyExtinguishUrl,
  buildGalaxyMoonsUrl,
  buildGalaxyOnboardingUrl,
  buildGalaxyPlanetsUrl,
  buildImportJobErrorsUrl,
  buildImportJobUrl,
  buildImportRunUrl,
  buildMoonCreateUrl,
  buildMoonDetailUrl,
  buildMoonExtinguishUrl,
  buildMoonListUrl,
  buildMoonMutateUrl,
  buildPresetsApplyUrl,
  buildPresetsCatalogUrl,
  buildCivilizationCreateUrl,
  buildCivilizationDetailUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationListUrl,
  buildCivilizationMutateUrl,
  buildPlanetExtinguishUrl,
  buildSnapshotExportUrl,
  buildSnapshotUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePlanetPhysicsUrl,
  buildStarCorePolicyLockUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildTableContractUrl,
  buildTablesExportUrl,
  buildTablesUrl,
} from "./dataverseApi";

function normalizePath(pathname) {
  return String(pathname || "")
    .replace(/\/contracts\/[^/]+$/, "/contracts/{table_id}")
    .replace(/\/galaxies\/[^/]+\/bonds$/, "/galaxies/{galaxy_id}/bonds")
    .replace(/\/galaxies\/[^/]+\/events\/stream$/, "/galaxies/{galaxy_id}/events/stream")
    .replace(/\/galaxies\/[^/]+\/moons$/, "/galaxies/{galaxy_id}/moons")
    .replace(/\/galaxies\/[^/]+\/onboarding$/, "/galaxies/{galaxy_id}/onboarding")
    .replace(/\/galaxies\/[^/]+\/planets$/, "/galaxies/{galaxy_id}/planets")
    .replace(/\/galaxies\/[^/]+\/star-core\/metrics\/domains$/, "/galaxies/{galaxy_id}/star-core/metrics/domains")
    .replace(/\/galaxies\/[^/]+\/star-core\/physics\/planets$/, "/galaxies/{galaxy_id}/star-core/physics/planets")
    .replace(/\/galaxies\/[^/]+\/star-core\/physics\/profile$/, "/galaxies/{galaxy_id}/star-core/physics/profile")
    .replace(/\/galaxies\/[^/]+\/star-core\/policy\/lock$/, "/galaxies/{galaxy_id}/star-core/policy/lock")
    .replace(/\/galaxies\/[^/]+\/star-core\/policy$/, "/galaxies/{galaxy_id}/star-core/policy")
    .replace(/\/galaxies\/[^/]+\/star-core\/pulse$/, "/galaxies/{galaxy_id}/star-core/pulse")
    .replace(/\/galaxies\/[^/]+\/star-core\/runtime$/, "/galaxies/{galaxy_id}/star-core/runtime")
    .replace(/\/galaxies\/[^/]+\/extinguish$/, "/galaxies/{galaxy_id}/extinguish")
    .replace(/\/civilizations\/[^/]+\/mutate$/, "/civilizations/{civilization_id}/mutate")
    .replace(/\/civilizations\/[^/]+\/extinguish$/, "/civilizations/{civilization_id}/extinguish")
    .replace(/\/civilizations\/[^/]+$/, "/civilizations/{civilization_id}")
    .replace(/\/moons\/[^/]+\/mutate$/, "/moons/{moon_id}/mutate")
    .replace(/\/moons\/[^/]+\/extinguish$/, "/moons/{moon_id}/extinguish")
    .replace(/\/moons\/[^/]+$/, "/moons/{moon_id}")
    .replace(/\/asteroids\/[^/]+\/extinguish$/, "/asteroids/{asteroid_id}/extinguish")
    .replace(/\/bonds\/[^/]+\/extinguish$/, "/bonds/{bond_id}/extinguish")
    .replace(/\/planets\/[^/]+\/extinguish$/, "/planets/{table_id}/extinguish")
    .replace(/\/io\/imports\/[^/]+\/errors$/, "/io/imports/{job_id}/errors")
    .replace(/\/io\/imports\/[^/]+$/, "/io/imports/{job_id}");
}

function signatureFromUrl(urlText, method) {
  const url = new URL(urlText);
  return `${String(method || "GET").toUpperCase()} ${normalizePath(url.pathname)}`;
}

function helperSignaturesFromDataverseApi() {
  const base = "http://127.0.0.1:8000";
  return [
    signatureFromUrl(buildBranchesUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildCivilizationListUrl(base, { galaxyId: "g-1", planetId: "table-1" }), "GET"),
    signatureFromUrl(buildCivilizationDetailUrl(base, "civilization-1", { galaxyId: "g-1" }), "GET"),
    signatureFromUrl(buildTableContractUrl(base, "table-1", "g-1"), "GET"),
    signatureFromUrl(buildGalaxyBondsUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildGalaxyEventsStreamUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildGalaxyMoonsUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildGalaxyOnboardingUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildGalaxyPlanetsUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCoreDomainMetricsUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCorePhysicsProfileUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCorePlanetPhysicsUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCorePolicyUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCorePulseUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildStarCoreRuntimeUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildImportJobUrl(base, "job-1"), "GET"),
    signatureFromUrl(buildImportJobErrorsUrl(base, "job-1"), "GET"),
    signatureFromUrl(buildSnapshotExportUrl(base), "GET"),
    signatureFromUrl(buildTablesExportUrl(base), "GET"),
    signatureFromUrl(buildMoonListUrl(base, { galaxyId: "g-1", planetId: "table-1" }), "GET"),
    signatureFromUrl(buildMoonDetailUrl(base, "moon-1", { galaxyId: "g-1" }), "GET"),
    signatureFromUrl(buildPresetsCatalogUrl(base, "g-1"), "GET"),
    signatureFromUrl(buildSnapshotUrl(base, null, "g-1"), "GET"),
    signatureFromUrl(buildTablesUrl(base, null, "g-1"), "GET"),
    signatureFromUrl(buildAsteroidExtinguishUrl(base, "a-1", { galaxyId: "g-1" }), "PATCH"),
    signatureFromUrl(buildBondExtinguishUrl(base, "b-1", { galaxyId: "g-1" }), "PATCH"),
    signatureFromUrl(buildGalaxyExtinguishUrl(base, "g-1"), "PATCH"),
    signatureFromUrl(buildCivilizationExtinguishUrl(base, "civilization-1"), "PATCH"),
    signatureFromUrl(buildCivilizationMutateUrl(base, "civilization-1"), "PATCH"),
    signatureFromUrl(buildMoonExtinguishUrl(base, "moon-1"), "PATCH"),
    signatureFromUrl(buildMoonMutateUrl(base, "moon-1"), "PATCH"),
    signatureFromUrl(buildPlanetExtinguishUrl(base, "table-1", { galaxyId: "g-1" }), "PATCH"),
    signatureFromUrl(buildStarCorePolicyLockUrl(base, "g-1"), "POST"),
    signatureFromUrl(buildImportRunUrl(base), "POST"),
    signatureFromUrl(buildPresetsApplyUrl(base), "POST"),
    signatureFromUrl(buildCivilizationCreateUrl(base), "POST"),
    signatureFromUrl(buildMoonCreateUrl(base), "POST"),
  ].sort();
}

describe("api v1 FE freeze gate", () => {
  it("matches frozen baseline envelope", () => {
    const baselinePath = fileURLToPath(
      new URL("../../../docs/P0-core/baselines/api-v1-openapi-baseline-v1.json", import.meta.url)
    );
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

    expect(API_V1_CONTRACT_VERSION).toBe("1.0.0");
    expect(API_V1_CONTRACT_SCOPE).toBe("api-v1-openapi-freeze");
    expect(API_V1_CONTRACT_DOC).toBe("docs/P0-core/contracts/api-v1.md");
    expect(baseline.version).toBe(API_V1_CONTRACT_VERSION);
    expect(baseline.scope).toBe(API_V1_CONTRACT_SCOPE);
    expect(baseline.contract_doc).toBe(API_V1_CONTRACT_DOC);
  });

  it("keeps helper endpoint signatures aligned with dataverseApi URL builders", () => {
    const observed = helperSignaturesFromDataverseApi();
    expect(observed).toEqual([...API_V1_FE_HELPER_SIGNATURES].sort());
  });

  it("keeps FE endpoint inventory inside OpenAPI v1 baseline", () => {
    const baselinePath = fileURLToPath(
      new URL("../../../docs/P0-core/baselines/api-v1-openapi-baseline-v1.json", import.meta.url)
    );
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

    const report = apiV1ContractDiff({
      openApiSignatures: baseline?.source_of_truth?.method_path_signatures || [],
      feSignatures: API_V1_FE_ENDPOINT_SIGNATURES,
    });

    expect(report.fe_not_in_openapi).toEqual([]);
  });

  it("locks auth/session lifecycle and soft-delete transport semantics", () => {
    const feSignatures = new Set(API_V1_FE_ENDPOINT_SIGNATURES);
    for (const signature of API_V1_AUTH_SESSION_SIGNATURES) {
      expect(feSignatures.has(signature)).toBe(true);
    }

    const deleteSignatures = API_V1_FE_ENDPOINT_SIGNATURES.filter(
      (signature) =>
        signature.startsWith("DELETE ") &&
        API_V1_SOFT_DELETE_ROUTE_PREFIXES.some((prefix) => signature.includes(` ${prefix}`))
    );
    expect(deleteSignatures).toEqual([]);
    const softDeleteSignatures = API_V1_FE_ENDPOINT_SIGNATURES.filter((signature) => signature.includes("/extinguish"));
    expect([...API_V1_SOFT_DELETE_SIGNATURES].sort()).toEqual(softDeleteSignatures.sort());
  });
});
