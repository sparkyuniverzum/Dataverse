import { describe, expect, it } from "vitest";

import {
  buildContractViolationRecovery,
  extractMissingRequiredFields,
  isContractViolationMessage,
} from "./contractViolationRecovery";

describe("contractViolationRecovery", () => {
  it("extracts missing required fields from table contract violation message", () => {
    const message =
      "Table contract violation [Core > Planeta]: required field 'state' is missing; required field 'label' is missing";
    expect(extractMissingRequiredFields(message)).toEqual(["state", "label"]);
  });

  it("detects contract violation and classifies recoverable keys", () => {
    const recovery = buildContractViolationRecovery("Table contract violation: required field 'state' is missing", {
      knownFieldKeys: ["state", "amount"],
    });
    expect(isContractViolationMessage("Table contract violation")).toBe(true);
    expect(recovery.hasViolation).toBe(true);
    expect(recovery.recoverable).toEqual(["state"]);
    expect(recovery.unresolved).toEqual([]);
  });
});
