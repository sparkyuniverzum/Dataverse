import { describe, expect, it } from "vitest";

import {
  WORKSPACE_ATTENTION,
  WORKSPACE_TIME_MODE,
  resolveWorkspaceDraftState,
  resolveWorkspaceScopeState,
  resolveWorkspaceSelectionState,
  resolveWorkspaceStateContract,
  resolveWorkspaceSyncState,
} from "./workspaceStateContract";

describe("workspaceStateContract", () => {
  it("resolves scope and selection defaults for main/current canvas state", () => {
    expect(
      resolveWorkspaceStateContract({
        scope: { galaxyId: "g-1" },
        selection: {},
        draft: {},
        sync: {},
      })
    ).toMatchObject({
      overallAttention: WORKSPACE_ATTENTION.GREEN,
      mode: {
        branchMode: "main",
        timeMode: WORKSPACE_TIME_MODE.CURRENT,
        surfaceMode: "canvas",
      },
      scope: {
        galaxyId: "g-1",
        branchMode: "main",
        attention: WORKSPACE_ATTENTION.GREEN,
      },
      selection: {
        selectionKind: "none",
        quickGridMode: "canvas",
      },
    });
  });

  it("marks branch and grid work as cautionary orange attention", () => {
    const scope = resolveWorkspaceScopeState({ galaxyId: "g-1", selectedBranchId: "br-7" });
    const selection = resolveWorkspaceSelectionState({
      selectedTableId: "t-1",
      selectedAsteroidId: "c-9",
      quickGridOpen: true,
    });

    expect(scope.attention).toBe(WORKSPACE_ATTENTION.ORANGE);
    expect(selection).toMatchObject({
      selectionKind: "civilization",
      quickGridMode: "grid",
      attention: WORKSPACE_ATTENTION.ORANGE,
    });
  });

  it("marks active draft work as orange and command errors as red", () => {
    expect(
      resolveWorkspaceDraftState({
        commandBarOpen: true,
      }).attention
    ).toBe(WORKSPACE_ATTENTION.ORANGE);

    expect(
      resolveWorkspaceDraftState({
        commandError: "Parser failed",
      }).attention
    ).toBe(WORKSPACE_ATTENTION.RED);
  });

  it("marks sync errors and offline write blocks as red", () => {
    expect(
      resolveWorkspaceSyncState({
        loading: true,
      }).attention
    ).toBe(WORKSPACE_ATTENTION.ORANGE);

    expect(
      resolveWorkspaceSyncState({
        runtimeConnectivity: { isOnline: false, status: "OFFLINE", writeBlocked: true },
      })
    ).toMatchObject({
      runtimeStatus: "offline",
      attention: WORKSPACE_ATTENTION.RED,
    });
  });

  it("elevates overall attention to red when any workspace pillar is red", () => {
    const state = resolveWorkspaceStateContract({
      scope: { galaxyId: "g-1", selectedBranchId: "br-7" },
      selection: { selectedTableId: "t-1", quickGridOpen: true },
      draft: { commandBarOpen: true },
      sync: { error: "projection mismatch" },
    });

    expect(state.overallAttention).toBe(WORKSPACE_ATTENTION.RED);
    expect(state.sync.attention).toBe(WORKSPACE_ATTENTION.RED);
  });
});
