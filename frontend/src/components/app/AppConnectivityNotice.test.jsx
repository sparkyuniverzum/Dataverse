/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AppConnectivityNotice from "./AppConnectivityNotice";

afterEach(() => {
  cleanup();
});

describe("AppConnectivityNotice", () => {
  it("renders nothing without notice payload", () => {
    render(<AppConnectivityNotice notice={null} />);
    expect(screen.queryByTestId("app-connectivity-notice")).toBeNull();
  });

  it("renders notice title and message", () => {
    render(
      <AppConnectivityNotice
        notice={{
          tone: "warn",
          title: "Jsi offline",
          message: "Prihlaseni a registrace ted nemohou probehnout.",
        }}
      />
    );

    expect(screen.getByTestId("app-connectivity-notice").textContent).toContain("Jsi offline");
    expect(screen.getByTestId("app-connectivity-notice").textContent).toContain(
      "Prihlaseni a registrace ted nemohou probehnout."
    );
  });
});
