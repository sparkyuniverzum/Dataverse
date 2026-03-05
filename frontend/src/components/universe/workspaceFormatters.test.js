import { describe, expect, it } from "vitest";

import { collectGridColumns, readGridCell, tableDisplayName, valueToLabel } from "./workspaceFormatters";

describe("workspaceFormatters", () => {
  it("builds deterministic table display name", () => {
    expect(tableDisplayName({ constellation_name: "Finance", planet_name: "Cashflow" })).toBe("Finance > Cashflow");
    expect(tableDisplayName({ name: "Fallback table" })).toBe("Fallback table");
  });

  it("collects civilization/mineral columns from metadata and calculated values", () => {
    const columns = collectGridColumns([
      {
        value: "Row-1",
        metadata: { amount: 1200, category: "income" },
        calculated_values: { tax: 240 },
      },
      {
        value: "Row-2",
        metadata: { amount: 800, category: "expense", account: "cash" },
        calculated_values: { net: 560 },
      },
    ]);
    expect(columns).toContain("value");
    expect(columns).toContain("amount");
    expect(columns).toContain("category");
    expect(columns).toContain("account");
    expect(columns).toContain("tax");
    expect(columns).toContain("net");
  });

  it("reads cell values from value, metadata and calculated projections", () => {
    const row = {
      value: "Transaction-A",
      metadata: { amount: 420, status: "paid" },
      calculated_values: { vat: 88.2 },
    };
    expect(readGridCell(row, "value")).toBe("Transaction-A");
    expect(readGridCell(row, "amount")).toBe("420");
    expect(readGridCell(row, "status")).toBe("paid");
    expect(readGridCell(row, "vat")).toBe("88.2");
    expect(readGridCell(row, "missing")).toBe("");
  });

  it("serializes object minerals safely", () => {
    expect(valueToLabel({ a: 1, b: true })).toBe('{"a":1,"b":true}');
  });
});
