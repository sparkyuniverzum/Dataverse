import { describe, expect, it } from "vitest";

import { resolvePlanetTopologyLabels } from "./planetTopologyLabels.js";

describe("planetTopologyLabels", () => {
  it("produces selected detail copy", () => {
    const labels = resolvePlanetTopologyLabels(
      {
        label: "Planeta A",
        subtitle: "Orion",
        statusLabel: "ACTIVE",
        qualityScore: 91,
        complexity: 4,
      },
      { selected: true, approached: false }
    );

    expect(labels.title).toBe("Planeta A");
    expect(labels.subtitle).toBe("Orion");
    expect(labels.detail).toContain("Vybrana planeta");
  });

  it("produces approached detail copy with rows", () => {
    const labels = resolvePlanetTopologyLabels(
      {
        label: "Planeta B",
        statusLabel: "CRITICAL",
        qualityScore: 24,
        rows: 18,
      },
      { selected: true, approached: true }
    );

    expect(labels.detail).toContain("Priblizeni aktivni");
    expect(labels.detail).toContain("18");
  });
});
