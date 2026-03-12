import { describe, expect, it } from "vitest";

import { buildOfflineEntryGuardMessage, resolveAppConnectivityNotice } from "./appConnectivityNoticeState.js";

describe("appConnectivityNoticeState", () => {
  it("builds a czech offline guard message", () => {
    expect(buildOfflineEntryGuardMessage("Prihlaseni")).toContain("Prihlaseni neni dostupna");
  });

  it("returns no notice when app is online", () => {
    expect(resolveAppConnectivityNotice(true, "auth_entry")).toBeNull();
  });

  it("returns auth-entry offline notice when app is offline", () => {
    expect(resolveAppConnectivityNotice(false, "auth_entry")).toMatchObject({
      tone: "warn",
      title: "Jsi offline",
    });
  });
});
