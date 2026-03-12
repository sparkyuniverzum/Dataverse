import { describe, expect, it } from "vitest";

import {
  advanceStarCoreInterior,
  beginStarCoreInterior,
  beginStarCorePolicyLock,
  createInitialStarCoreInteriorState,
  resolveStarCoreInteriorEscape,
  resolveStarCoreInteriorModel,
  resolveStarCorePolicyLockFailure,
  resolveStarCorePolicyLockSuccess,
  selectStarCoreConstitution,
} from "./starCoreInteriorStateModel.js";

describe("starCoreInteriorStateModel", () => {
  it("opens entry and advances to constitution select", () => {
    const entry = beginStarCoreInterior(createInitialStarCoreInteriorState());
    expect(entry.phase).toBe("star_core_interior_entry");
    expect(advanceStarCoreInterior(entry).phase).toBe("constitution_select");
  });

  it("selects constitution and enables policy lock", () => {
    const selected = selectStarCoreConstitution(createInitialStarCoreInteriorState(), "rovnovaha");
    const model = resolveStarCoreInteriorModel(selected);
    expect(model.phase).toBe("policy_lock_ready");
    expect(model.canConfirmLock).toBe(true);
  });

  it("handles lock success and escape", () => {
    const pending = beginStarCorePolicyLock(selectStarCoreConstitution(createInitialStarCoreInteriorState(), "rust"));
    expect(pending.phase).toBe("policy_lock_transition");
    const success = resolveStarCorePolicyLockSuccess(pending);
    expect(success.phase).toBe("first_orbit_ready");
    expect(resolveStarCoreInteriorEscape(success).phase).toBe("closed");
  });

  it("returns to ready state after lock failure", () => {
    const pending = beginStarCorePolicyLock(selectStarCoreConstitution(createInitialStarCoreInteriorState(), "rust"));
    const failed = resolveStarCorePolicyLockFailure(pending, "boom");
    expect(failed.phase).toBe("policy_lock_ready");
    expect(failed.errorMessage).toBe("boom");
  });
});
