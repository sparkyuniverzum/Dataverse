import { describe, expect, it } from "vitest";

import {
  FACT_SOURCES,
  FACT_STATUSES,
  FACT_VALUE_TYPES,
  buildMoonFacts,
  inferFactValueType,
  toMoonRowContract,
} from "./universe_contract";

describe("universe_contract", () => {
  it("infers canonical fact value types", () => {
    expect(inferFactValueType(null)).toBe(FACT_VALUE_TYPES.NULL);
    expect(inferFactValueType(true)).toBe(FACT_VALUE_TYPES.BOOLEAN);
    expect(inferFactValueType(120)).toBe(FACT_VALUE_TYPES.NUMBER);
    expect(inferFactValueType("2026-03-03T10:00:00Z")).toBe(FACT_VALUE_TYPES.DATETIME);
    expect(inferFactValueType("text")).toBe(FACT_VALUE_TYPES.STRING);
    expect(inferFactValueType({ a: 1 })).toBe(FACT_VALUE_TYPES.JSON);
  });

  it("builds value + metadata + calculated fact layers", () => {
    const facts = buildMoonFacts({
      value: "Sroub",
      metadata: { table: "Sklad > Material", cena: 10, jednotka: "ks" },
      calculatedValues: { celkem: 100, bad: "#CIRC!" },
    });
    const byKey = new Map(facts.map((item) => [item.key, item]));

    expect(byKey.get("value").source).toBe(FACT_SOURCES.VALUE);
    expect(byKey.get("cena").source).toBe(FACT_SOURCES.METADATA);
    expect(byKey.get("bad").source).toBe(FACT_SOURCES.CALCULATED);
    expect(byKey.get("bad").status).toBe(FACT_STATUSES.INVALID);
    expect(byKey.get("bad").errors).toEqual(["Circular formula dependency"]);
    expect(byKey.has("table")).toBe(false);
  });

  it("projects asteroid snapshot into moon row contract", () => {
    const row = toMoonRowContract({
      id: "m-1",
      value: "Hrebiky",
      table_id: "p-material",
      constellation_name: "Sklad",
      planet_name: "Material",
      metadata: { cena: 120, jednotka: "ks" },
      calculated_values: { suma: 240 },
      active_alerts: ["LOW_STOCK"],
      created_at: "2026-03-03T10:00:00Z",
      current_event_seq: 7,
    });

    expect(row.moon_id).toBe("m-1");
    expect(row.label).toBe("Hrebiky");
    expect(row.planet_id).toBe("p-material");
    expect(row.current_event_seq).toBe(7);
    expect(row.active_alerts).toEqual(["LOW_STOCK"]);
    expect(row.facts.some((item) => item.key === "cena")).toBe(true);
    expect(row.facts.some((item) => item.key === "suma" && item.source === FACT_SOURCES.CALCULATED)).toBe(true);
  });

  it("prefers backend-provided canonical facts when present", () => {
    const row = toMoonRowContract({
      id: "m-2",
      value: "Ignore fallback",
      table_id: "p-1",
      constellation_name: "Finance",
      planet_name: "Naklady",
      facts: [
        { key: "value", typed_value: "Canonical label", value_type: "string", source: "value", status: "valid" },
        { key: "rozpocet", typed_value: 15000, value_type: "number", source: "metadata", status: "valid" },
      ],
      created_at: "2026-03-03T10:00:00Z",
      current_event_seq: 11,
    });

    expect(row.facts).toHaveLength(2);
    expect(row.facts[0].typed_value).toBe("Canonical label");
    expect(row.facts[1].key).toBe("rozpocet");
  });
});
