import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildParserPayload } from "./dataverseApi";
import {
  buildBuilderParserCommand,
  buildExtinguishMoonCommand,
  buildIngestMoonCommand,
  buildLinkMoonsCommand,
  buildTypeMoonsCommand,
} from "./builderParserCommand";
import {
  PARSER_CONTRACT_SCOPE,
  PARSER_CONTRACT_VERSION,
  PARSER_EXECUTE_ENDPOINT_SIGNATURES,
  PARSER_FE_BUILDER_ACTIONS,
  PARSER_V1_DOC,
  PARSER_V2_SPEC_DOC,
  parserContractDiff,
} from "./parserContract";

function hasControlChars(text) {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(String(text || ""));
}

describe("parser contract FE freeze gate", () => {
  it("keeps parser v1/v2 contract envelope and docs anchored", () => {
    const v1Path = fileURLToPath(new URL("../../../docs/contracts/parser-v1.md", import.meta.url));
    const v2Path = fileURLToPath(new URL("../../../docs/contracts/parser-v2-spec.md", import.meta.url));
    const v1 = readFileSync(v1Path, "utf-8");
    const v2 = readFileSync(v2Path, "utf-8");

    expect(PARSER_CONTRACT_VERSION).toBe("1.0.0");
    expect(PARSER_CONTRACT_SCOPE).toBe("parser-v1-v2-fe-freeze");
    expect(PARSER_V1_DOC).toBe("docs/contracts/parser-v1.md");
    expect(PARSER_V2_SPEC_DOC).toBe("docs/contracts/parser-v2-spec.md");
    expect(v1).toContain("## Deterministic parse order");
    expect(v1).toContain("## Metadata in parentheses");
    expect(v2).toContain("## 3. Grammar (EBNF)");
    expect(v2).toContain("## 4. Operator semantics (syntax level)");
    expect(v2).toContain("## 6. Diagnostic codes");
  });

  it("keeps parser execute endpoint and payload defaults aligned with API contract", () => {
    expect(PARSER_EXECUTE_ENDPOINT_SIGNATURES).toEqual(["POST /parser/execute"]);
    expect(buildParserPayload("A + B")).toEqual({
      query: "A + B",
      parser_version: "v2",
    });
    expect(buildParserPayload("A + B", "g-1", "br-1")).toEqual({
      query: "A + B",
      parser_version: "v2",
      galaxy_id: "g-1",
      branch_id: "br-1",
    });
  });

  it("keeps FE parser builders compatible with parser v2 operator semantics and v1 compatibility", () => {
    expect(PARSER_FE_BUILDER_ACTIONS).toEqual([
      "LINK_MOONS",
      "TYPE_MOONS",
      "EXTINGUISH_MOON",
      "INGEST_MOON",
    ]);

    const link = buildLinkMoonsCommand({ sourceLabel: "A", targetLabel: "B" });
    const type = buildTypeMoonsCommand({ sourceLabel: "A", targetLabel: "B" });
    const extinguish = buildExtinguishMoonCommand({ asteroidLabel: "Moon Prime" });
    const ingest = buildIngestMoonCommand({
      value: "Invoice 2026-03",
      tableName: "Finance > Cashflow",
      metadata: { amount: 1250, status: "paid" },
    });

    expect(link).toBe("A + B");
    expect(type).toBe("A : B");
    expect(extinguish).toBe('Delete : "Moon Prime"');
    expect(ingest).toBe('"Invoice 2026-03" (table: Finance > Cashflow, amount: 1250, status: paid)');
    expect(hasControlChars(link)).toBe(false);
    expect(hasControlChars(type)).toBe(false);
    expect(hasControlChars(extinguish)).toBe(false);
    expect(hasControlChars(ingest)).toBe(false);
    expect(buildBuilderParserCommand({ type: "LINK_MOONS", sourceLabel: "A", targetLabel: "B" })).toBe("A + B");
    expect(buildBuilderParserCommand({ type: "TYPE_MOONS", sourceLabel: "A", targetLabel: "B" })).toBe("A : B");
    expect(buildBuilderParserCommand({ type: "EXTINGUISH_MOON", asteroidLabel: "A" })).toBe("Delete : A");
    expect(buildBuilderParserCommand({ type: "INGEST_MOON", value: "A", tableName: "Core > Planet" })).toBe(
      "A (table: Core > Planet)"
    );
  });

  it("keeps parser v2 operator inventory frozen in FE", () => {
    const report = parserContractDiff();
    expect(report.parser_v2_operators.missing_in_fe).toEqual([]);
    expect(report.parser_v2_operators.extra_in_fe).toEqual([]);
  });
});
