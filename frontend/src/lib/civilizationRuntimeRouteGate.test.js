import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildCivilizationWriteRouteCandidates,
  CIVILIZATION_RUNTIME_COMPAT_PREFIX,
  CIVILIZATION_RUNTIME_FALLBACK_STATUSES,
  CIVILIZATION_RUNTIME_PRIMARY_PREFIX,
  shouldFallbackToMoonAlias,
} from "./civilizationRuntimeRouteGate";
import {
  buildCivilizationCreateUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationMineralMutateUrl,
  buildCivilizationMutateUrl,
  buildMoonCreateUrl,
  buildMoonExtinguishUrl,
  buildMoonMineralMutateUrl,
  buildMoonMutateUrl,
} from "./dataverseApi";

describe("civilizationRuntimeRouteGate", () => {
  it("keeps canonical civilization-first route candidates for write operations", () => {
    const base = "http://127.0.0.1:8000";

    const createCandidates = buildCivilizationWriteRouteCandidates(base, { operation: "create" });
    expect(createCandidates).toEqual([`${base}/civilizations`, `${base}/moons`]);

    const mutateCandidates = buildCivilizationWriteRouteCandidates(base, {
      operation: "mutate",
      civilizationId: "civilization-1",
    });
    expect(mutateCandidates).toEqual([
      `${base}/civilizations/civilization-1/mutate`,
      `${base}/moons/civilization-1/mutate`,
    ]);

    const extinguishCandidates = buildCivilizationWriteRouteCandidates(base, {
      operation: "extinguish",
      civilizationId: "civilization-1",
    });
    expect(extinguishCandidates).toEqual([
      `${base}/civilizations/civilization-1/extinguish`,
      `${base}/moons/civilization-1/extinguish`,
    ]);

    const mineralCandidates = buildCivilizationWriteRouteCandidates(base, {
      operation: "mutate_mineral",
      civilizationId: "civilization-1",
      mineralKey: "amount",
    });
    expect(mineralCandidates).toEqual([
      `${base}/civilizations/civilization-1/minerals/amount`,
      `${base}/moons/civilization-1/minerals/amount`,
    ]);
  });

  it("keeps fallback status policy explicit and narrow", () => {
    expect(CIVILIZATION_RUNTIME_PRIMARY_PREFIX).toBe("/civilizations");
    expect(CIVILIZATION_RUNTIME_COMPAT_PREFIX).toBe("/moons");
    expect(CIVILIZATION_RUNTIME_FALLBACK_STATUSES).toEqual([404, 405, 501]);
    expect(shouldFallbackToMoonAlias(404)).toBe(true);
    expect(shouldFallbackToMoonAlias(405)).toBe(true);
    expect(shouldFallbackToMoonAlias(501)).toBe(true);
    expect(shouldFallbackToMoonAlias(422)).toBe(false);
    expect(shouldFallbackToMoonAlias(409)).toBe(false);
  });

  it("guards UniverseWorkspace runtime writes against direct moon-primary regressions", () => {
    const workspacePath = fileURLToPath(new URL("../components/universe/UniverseWorkspace.jsx", import.meta.url));
    const source = readFileSync(workspacePath, "utf-8");

    expect(source).toContain("buildCivilizationWriteRouteCandidates");
    expect(source).toContain("shouldFallbackToMoonAlias");
    expect(source).toContain('operation: "mutate_mineral"');
    expect(source).toContain("mineralKey: metadataKey");
    expect(source).not.toContain("buildMoonCreateUrl(");
    expect(source).not.toContain("buildMoonMutateUrl(");
    expect(source).not.toContain("buildMoonExtinguishUrl(");
  });

  it("freezes route inventory parity for civilization canonical and moon compatibility endpoints", () => {
    const base = "http://127.0.0.1:8000";
    const civilizationId = "civilization-1";

    expect(buildCivilizationWriteRouteCandidates(base, { operation: "create" })).toEqual([
      buildCivilizationCreateUrl(base),
      buildMoonCreateUrl(base),
    ]);
    expect(buildCivilizationWriteRouteCandidates(base, { operation: "mutate", civilizationId })).toEqual([
      buildCivilizationMutateUrl(base, civilizationId),
      buildMoonMutateUrl(base, civilizationId),
    ]);
    expect(buildCivilizationWriteRouteCandidates(base, { operation: "extinguish", civilizationId })).toEqual([
      buildCivilizationExtinguishUrl(base, civilizationId),
      buildMoonExtinguishUrl(base, civilizationId),
    ]);
    expect(
      buildCivilizationWriteRouteCandidates(base, {
        operation: "mutate_mineral",
        civilizationId,
        mineralKey: "amount",
      })
    ).toEqual([
      buildCivilizationMineralMutateUrl(base, civilizationId, "amount"),
      buildMoonMineralMutateUrl(base, civilizationId, "amount"),
    ]);
  });
});
