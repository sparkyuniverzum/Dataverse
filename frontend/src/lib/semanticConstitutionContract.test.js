import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  SEMANTIC_CONSTITUTION_DOC,
  SEMANTIC_CONSTITUTION_SCOPE,
  SEMANTIC_CONSTITUTION_VERSION,
  SEMANTIC_FE_SUPPORTED_OPERATORS,
  SEMANTIC_NO_DELETE_ROUTE_PREFIXES,
  SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES,
  normalizeBranchNameForConstitution,
  relationSemanticV1,
  semanticConstitutionContractDiff,
  typeSemanticV1,
} from "./semanticConstitutionContract";
import {
  buildAsteroidExtinguishUrl,
  buildBondExtinguishUrl,
  buildGalaxyExtinguishUrl,
  buildParserPayload,
  buildPlanetExtinguishUrl,
} from "./dataverseApi";
import { buildExtinguishMoonCommand, buildLinkMoonsCommand, buildTypeMoonsCommand } from "./builderParserCommand";

function routeSignatureFromUrl(urlText, method = "PATCH") {
  const url = new URL(urlText);
  const pathname = url.pathname
    .replace(/\/asteroids\/[^/]+\/extinguish$/, "/asteroids/{asteroid_id}/extinguish")
    .replace(/\/bonds\/[^/]+\/extinguish$/, "/bonds/{bond_id}/extinguish")
    .replace(/\/planets\/[^/]+\/extinguish$/, "/planets/{table_id}/extinguish")
    .replace(/\/galaxies\/[^/]+\/extinguish$/, "/galaxies/{galaxy_id}/extinguish");
  return `${method.toUpperCase()} ${pathname}`;
}

describe("semanticConstitution FE freeze gate", () => {
  it("matches frozen semantic constitution baseline envelope", () => {
    const baselinePath = fileURLToPath(
      new URL("../../../docs/P0-core/baselines/semantic-constitution-baseline-v1.json", import.meta.url)
    );
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

    expect(SEMANTIC_CONSTITUTION_VERSION).toBe("1.0.0");
    expect(SEMANTIC_CONSTITUTION_SCOPE).toBe("semantic-constitution-v1");
    expect(SEMANTIC_CONSTITUTION_DOC).toBe("docs/P0-core/contracts/semantic-constitution-v1.md");
    expect(baseline.version).toBe(SEMANTIC_CONSTITUTION_VERSION);
    expect(baseline.scope).toBe(SEMANTIC_CONSTITUTION_SCOPE);
    expect(baseline.contract_doc).toBe(SEMANTIC_CONSTITUTION_DOC);
  });

  it("keeps parser operator semantics aligned with FE command builders", () => {
    const baselinePath = fileURLToPath(
      new URL("../../../docs/P0-core/baselines/semantic-constitution-baseline-v1.json", import.meta.url)
    );
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    const examples = baseline.source_of_truth.parser_operator_examples;

    expect(buildLinkMoonsCommand({ sourceLabel: "A", targetLabel: "B" })).toBe("A + B");
    expect(relationSemanticV1()).toEqual({
      type: "RELATION",
      directional: false,
      flow_direction: "bidirectional",
    });

    expect(buildTypeMoonsCommand({ sourceLabel: "A", targetLabel: "B" })).toBe("A : B");
    expect(typeSemanticV1()).toEqual({
      type: "TYPE",
      directional: true,
      flow_direction: "source_to_target",
    });

    expect(buildExtinguishMoonCommand({ asteroidLabel: "A" })).toBe("Delete : A");

    const guardianQuery = examples.find((item) => String(item.query || "").includes("Hlídej"))?.query || "";
    expect(buildParserPayload(guardianQuery)).toEqual({
      query: guardianQuery,
      parser_version: "v2",
    });
  });

  it("keeps hard-delete law in FE transport layer (PATCH extinguish only)", () => {
    const signatures = [
      routeSignatureFromUrl(buildAsteroidExtinguishUrl("http://127.0.0.1:8000", "a-1")),
      routeSignatureFromUrl(buildBondExtinguishUrl("http://127.0.0.1:8000", "b-1")),
      routeSignatureFromUrl(buildPlanetExtinguishUrl("http://127.0.0.1:8000", "table-1")),
      routeSignatureFromUrl(buildGalaxyExtinguishUrl("http://127.0.0.1:8000", "g-1")),
    ].sort();

    expect(signatures).toEqual([...SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES].sort());

    const forbiddenDeleteSignatures = signatures.filter((signature) => {
      if (!signature.startsWith("DELETE ")) return false;
      return SEMANTIC_NO_DELETE_ROUTE_PREFIXES.some((prefix) => signature.includes(` ${prefix}`));
    });
    expect(forbiddenDeleteSignatures).toEqual([]);
  });

  it("keeps FE operator inventory and branch normalization aligned", () => {
    const baselinePath = fileURLToPath(
      new URL("../../../docs/P0-core/baselines/semantic-constitution-baseline-v1.json", import.meta.url)
    );
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

    const report = semanticConstitutionContractDiff({
      requiredOperators: ["+", ":", "->", ":=", "-"],
      supportedOperators: SEMANTIC_FE_SUPPORTED_OPERATORS,
      requiredSoftDeleteRoutes: baseline.source_of_truth.soft_delete_extinguish_routes,
      providedSoftDeleteRoutes: SEMANTIC_SOFT_DELETE_ROUTE_SIGNATURES,
    });
    expect(report.operators.missing_in_fe).toEqual([]);
    expect(report.operators.extra_in_fe).toEqual([]);
    expect(report.soft_delete_routes.missing_in_fe).toEqual([]);
    expect(report.soft_delete_routes.extra_in_fe).toEqual([]);

    for (const sample of baseline.source_of_truth.branch_name_normalization_examples) {
      expect(normalizeBranchNameForConstitution(sample.raw)).toBe(sample.normalized);
    }
  });
});
