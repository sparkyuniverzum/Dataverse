/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { readNavigatorOnline, useConnectivityState } from "./useConnectivityState";

afterEach(() => {
  cleanup();
});

function Probe() {
  const connectivity = useConnectivityState();
  return React.createElement(
    "div",
    { "data-testid": "connectivity-probe" },
    connectivity.isOffline ? "offline" : "online"
  );
}

describe("useConnectivityState", () => {
  it("reads navigator online state safely", () => {
    expect(typeof readNavigatorOnline()).toBe("boolean");
  });

  it("tracks online/offline browser events", async () => {
    render(React.createElement(Probe));
    expect(screen.getByTestId("connectivity-probe").textContent).toBe("online");

    window.dispatchEvent(new Event("offline"));
    await waitFor(() => {
      expect(screen.getByTestId("connectivity-probe").textContent).toBe("offline");
    });

    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      expect(screen.getByTestId("connectivity-probe").textContent).toBe("online");
    });
  });
});
