import { describe, expect, it } from "vitest";

import { canTransitionLifecycle, explainLifecycleGuard, normalizeLifecycleStateFromRow } from "./civilizationLifecycle";

describe("civilizationLifecycle", () => {
  it("normalizes lifecycle state from row and metadata aliases", () => {
    expect(normalizeLifecycleStateFromRow({ state: "active" })).toBe("ACTIVE");
    expect(normalizeLifecycleStateFromRow({ metadata: { state: "draft" } })).toBe("DRAFT");
    expect(normalizeLifecycleStateFromRow({ metadata: { status: "anomaly" } })).toBe("ANOMALY");
    expect(normalizeLifecycleStateFromRow({ is_deleted: true })).toBe("ARCHIVED");
  });

  it("enforces lifecycle transition matrix", () => {
    expect(canTransitionLifecycle("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionLifecycle("ACTIVE", "ARCHIVED")).toBe(true);
    expect(canTransitionLifecycle("ARCHIVED", "ACTIVE")).toBe(false);
    expect(canTransitionLifecycle("ACTIVE", "ACTIVE")).toBe(false);
  });

  it("returns explicit guard reasons for mutate/archive/transition", () => {
    const archivedMutate = explainLifecycleGuard({ row: { state: "ARCHIVED" }, operation: "mutate" });
    expect(archivedMutate.allowed).toBe(false);
    expect(archivedMutate.reason).toBe("archived_readonly");

    const archiveArchived = explainLifecycleGuard({ row: { state: "ARCHIVED" }, operation: "archive" });
    expect(archiveArchived.allowed).toBe(false);
    expect(archiveArchived.reason).toBe("already_archived");

    const invalidTransition = explainLifecycleGuard({
      row: { state: "ARCHIVED" },
      operation: "transition",
      targetState: "ACTIVE",
    });
    expect(invalidTransition.allowed).toBe(false);
    expect(invalidTransition.reason).toBe("invalid_transition");
  });
});
