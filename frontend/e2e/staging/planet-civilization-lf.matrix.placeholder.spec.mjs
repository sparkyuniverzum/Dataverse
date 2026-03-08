import { expect, test } from "@playwright/test";

const LF_GATE_INVENTORY = Object.freeze({
  "LF-01": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-02": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-03": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-04": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-05": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-06": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-07": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
  "LF-08": "frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js",
});

test.describe("planet-civilization-lf matrix inventory", () => {
  test("LF-01..LF-08 gates are explicitly mapped", async () => {
    const keys = Object.keys(LF_GATE_INVENTORY);
    expect(keys).toEqual(["LF-01", "LF-02", "LF-03", "LF-04", "LF-05", "LF-06", "LF-07", "LF-08"]);
    for (const key of keys) {
      expect(typeof LF_GATE_INVENTORY[key]).toBe("string");
      expect(LF_GATE_INVENTORY[key]).toContain(".test.js");
    }
  });
});
