import { describe, it, expect } from "vitest";
import { mapInteriorToLabProps } from "./starCoreInteriorLabAdapter";

describe("starCoreInteriorLabAdapter", () => {
  it("should map constitution selection to visual colors", () => {
    const model = {
      interior_phase: "constitution_select",
      selected_constitution_id: "rust",
    };
    const props = mapInteriorToLabProps(model);
    expect(props.accent).toBe("#ff4e4e");
    expect(props.pulseRate).toBe(1.8);
  });

  it("should map entry phase to higher intensity", () => {
    const model = {
      interior_phase: "star_core_interior_entry",
      selected_constitution_id: "rovnovaha",
    };
    const props = mapInteriorToLabProps(model);
    expect(props.intensity).toBe(2.5);
    expect(props.statusLabel).toBe("BOOTING");
  });

  it("should map policy lock transition to maximum intensity", () => {
    const model = {
      interior_phase: "policy_lock_transition",
      selected_constitution_id: "straz",
    };
    const props = mapInteriorToLabProps(model);
    expect(props.intensity).toBe(3.0);
    expect(props.statusLabel).toBe("LOCKING");
  });

  it("should map first orbit ready to stable state", () => {
    const model = {
      interior_phase: "first_orbit_ready",
      selected_constitution_id: "archiv",
    };
    const props = mapInteriorToLabProps(model);
    expect(props.intensity).toBe(0.7);
    expect(props.scale).toBe(0.95);
    expect(props.statusLabel).toBe("STABLE");
  });

  it("should return null for empty model", () => {
    expect(mapInteriorToLabProps(null)).toBeNull();
  });
});
