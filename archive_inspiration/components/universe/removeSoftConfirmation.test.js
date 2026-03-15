import { describe, expect, it } from "vitest";

import { buildRemoveSoftConfirmationKey } from "./removeSoftConfirmation";

describe("buildRemoveSoftConfirmationKey", () => {
  it("returns stable key for row + mineral pair", () => {
    expect(buildRemoveSoftConfirmationKey({ rowId: "moon-1", mineralKey: " Amount " })).toBe("moon-1:amount");
  });

  it("returns empty string for incomplete input", () => {
    expect(buildRemoveSoftConfirmationKey({ rowId: "", mineralKey: "amount" })).toBe("");
    expect(buildRemoveSoftConfirmationKey({ rowId: "moon-1", mineralKey: "" })).toBe("");
  });
});
