import { expect, test } from "@playwright/test";

test("planet builder smoke route converges mission flow", async ({ page }) => {
  await page.goto("/smoke/planet-builder");

  const state = page.getByTestId("wizard-state");
  const lastResult = page.getByTestId("wizard-last-result");

  await expect(state).toContainText("StarLockedRequired");

  await page.getByRole("button", { name: "Open Blueprint" }).click();
  await expect(lastResult).toContainText("blocked:star_lock_required");

  await page.getByRole("button", { name: "Lock Star" }).click();
  await page.getByRole("button", { name: "Open Blueprint" }).click();
  await page.getByRole("button", { name: "Start Drag" }).click();
  await page.getByRole("button", { name: "Drop Planet" }).click();
  await page.getByRole("button", { name: "Open Setup" }).click();
  await page.getByRole("button", { name: "Select Preset" }).click();
  await page.getByRole("button", { name: "Assemble Schema Step" }).click();
  await page.getByRole("button", { name: "Assemble Schema Step" }).click();
  await page.getByRole("button", { name: "Assemble Schema Step" }).click();
  await page.getByRole("button", { name: "Commit Preset" }).click();
  await page.getByRole("button", { name: "Commit Success" }).click();

  await expect(state).toContainText("Converged");
  await expect(page.getByTestId("wizard-why")).toContainText("3D planety i grid");
});
