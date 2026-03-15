import { describe, expect, it } from "vitest";

import {
  normalizeVisibleBranches,
  resolveBranchSelectionTransition,
  resolveBranchVisibilityModel,
} from "./branchVisibilityContract";

describe("branchVisibilityContract", () => {
  it("normalizes active branches and preserves selected branch visibility", () => {
    const visibleBranches = normalizeVisibleBranches([
      { id: "br-1", name: "Feature Alpha", deleted_at: null },
      { id: "br-2", name: "", deleted_at: null },
      { id: "br-3", name: "Removed", deleted_at: "2026-03-10T10:00:00Z" },
    ]);

    expect(visibleBranches).toEqual([
      { id: "br-1", label: "Feature Alpha" },
      { id: "br-2", label: "br-2" },
    ]);

    const visibility = resolveBranchVisibilityModel({
      branches: [
        { id: "br-1", name: "Feature Alpha", deleted_at: null },
        { id: "br-2", name: "", deleted_at: null },
        { id: "br-3", name: "Removed", deleted_at: "2026-03-10T10:00:00Z" },
      ],
      selectedBranchId: "br-1",
    });

    expect(visibility.selectedBranchId).toBe("br-1");
    expect(visibility.hasSelectedBranch).toBe(true);
    expect(visibility.scopeLabel).toBe("Branch: Feature Alpha");
    expect(visibility.branchMode).toBe("branch");
  });

  it("falls back to main scope when selected branch no longer exists", () => {
    const visibility = resolveBranchVisibilityModel({
      branches: [{ id: "br-1", name: "Feature Alpha", deleted_at: null }],
      selectedBranchId: "br-missing",
    });

    expect(visibility.selectedBranchId).toBe("");
    expect(visibility.hasSelectedBranch).toBe(false);
    expect(visibility.scopeLabel).toBe("Main timeline");
    expect(visibility.shouldResetSelection).toBe(true);
  });

  it("keeps pre-normalized branch labels when fed from workspace layer", () => {
    const visibility = resolveBranchVisibilityModel({
      branches: [{ id: "br-11", label: "UX Branch" }],
      selectedBranchId: "br-11",
    });

    expect(visibility.selectedBranchId).toBe("br-11");
    expect(visibility.scopeLabel).toBe("Branch: UX Branch");
  });

  it("clears branch create draft only when switching to main timeline", () => {
    expect(resolveBranchSelectionTransition({ nextBranchId: "br-9", branchCreateName: "Draft name" })).toEqual({
      selectedBranchId: "br-9",
      shouldClearPromoteSummary: true,
      shouldClearBranchCreateName: false,
    });

    expect(resolveBranchSelectionTransition({ nextBranchId: "", branchCreateName: "Draft name" })).toEqual({
      selectedBranchId: "",
      shouldClearPromoteSummary: true,
      shouldClearBranchCreateName: true,
    });
  });
});
