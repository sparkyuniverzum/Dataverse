import { describe, expect, it } from "vitest";

import { buildMoonCreateMinerals } from "./moonWriteDefaults";

describe("moonWriteDefaults", () => {
  it("builds required minerals for catalog-like contract", () => {
    const minerals = buildMoonCreateMinerals({
      label: "Starter Moon",
      contract: {
        required_fields: ["entity_id", "label", "state"],
        field_types: {
          entity_id: "string",
          label: "string",
          state: "string",
        },
      },
    });

    expect(typeof minerals.entity_id).toBe("string");
    expect(minerals.entity_id.startsWith("moon-")).toBe(true);
    expect(minerals.label).toBe("Starter Moon");
    expect(minerals.state).toBe("active");
  });

  it("uses contract types and numeric validators for defaults", () => {
    const minerals = buildMoonCreateMinerals({
      label: "Txn Moon",
      contract: {
        required_fields: ["amount", "paid_at", "confirmed"],
        field_types: {
          amount: "number",
          paid_at: "datetime",
          confirmed: "boolean",
        },
        validators: [{ field: "amount", operator: ">", value: 0 }],
      },
    });

    expect(minerals.amount).toBe(1);
    expect(typeof minerals.paid_at).toBe("string");
    expect(Number.isNaN(Date.parse(minerals.paid_at))).toBe(false);
    expect(minerals.confirmed).toBe(false);
  });

  it("ignores reserved routing fields in required list", () => {
    const minerals = buildMoonCreateMinerals({
      label: "Ignore Reserved",
      contract: {
        required_fields: ["table", "table_id", "table_name", "transaction_name"],
        field_types: {
          transaction_name: "string",
        },
      },
    });

    expect(minerals.table).toBeUndefined();
    expect(minerals.table_id).toBeUndefined();
    expect(minerals.table_name).toBeUndefined();
    expect(minerals.transaction_name).toBe("Ignore Reserved");
  });
});
