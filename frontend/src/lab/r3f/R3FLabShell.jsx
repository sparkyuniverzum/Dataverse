import { useState } from "react";

import LabCanvas from "./LabCanvas.jsx";
import { resolveLabDiagnosticsModel } from "./labDiagnosticsModel.js";
import { getLabSceneDefinition, listLabScenes } from "./labSceneRegistry.js";
import { r3fLabPresetStore, useLabPresetStore } from "./labPresetStore.js";

function ShellSection({ title, children, aside = null }) {
  return (
    <section className="r3f-lab-panel">
      <header className="r3f-lab-panel-header">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button className="r3f-lab-toggle" data-active={active ? "true" : "false"} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function R3FLabShell({ activationSource = "storage", onExit = null, store = r3fLabPresetStore }) {
  const snapshot = useLabPresetStore((state) => state.snapshot, store);
  const status = useLabPresetStore((state) => state.status, store);
  const diagnostics = useLabPresetStore((state) => state.diagnostics, store);
  const eventLog = useLabPresetStore((state) => state.eventLog, store);
  const errorMessage = useLabPresetStore((state) => state.errorMessage, store);
  const hadStoredSnapshot = useLabPresetStore((state) => state.hadStoredSnapshot, store);
  const selectScene = useLabPresetStore((state) => state.selectScene, store);
  const setViewMode = useLabPresetStore((state) => state.setViewMode, store);
  const importSnapshotText = useLabPresetStore((state) => state.importSnapshotText, store);
  const exportSnapshotText = useLabPresetStore((state) => state.exportSnapshotText, store);
  const resetSnapshot = useLabPresetStore((state) => state.resetSnapshot, store);
  const clearStoredSnapshot = useLabPresetStore((state) => state.clearStoredSnapshot, store);
  const setDiagnostics = useLabPresetStore((state) => state.setDiagnostics, store);
  const clearEventLog = useLabPresetStore((state) => state.clearEventLog, store);
  const logEvent = useLabPresetStore((state) => state.logEvent, store);

  const [presetText, setPresetText] = useState("");
  const [presetMode, setPresetMode] = useState("idle");
  const [forceWarning, setForceWarning] = useState(false);

  const selectedScene = getLabSceneDefinition(snapshot.selectedSceneId);
  const selectedSceneConfig = snapshot.scenes[snapshot.selectedSceneId] || null;
  const diagnosticsModel = resolveLabDiagnosticsModel({
    diagnostics,
    viewMode: snapshot.viewMode,
    forceWarning,
  });

  function handleShowExport() {
    setPresetMode("export");
    setPresetText(exportSnapshotText());
  }

  function handlePrepareImport() {
    setPresetMode("import");
    setPresetText("");
  }

  function handleApplyImport() {
    importSnapshotText(presetText);
  }

  function handleToggleForceWarning() {
    const nextValue = !forceWarning;
    setForceWarning(nextValue);
    logEvent({
      kind: "diagnostics",
      label: nextValue ? "Forced warning zapnut" : "Forced warning vypnut",
    });
  }

  return (
    <main className="r3f-lab-shell">
      <header className="r3f-lab-topbar">
        <div>
          <p className="r3f-lab-kicker">Dataverse dev-only harness</p>
          <h1>R3F Lab v1</h1>
          <p className="r3f-lab-subtitle">
            Spike A core shell odděluje experiment od produktového runtime a drží jen serializovatelný preset contract.
          </p>
        </div>
        <div className="r3f-lab-topbar-actions">
          <span className="r3f-lab-badge">aktivace: {activationSource}</span>
          <span className="r3f-lab-badge">stav: {status}</span>
          <button className="r3f-lab-ghost-button" type="button" onClick={onExit}>
            Zavřít lab
          </button>
        </div>
      </header>

      {errorMessage ? <div className="r3f-lab-alert">{errorMessage}</div> : null}

      <div className="r3f-lab-layout">
        <aside className="r3f-lab-column">
          <ShellSection title="Scény">
            <div className="r3f-lab-stack">
              {listLabScenes().map((scene) => (
                <button
                  key={scene.id}
                  className="r3f-lab-scene-button"
                  data-active={snapshot.selectedSceneId === scene.id ? "true" : "false"}
                  type="button"
                  onClick={() => selectScene(scene.id)}
                >
                  <strong>{scene.titleCz}</strong>
                  <span>{scene.summaryCz}</span>
                  <small>{scene.implemented ? "implementováno" : "placeholder Spike A"}</small>
                </button>
              ))}
            </div>
          </ShellSection>

          <ShellSection title="Režim plátna">
            <div className="r3f-lab-toggle-row">
              <ToggleButton active={snapshot.viewMode === "debug"} onClick={() => setViewMode("debug")}>
                Debug
              </ToggleButton>
              <ToggleButton active={snapshot.viewMode === "cinematic"} onClick={() => setViewMode("cinematic")}>
                Cinematic
              </ToggleButton>
              <ToggleButton
                active={snapshot.viewMode === "performance_safe"}
                onClick={() => setViewMode("performance_safe")}
              >
                Safe
              </ToggleButton>
            </div>
          </ShellSection>

          <ShellSection title="Preset">
            <div className="r3f-lab-inline-actions">
              <button className="r3f-lab-ghost-button" type="button" onClick={handleShowExport}>
                Zobrazit export
              </button>
              <button className="r3f-lab-ghost-button" type="button" onClick={handlePrepareImport}>
                Připravit import
              </button>
              <button className="r3f-lab-ghost-button" type="button" onClick={resetSnapshot}>
                Reset
              </button>
              <button className="r3f-lab-ghost-button" type="button" onClick={clearStoredSnapshot}>
                Smazat uložený preset
              </button>
            </div>
            <p className="r3f-lab-hint">Persistováno: {hadStoredSnapshot ? "ano" : "zatím ne"}</p>
            {presetMode === "idle" ? null : (
              <>
                <textarea
                  aria-label="Preset JSON"
                  className="r3f-lab-textarea"
                  readOnly={presetMode === "export"}
                  value={presetText}
                  onChange={(event) => setPresetText(event.target.value)}
                />
                {presetMode === "import" ? (
                  <button className="r3f-lab-solid-button" type="button" onClick={handleApplyImport}>
                    Importovat preset
                  </button>
                ) : null}
              </>
            )}
          </ShellSection>
        </aside>

        <section className="r3f-lab-stage">
          <div className="r3f-lab-stage-header">
            <div>
              <p className="r3f-lab-kicker">Aktivní scéna</p>
              <h2>{selectedScene?.titleCz || "Neznámá scéna"}</h2>
            </div>
            <div className="r3f-lab-stage-meta">
              <span>{snapshot.selectedSceneId}</span>
              <span>{selectedScene?.implemented ? "implementováno" : "placeholder orchestrator"}</span>
            </div>
          </div>
          <LabCanvas
            sceneConfig={selectedSceneConfig}
            sceneId={snapshot.selectedSceneId}
            viewMode={snapshot.viewMode}
            onDiagnosticsChange={setDiagnostics}
          />
          <div className="r3f-lab-stage-footer">
            <p>
              Spike A zatím drží shell, renderer baseline a serializovaný preset boundary. Produkční `Star Core
              interior` se sem ještě nepřenáší.
            </p>
          </div>
        </section>

        <aside className="r3f-lab-column">
          <ShellSection
            title="Diagnostika"
            aside={
              diagnosticsModel.warnings.length ? (
                <span className="r3f-lab-warning-pill">{forceWarning ? "forced warning" : "warning"}</span>
              ) : null
            }
          >
            <button
              className="r3f-lab-ghost-button"
              data-active={forceWarning ? "true" : "false"}
              type="button"
              onClick={handleToggleForceWarning}
            >
              {forceWarning ? "Vypnout forced warning" : "Vynutit warning"}
            </button>
            <div className="r3f-lab-diagnostics">
              {diagnosticsModel.rows.map((row) => (
                <div key={row.key} className="r3f-lab-diagnostics-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            {diagnosticsModel.warnings.length ? (
              <ul className="r3f-lab-warning-list">
                {diagnosticsModel.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="r3f-lab-hint">Baseline je v normě pro current placeholder shell.</p>
            )}
          </ShellSection>

          <ShellSection
            title="Události"
            aside={
              <button className="r3f-lab-ghost-button" type="button" onClick={clearEventLog}>
                Vyčistit
              </button>
            }
          >
            <div className="r3f-lab-event-log">
              {eventLog.length ? (
                [...eventLog].reverse().map((entry) => (
                  <article key={entry.id} className="r3f-lab-event-item">
                    <strong>{entry.label}</strong>
                    <span>{entry.kind}</span>
                    {entry.detail ? <small>{entry.detail}</small> : null}
                  </article>
                ))
              ) : (
                <p className="r3f-lab-hint">Zatím bez interakční stopy.</p>
              )}
            </div>
          </ShellSection>

          <ShellSection title="Boundary">
            <div className="r3f-lab-diagnostics">
              <div className="r3f-lab-diagnostics-row">
                <span>Scéna</span>
                <strong>{snapshot.selectedSceneId}</strong>
              </div>
              <div className="r3f-lab-diagnostics-row">
                <span>Preset verze</span>
                <strong>{selectedSceneConfig?.presetVersion || "0"}</strong>
              </div>
              <div className="r3f-lab-diagnostics-row">
                <span>View mode</span>
                <strong>{snapshot.viewMode}</strong>
              </div>
            </div>
          </ShellSection>
        </aside>
      </div>
    </main>
  );
}
