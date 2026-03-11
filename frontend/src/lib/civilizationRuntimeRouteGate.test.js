import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildCivilizationWriteRoute, CIVILIZATION_RUNTIME_PRIMARY_PREFIX } from "./civilizationRuntimeRouteGate";
import {
  buildCivilizationCreateUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationMineralMutateUrl,
  buildCivilizationMutateUrl,
} from "./dataverseApi";

describe("civilizationRuntimeRouteGate", () => {
  it("keeps canonical civilization-only routes for write operations", () => {
    const base = "http://127.0.0.1:8000";

    expect(buildCivilizationWriteRoute(base, { operation: "create" })).toBe(`${base}/civilizations`);
    expect(
      buildCivilizationWriteRoute(base, {
        operation: "mutate",
        civilizationId: "civilization-1",
      })
    ).toBe(`${base}/civilizations/civilization-1/mutate`);
    expect(
      buildCivilizationWriteRoute(base, {
        operation: "extinguish",
        civilizationId: "civilization-1",
      })
    ).toBe(`${base}/civilizations/civilization-1/extinguish`);
    expect(
      buildCivilizationWriteRoute(base, {
        operation: "mutate_mineral",
        civilizationId: "civilization-1",
        mineralKey: "amount",
      })
    ).toBe(`${base}/civilizations/civilization-1/minerals/amount`);
  });

  it("freezes primary runtime prefix to civilization canonical path", () => {
    expect(CIVILIZATION_RUNTIME_PRIMARY_PREFIX).toBe("/civilizations");
  });

  it("guards write controller against moon alias fallback regressions", () => {
    const controllerPath = fileURLToPath(new URL("../components/universe/useMoonCrudController.js", import.meta.url));
    const source = readFileSync(controllerPath, "utf-8");

    expect(source).toContain("buildCivilizationWriteRoute");
    expect(source).not.toContain("shouldFallbackToMoonAlias");
    expect(source).not.toContain("buildCivilizationWriteRouteCandidates");
  });

  it("freezes route inventory parity for canonical write endpoints", () => {
    const base = "http://127.0.0.1:8000";
    const civilizationId = "civilization-1";

    expect(buildCivilizationWriteRoute(base, { operation: "create" })).toBe(buildCivilizationCreateUrl(base));
    expect(buildCivilizationWriteRoute(base, { operation: "mutate", civilizationId })).toBe(
      buildCivilizationMutateUrl(base, civilizationId)
    );
    expect(buildCivilizationWriteRoute(base, { operation: "extinguish", civilizationId })).toBe(
      buildCivilizationExtinguishUrl(base, civilizationId)
    );
    expect(
      buildCivilizationWriteRoute(base, {
        operation: "mutate_mineral",
        civilizationId,
        mineralKey: "amount",
      })
    ).toBe(buildCivilizationMineralMutateUrl(base, civilizationId, "amount"));
  });
});
