import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppConnectivityNotice from "./AppConnectivityNotice.jsx";

describe("AppConnectivityNotice", () => {
  it("renders nothing when notice is null", () => {
    const { container } = render(<AppConnectivityNotice notice={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders offline warning copy for active auth entry notice", () => {
    render(
      <AppConnectivityNotice
        notice={{
          tone: "warn",
          title: "Jsi offline",
          message: "Prihlaseni a registrace ted nemohou probehnout.",
        }}
      />
    );

    expect(screen.getByTestId("app-connectivity-notice")).toBeTruthy();
    expect(screen.getByText("Jsi offline")).toBeTruthy();
    expect(screen.getByText(/Prihlaseni a registrace/)).toBeTruthy();
  });
});
