/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import PlanetBuilderWizardHarnessPanel from "./PlanetBuilderWizardHarnessPanel";

afterEach(() => {
  cleanup();
});

describe("PlanetBuilderWizardHarnessPanel", () => {
  it("runs interactive mission to converged state via real click events", async () => {
    const user = userEvent.setup();
    render(<PlanetBuilderWizardHarnessPanel initiallyLocked={false} schemaStepsTotal={3} />);

    expect(screen.getByTestId("wizard-state").textContent).toContain("StarLockedRequired");

    await user.click(screen.getByRole("button", { name: "Open Blueprint" }));
    expect(screen.getByTestId("wizard-last-result").textContent).toContain("blocked:star_lock_required");

    await user.click(screen.getByRole("button", { name: "Lock Star" }));
    await user.click(screen.getByRole("button", { name: "Open Blueprint" }));
    await user.click(screen.getByRole("button", { name: "Start Drag" }));
    await user.click(screen.getByRole("button", { name: "Drop Planet" }));
    await user.click(screen.getByRole("button", { name: "Open Setup" }));
    await user.click(screen.getByRole("button", { name: "Select Preset" }));
    await user.click(screen.getByRole("button", { name: "Assemble Schema Step" }));
    await user.click(screen.getByRole("button", { name: "Assemble Schema Step" }));
    await user.click(screen.getByRole("button", { name: "Assemble Schema Step" }));
    await user.click(screen.getByRole("button", { name: "Commit Preset" }));
    await user.click(screen.getByRole("button", { name: "Commit Success" }));

    expect(screen.getByTestId("wizard-state").textContent).toContain("Converged");
    expect(screen.getByTestId("wizard-why").textContent).toContain("3D planety i grid");
  });

  it("shows recover CTA only in recoverable error and restores last valid step", async () => {
    const user = userEvent.setup();
    render(<PlanetBuilderWizardHarnessPanel initiallyLocked={true} schemaStepsTotal={3} />);

    await user.click(screen.getByRole("button", { name: "Open Blueprint" }));
    await user.click(screen.getByRole("button", { name: "Start Drag" }));
    await user.click(screen.getByRole("button", { name: "Drop Planet" }));
    await user.click(screen.getByRole("button", { name: "Open Setup" }));
    await user.click(screen.getByRole("button", { name: "Select Preset" }));
    await user.click(screen.getByRole("button", { name: "Assemble Schema Step" }));
    expect(screen.getByTestId("wizard-state").textContent).toContain("CapabilityAssembling");

    expect(screen.queryByRole("button", { name: "Recover Error" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Raise Recoverable Error" }));
    expect(screen.getByTestId("wizard-state").textContent).toContain("ErrorRecoverable");
    expect(screen.getByRole("button", { name: "Recover Error" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Assemble Schema Step" }));
    expect(screen.getByTestId("wizard-last-result").textContent).toContain("blocked:recover_required");

    await user.click(screen.getByRole("button", { name: "Recover Error" }));
    expect(screen.getByTestId("wizard-state").textContent).toContain("CapabilityAssembling");
    expect(screen.queryByRole("button", { name: "Recover Error" })).toBeNull();
  });
});
