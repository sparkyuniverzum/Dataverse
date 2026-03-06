import { describe, expect, it } from "vitest";

import {
  PREVIEW_BASE_BACKGROUND_COLOR,
  buildPreviewContrastReport,
  observeReducedMotionPreference,
  readReducedMotionPreference,
  resolvePreviewSeverityColor,
  resolveWorkspaceKeyboardAction,
} from "./previewAccessibility";

describe("accessibilityPreview", () => {
  it("keeps severity colors above minimum contrast threshold on preview background", () => {
    const report = buildPreviewContrastReport({
      background: PREVIEW_BASE_BACKGROUND_COLOR,
      minRatio: 4.5,
    });
    expect(report.pass).toBe(true);
    report.entries.forEach((item) => {
      expect(item.ratio).toBeGreaterThanOrEqual(4.5);
      expect(resolvePreviewSeverityColor(item.severity)).toBe(item.color);
    });
  });

  it("reads reduced-motion preference and reacts to media-query changes", () => {
    const listeners = new Set();
    const mediaQueryList = {
      matches: true,
      addEventListener(eventName, handler) {
        if (eventName === "change") listeners.add(handler);
      },
      removeEventListener(eventName, handler) {
        if (eventName === "change") listeners.delete(handler);
      },
    };
    const matchMediaFn = () => mediaQueryList;

    expect(readReducedMotionPreference({ matchMediaFn })).toBe(true);

    const observed = [];
    const unsubscribe = observeReducedMotionPreference(
      (value) => {
        observed.push(Boolean(value));
      },
      { matchMediaFn }
    );

    expect(observed).toEqual([true]);
    mediaQueryList.matches = false;
    listeners.forEach((handler) => handler());
    expect(observed).toEqual([true, false]);

    unsubscribe();
    mediaQueryList.matches = true;
    listeners.forEach((handler) => handler());
    expect(observed).toEqual([true, false]);
  });

  it("maps keyboard shortcuts to workspace actions while respecting context", () => {
    const baseContext = {
      canOpenGrid: true,
      canOpenStarHeart: true,
      quickGridOpen: false,
      starHeartOpen: false,
      stageZeroSetupOpen: false,
    };

    expect(resolveWorkspaceKeyboardAction({ key: "g" }, baseContext)).toBe("open_grid");
    expect(resolveWorkspaceKeyboardAction({ key: "h" }, baseContext)).toBe("open_star_heart");
    expect(resolveWorkspaceKeyboardAction({ key: "Escape" }, { ...baseContext, quickGridOpen: true })).toBe(
      "close_quick_grid"
    );
    expect(resolveWorkspaceKeyboardAction({ key: "Escape" }, { ...baseContext, starHeartOpen: true })).toBe(
      "close_star_heart"
    );
    expect(resolveWorkspaceKeyboardAction({ key: "Escape" }, { ...baseContext, stageZeroSetupOpen: true })).toBe(
      "close_stage_zero_setup"
    );
  });

  it("ignores shortcuts while typing in interactive fields", () => {
    const action = resolveWorkspaceKeyboardAction(
      {
        key: "g",
        target: {
          tagName: "INPUT",
          isContentEditable: false,
        },
      },
      {
        canOpenGrid: true,
        canOpenStarHeart: true,
      }
    );
    expect(action).toBe("");
  });
});
