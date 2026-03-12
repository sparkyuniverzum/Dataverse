import { describe, expect, it } from "vitest";

import {
  buildStarCorePolicyLockPayload,
  findStarCoreConstitutionOption,
  resolveStarCoreConstitutionOptions,
} from "./starCoreConstitutionModel.js";

describe("starCoreConstitutionModel", () => {
  it("returns four constitution options with canonical payload mapping", () => {
    const options = resolveStarCoreConstitutionOptions();
    expect(options).toHaveLength(4);
    expect(options.map((item) => item.id)).toEqual(["rust", "rovnovaha", "straz", "archiv"]);
    expect(options[0].profileMeta.key).toBe("FLUX");
    expect(options[1].physicalProfileMeta.key).toBe("BALANCE");
  });

  it("builds canonical lock payload from constitution id", () => {
    expect(buildStarCorePolicyLockPayload("straz")).toEqual({
      profile_key: "SENTINEL",
      lock_after_apply: true,
      physical_profile_key: "BALANCE",
      physical_profile_version: 1,
    });
    expect(findStarCoreConstitutionOption("archiv")?.profileKey).toBe("ARCHIVE");
  });
});
