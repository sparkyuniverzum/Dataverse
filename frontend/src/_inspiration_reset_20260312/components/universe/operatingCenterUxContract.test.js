import { describe, expect, it } from "vitest";

import { resolveSurfaceCopy, resolveWorkspacePresentationMode } from "./operatingCenterUxContract";

describe("operatingCenterUxContract", () => {
  it("prioritizes governance, then recovery, then promote for workspace cinematic mode", () => {
    expect(
      resolveWorkspacePresentationMode({
        governanceMode: { open: false },
        recoveryMode: { open: true, cinematicMode: "recovery_mode" },
        promoteReview: { open: true, cinematicMode: "promote_review" },
      })
    ).toMatchObject({
      cinematicMode: "recovery_mode",
      transform: "translateX(-8px) scale(0.994)",
    });

    expect(
      resolveWorkspacePresentationMode({
        governanceMode: { open: true, cinematicMode: "governance_mode" },
        recoveryMode: { open: true, cinematicMode: "recovery_mode" },
        promoteReview: { open: true, cinematicMode: "promote_review" },
      })
    ).toMatchObject({
      cinematicMode: "governance_mode",
      filter: "saturate(1.12) contrast(1.05) brightness(0.9)",
    });
  });

  it("serves unified copy for extracted operating-center surfaces", () => {
    expect(resolveSurfaceCopy("promote")).toMatchObject({
      eyebrow: "REALITY TRANSFER",
      launcherClosed: "Otevrit reality transfer review",
    });
    expect(resolveSurfaceCopy("recovery")).toMatchObject({
      closeLabel: "Zpet do provozniho centra",
    });
  });
});
