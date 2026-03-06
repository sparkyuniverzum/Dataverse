import { describe, expect, it } from "vitest";

import { resolvePlanetMoonCausalGuidance } from "./planetMoonCausalGuidance";

describe("planetMoonCausalGuidance", () => {
  it("explains stage0 schema assembly progress with next lego step", () => {
    const guidance = resolvePlanetMoonCausalGuidance({
      stageZeroActive: true,
      stageZeroSetupOpen: true,
      stageZeroPresetSelected: true,
      stageZeroSchemaSummary: {
        completed: 1,
        total: 3,
        nextStepKey: "amount",
      },
      stageZeroStepDefinitions: [
        { key: "transactionName", blockLabel: "Nazev transakce" },
        { key: "amount", blockLabel: "Castka" },
      ],
      planetBuilderNarrative: {
        title: "Fallback",
        why: "Fallback why",
        action: "Fallback action",
      },
    });

    expect(guidance.title).toContain("Skladani");
    expect(guidance.why).toContain("1/3");
    expect(guidance.action).toContain("Castka");
    expect(guidance.source).toBe("stage0");
    expect(guidance.severity).toBe("info");
  });

  it("returns preview-ready stage0 guidance when schema is complete", () => {
    const guidance = resolvePlanetMoonCausalGuidance({
      stageZeroActive: true,
      stageZeroSetupOpen: true,
      stageZeroPresetSelected: true,
      stageZeroAllSchemaStepsDone: true,
      stageZeroSchemaSummary: {
        completed: 3,
        total: 3,
        nextStepKey: "",
      },
    });

    expect(guidance.title).toContain("Schema pripraveno");
    expect(guidance.action).toContain("Zazehnout Jadro");
    expect(guidance.severity).toBe("success");
  });

  it("prioritizes critical runtime guidance for selected planet", () => {
    const guidance = resolvePlanetMoonCausalGuidance({
      stageZeroActive: false,
      selectedTable: { name: "Core > Finance" },
      selectedPlanetNode: {
        runtimePlanetPhysics: { phase: "critical" },
        physics: { corrosionLevel: 0.81 },
      },
      quickGridOpen: false,
    });

    expect(guidance.title).toContain("Core > Finance");
    expect(guidance.why).toContain("kriticke");
    expect(guidance.action).toContain("Otevri grid");
    expect(guidance.severity).toBe("critical");
    expect(guidance.source).toBe("planet_runtime");
  });

  it("explains moon capability context when moon is selected", () => {
    const guidance = resolvePlanetMoonCausalGuidance({
      selectedMoonNode: {
        label: "Settlement ledger",
        parentPhase: "CORRODING",
      },
      selectedMoonLabel: "Settlement ledger",
      quickGridOpen: true,
    });

    expect(guidance.title).toContain("Mesic");
    expect(guidance.why).toContain("capability");
    expect(guidance.why).toContain("CORRODING");
    expect(guidance.action).toContain("Grid je otevreny");
    expect(guidance.severity).toBe("warn");
    expect(guidance.source).toBe("moon");
  });
});
