import { describe, expect, it } from "vitest";

import { buildWorkspaceEntryCrashMessage, isFatalWorkspaceRuntimeText } from "./workspaceEntryGate";

describe("workspaceEntryGate", () => {
  it("detects TDZ runtime crash signature", () => {
    expect(isFatalWorkspaceRuntimeText("Cannot access 'appendRuntimeWorkflowEvent' before initialization")).toBe(true);
  });

  it("detects React UniverseWorkspace crash signature", () => {
    expect(isFatalWorkspaceRuntimeText("An error occurred in the <UniverseWorkspace> component.")).toBe(true);
  });

  it("ignores non-fatal informational messages", () => {
    expect(isFatalWorkspaceRuntimeText("Download the React DevTools for a better development experience")).toBe(false);
  });

  it("builds crash message preferring page error detail", () => {
    const msg = buildWorkspaceEntryCrashMessage({
      pageErrorMessage: "Cannot access 'x' before initialization",
      consoleMessage: "An error occurred in the <UniverseWorkspace> component.",
    });
    expect(msg).toContain("Cannot access 'x' before initialization");
  });
});
