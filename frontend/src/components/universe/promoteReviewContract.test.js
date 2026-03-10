import { describe, expect, it } from "vitest";

import { resolvePromoteReviewModel } from "./promoteReviewContract";

describe("promoteReviewContract", () => {
  it("blocks review when no branch is selected", () => {
    const model = resolvePromoteReviewModel();

    expect(model.canOpen).toBe(false);
    expect(model.blockingReason).toContain("Vyber branch");
    expect(model.cinematicMode).toBe("default");
  });

  it("builds review state for selected branch", () => {
    const model = resolvePromoteReviewModel({
      selectedBranchId: "br-7",
      selectedBranchLabel: "Experiment A",
      reviewOpen: true,
      branchPromoteSummary: "Branch byl promotnut (3 eventů).",
    });

    expect(model.open).toBe(true);
    expect(model.canConfirm).toBe(true);
    expect(model.title).toContain("Experiment A");
    expect(model.badgeLabel).toContain("Reality transfer");
    expect(model.summary).toContain("promotnut");
    expect(model.cinematicMode).toBe("promote_review");
  });
});
