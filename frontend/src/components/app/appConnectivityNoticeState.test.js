import { describe, expect, it } from "vitest";

import { buildOfflineEntryGuardMessage, resolveAppConnectivityNotice } from "./appConnectivityNoticeState";

describe("appConnectivityNoticeState", () => {
  it("returns null when app is online", () => {
    expect(resolveAppConnectivityNotice(true, "auth_entry")).toBeNull();
  });

  it("builds phase-specific offline notices", () => {
    expect(resolveAppConnectivityNotice(false, "session_boot")?.message).toContain("bootstrap session");
    expect(resolveAppConnectivityNotice(false, "auth_entry")?.message).toContain("Prihlaseni a registrace");
    expect(resolveAppConnectivityNotice(false, "galaxy_gate")?.message).toContain("galaxii");
  });

  it("builds operator-readable offline entry guard messages", () => {
    expect(buildOfflineEntryGuardMessage("Prihlaseni")).toContain("Prihlaseni");
    expect(buildOfflineEntryGuardMessage("Prihlaseni")).toContain("offline");
  });
});
