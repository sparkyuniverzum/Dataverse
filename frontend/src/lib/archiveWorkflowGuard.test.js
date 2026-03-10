import { describe, expect, it } from "vitest";

import { isArchiveOperationAcknowledged } from "./archiveWorkflowGuard";

describe("isArchiveOperationAcknowledged", () => {
  it("accepts archive feedback token", () => {
    expect(isArchiveOperationAcknowledged({ feedback: "Composer ARCHIVE ulozen (1 radku)." })).toBe(true);
    expect(isArchiveOperationAcknowledged({ feedback: "Civilizace archivovana." })).toBe(true);
  });

  it("accepts row count drop even when feedback text is stale", () => {
    expect(
      isArchiveOperationAcknowledged({
        feedback: "Nerost 'category' byl ulozen.",
        countBeforeArchive: 7,
        countNow: 6,
      })
    ).toBe(true);
  });

  it("rejects when no archive signal exists", () => {
    expect(
      isArchiveOperationAcknowledged({
        feedback: "Nerost 'category' byl ulozen.",
        countBeforeArchive: 7,
        countNow: 7,
      })
    ).toBe(false);
  });
});
