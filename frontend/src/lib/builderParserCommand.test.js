import { describe, expect, it } from "vitest";

import {
  buildBuilderParserCommand,
  buildBuilderParserPayload,
  buildExtinguishCivilizationCommand,
  buildExtinguishMoonCommand,
  buildIngestCivilizationCommand,
  buildIngestMoonCommand,
  buildLinkCivilizationsCommand,
  buildLinkMoonsCommand,
  buildTypeCivilizationsCommand,
  buildTypeMoonsCommand,
  toParserOperand,
} from "./builderParserCommand";

describe("toParserOperand", () => {
  it("keeps uuids and simple identifiers unquoted", () => {
    expect(toParserOperand("4cfa9a4f-84ba-4e89-b8f8-20d6f4d1ab4b")).toBe("4cfa9a4f-84ba-4e89-b8f8-20d6f4d1ab4b");
    expect(toParserOperand("Moon-42")).toBe("Moon-42");
  });

  it("quotes labels with spaces", () => {
    expect(toParserOperand("Moon Prime")).toBe('"Moon Prime"');
  });
});

describe("builder parser commands", () => {
  it("builds link command", () => {
    expect(
      buildLinkMoonsCommand({
        sourceId: "5c76f0ac-6e49-4d66-af64-e279f8ff8a71",
        targetId: "f3193ff1-8223-4ad4-bf01-f914fe318cf1",
      })
    ).toBe("5c76f0ac-6e49-4d66-af64-e279f8ff8a71 + f3193ff1-8223-4ad4-bf01-f914fe318cf1");
  });

  it("builds type command", () => {
    expect(
      buildTypeMoonsCommand({
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A : B");
  });

  it("builds extinguish command", () => {
    expect(buildExtinguishMoonCommand({ asteroidLabel: "Moon Prime" })).toBe('Delete : "Moon Prime"');
  });

  it("builds ingest command with table + metadata", () => {
    expect(
      buildIngestMoonCommand({
        value: "Invoice 2026-03",
        tableName: "Finance > Cashflow",
        metadata: { amount: 1250, status: "paid" },
      })
    ).toBe('"Invoice 2026-03" (table: Finance > Cashflow, amount: 1250, status: paid)');
  });

  it("builds parser payload from action", () => {
    expect(
      buildBuilderParserPayload(
        {
          type: "LINK_MOONS",
          sourceId: "5c76f0ac-6e49-4d66-af64-e279f8ff8a71",
          targetId: "f3193ff1-8223-4ad4-bf01-f914fe318cf1",
        },
        { galaxyId: "g-1" }
      )
    ).toEqual({
      query: "5c76f0ac-6e49-4d66-af64-e279f8ff8a71 + f3193ff1-8223-4ad4-bf01-f914fe318cf1",
      parser_version: "v2",
      galaxy_id: "g-1",
    });
  });

  it("returns empty command for unknown action", () => {
    expect(buildBuilderParserCommand({ type: "UNKNOWN_ACTION" })).toBe("");
  });

  it("supports TYPE_MOONS action", () => {
    expect(
      buildBuilderParserCommand({
        type: "TYPE_MOONS",
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A : B");
  });

  it("supports civilization aliases for command builders", () => {
    expect(
      buildLinkCivilizationsCommand({
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A + B");
    expect(
      buildTypeCivilizationsCommand({
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A : B");
    expect(buildExtinguishCivilizationCommand({ asteroidLabel: "Moon Prime" })).toBe('Delete : "Moon Prime"');
    expect(
      buildIngestCivilizationCommand({
        value: "Invoice 2026-03",
        tableName: "Finance > Cashflow",
      })
    ).toBe('"Invoice 2026-03" (table: Finance > Cashflow)');
  });

  it("supports *_CIVILIZATIONS action aliases", () => {
    expect(
      buildBuilderParserCommand({
        type: "LINK_CIVILIZATIONS",
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A + B");
    expect(
      buildBuilderParserCommand({
        type: "TYPE_CIVILIZATIONS",
        sourceLabel: "A",
        targetLabel: "B",
      })
    ).toBe("A : B");
    expect(
      buildBuilderParserCommand({
        type: "EXTINGUISH_CIVILIZATION",
        asteroidLabel: "A",
      })
    ).toBe("Delete : A");
    expect(
      buildBuilderParserCommand({
        type: "INGEST_CIVILIZATION",
        value: "A",
      })
    ).toBe("A");
  });
});
