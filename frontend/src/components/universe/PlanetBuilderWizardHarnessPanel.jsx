import { useMemo, useState } from "react";

import { buildPlanetBuilderNarrative, PLANET_BUILDER_STATE } from "./planetBuilderFlow";
import { createPlanetBuilderWizardHarness, PLANET_BUILDER_WIZARD_ACTION } from "./planetBuilderWizardHarness";

export default function PlanetBuilderWizardHarnessPanel({ initiallyLocked = false, schemaStepsTotal = 3 }) {
  const wizard = useMemo(
    () =>
      createPlanetBuilderWizardHarness({
        starLocked: initiallyLocked,
        schemaStepsTotal,
      }),
    [initiallyLocked, schemaStepsTotal]
  );
  const [snapshot, setSnapshot] = useState(() => wizard.snapshot());
  const [lastResult, setLastResult] = useState(() => ({ allowed: true, reason: "", message: "" }));

  const narrative = useMemo(() => buildPlanetBuilderNarrative(snapshot.currentState), [snapshot.currentState]);
  const showRecover = snapshot.currentState === PLANET_BUILDER_STATE.ERROR_RECOVERABLE;

  function runAction(action) {
    const result = wizard.dispatch(action);
    setLastResult({
      allowed: Boolean(result?.allowed),
      reason: String(result?.reason || ""),
      message: String(result?.message || ""),
    });
    setSnapshot(result?.state || wizard.snapshot());
  }

  return (
    <section
      style={{
        border: "1px solid rgba(118, 215, 247, 0.28)",
        borderRadius: 10,
        padding: 10,
        display: "grid",
        gap: 8,
      }}
    >
      <div data-testid="wizard-state">
        <strong>{snapshot.currentState}</strong>
      </div>
      <div data-testid="wizard-why">{narrative.why}</div>
      <div data-testid="wizard-action">{narrative.action}</div>
      <div data-testid="wizard-schema-progress">
        {snapshot.schemaStepsCompleted}/{snapshot.schemaStepsTotal}
      </div>
      <div
        data-testid="wizard-last-result"
        style={{ color: lastResult.allowed ? "#9ee8b1" : "#ffc7d4", fontSize: "var(--dv-fs-xs)" }}
      >
        {lastResult.allowed ? "allowed" : `blocked:${lastResult.reason}`} {lastResult.message}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.LOCK_STAR)}>
          Lock Star
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.OPEN_BLUEPRINT)}>
          Open Blueprint
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.START_DRAG_PLANET)}>
          Start Drag
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.DROP_PLANET)}>
          Drop Planet
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.OPEN_SETUP)}>
          Open Setup
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.SELECT_PRESET)}>
          Select Preset
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP)}>
          Assemble Schema Step
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.COMMIT_PRESET)}>
          Commit Preset
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.COMMIT_SUCCESS)}>
          Commit Success
        </button>
        <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.RAISE_RECOVERABLE_ERROR)}>
          Raise Recoverable Error
        </button>
        {showRecover ? (
          <button type="button" onClick={() => runAction(PLANET_BUILDER_WIZARD_ACTION.RECOVER_ERROR)}>
            Recover Error
          </button>
        ) : null}
      </div>
    </section>
  );
}
