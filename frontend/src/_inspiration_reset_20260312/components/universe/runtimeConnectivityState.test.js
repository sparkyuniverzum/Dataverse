/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildOfflineWriteGuardMessage,
  resolveRuntimeConnectivityState,
  useRuntimeConnectivityState,
} from "./runtimeConnectivityState";

afterEach(() => {
  cleanup();
});

function HookProbe() {
  const connectivity = useRuntimeConnectivityState();
  return React.createElement(
    "div",
    { "data-testid": "runtime-connectivity-probe" },
    `${connectivity.status}:${connectivity.badgeLabel}:${connectivity.writeBlocked ? "blocked" : "ready"}`
  );
}

describe("runtimeConnectivityState", () => {
  it("resolves online and offline snapshots deterministically", () => {
    expect(resolveRuntimeConnectivityState(true)).toMatchObject({
      status: "ONLINE",
      badgeLabel: "online",
      writeBlocked: false,
    });
    expect(resolveRuntimeConnectivityState(false)).toMatchObject({
      status: "OFFLINE",
      badgeLabel: "offline",
      writeBlocked: true,
    });
  });

  it("builds operator-readable offline guard messages", () => {
    expect(buildOfflineWriteGuardMessage("Mineral write")).toContain("Mineral write");
    expect(buildOfflineWriteGuardMessage("Mineral write")).toContain("workspace je offline");
  });

  it("reacts to browser online/offline events", async () => {
    render(React.createElement(HookProbe));
    expect(screen.getByTestId("runtime-connectivity-probe").textContent).toContain("ONLINE");

    window.dispatchEvent(new Event("offline"));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-connectivity-probe").textContent).toContain("OFFLINE:offline:blocked");
    });

    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-connectivity-probe").textContent).toContain("ONLINE:online:ready");
    });
  });
});
