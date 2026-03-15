import { describe, expect, it } from "vitest";

import { resolveBondDraftRailState, resolveCommandDraftState, resolveDraftRailState } from "./draftRailContract";

describe("draftRailContract", () => {
  it("blocks command execute when preview is stale or ambiguity is blocking", () => {
    expect(
      resolveCommandDraftState({
        commandBarOpen: true,
        commandInput: '"Invoice 2026"',
        commandPreview: {
          command: '"Invoice 2025"',
          ambiguityHints: [],
        },
      }).canExecute
    ).toBe(false);

    expect(
      resolveCommandDraftState({
        commandBarOpen: true,
        commandInput: '"Invoice 2026"',
        commandPreview: {
          command: '"Invoice 2026"',
          ambiguityHints: [{ severity: "blocking", message: "Need explicit table" }],
        },
      })
    ).toMatchObject({
      canExecute: false,
      showResolveAction: true,
      showResolvePlanetPicker: true,
    });
  });

  it("allows command execute only for current non-blocking preview", () => {
    expect(
      resolveCommandDraftState({
        commandBarOpen: true,
        commandInput: '"Invoice 2026"',
        commandPreview: {
          command: '"Invoice 2026"',
          ambiguityHints: [],
        },
        selectedTableId: "planet-1",
      })
    ).toMatchObject({
      canPreview: true,
      canExecute: true,
      showResolveAction: false,
    });
  });

  it("normalizes bond draft busy and active states", () => {
    expect(
      resolveBondDraftRailState({
        bondDraft: { state: "BOND_DRAFT_TARGET", sourceId: "moon-1", targetId: "moon-2", type: "relation" },
        bondPreviewBusy: true,
      })
    ).toMatchObject({
      state: "BOND_DRAFT_TARGET",
      sourceId: "moon-1",
      targetId: "moon-2",
      type: "relation",
      busy: true,
      hasDraft: true,
    });
  });

  it("prefers command rail over bond rail and exposes summary", () => {
    expect(
      resolveDraftRailState({
        command: {
          commandBarOpen: true,
          commandResultSummary: "Prikaz proveden.",
        },
        bond: {
          bondDraft: { state: "BOND_DRAFT_TARGET" },
        },
      })
    ).toMatchObject({
      activeRail: "command",
      hasActiveDraft: true,
      summary: "Prikaz proveden.",
    });
  });
});
