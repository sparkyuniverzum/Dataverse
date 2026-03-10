import {
  createFloatingDrawerStyle,
  createGhostButtonStyle,
  createPanelCardStyle,
  createPrimaryButtonStyle,
  SURFACE_TONE,
} from "./surfaceVisualTokens";

const panelStyle = createFloatingDrawerStyle(SURFACE_TONE.RECOVERY);
const ghostButtonStyle = createGhostButtonStyle(SURFACE_TONE.RECOVERY);
const primaryButtonStyle = createPrimaryButtonStyle(SURFACE_TONE.RECOVERY);

export function RecoveryModeDrawer({ recovery, onClose, onApplyRepair }) {
  if (!recovery?.open) return null;

  return (
    <aside data-testid="recovery-mode-drawer" style={panelStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "0.18em", opacity: 0.78 }}>RECOVERY MODE</div>
        <div style={{ fontSize: "var(--dv-fs-lg)", fontWeight: 700 }}>{recovery.title}</div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          Blokovany nebo degradovany workspace stav je oddeleny do jednoho opravneho surface.
        </div>
      </div>

      {recovery.hasRuntimeError ? (
        <div
          data-testid="recovery-mode-error"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255, 140, 170, 0.28)",
            background: "rgba(67, 22, 35, 0.48)",
            padding: "9px 10px",
            fontSize: "var(--dv-fs-xs)",
          }}
        >
          {recovery.summary}
        </div>
      ) : null}

      {recovery.hasConnectivityIssue && recovery.connectivityMessage ? (
        <div
          data-testid="recovery-mode-connectivity"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255, 205, 158, 0.24)",
            background: "rgba(55, 33, 18, 0.42)",
            padding: "9px 10px",
            fontSize: "var(--dv-fs-xs)",
          }}
        >
          {recovery.connectivityMessage}
        </div>
      ) : null}

      {recovery.hasRepairSuggestion ? (
        <div
          data-testid="recovery-mode-repair"
          style={createPanelCardStyle({
            border: "1px solid rgba(255, 185, 212, 0.24)",
            background: "rgba(44, 19, 31, 0.4)",
          })}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
            {recovery.repairSuggestion.mineral_key} -&gt;{" "}
            <strong>{recovery.repairSuggestion.suggested_raw_value}</strong>
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>
            strategy={recovery.repairSuggestion.strategy_key} | {recovery.auditLabel}
          </div>
          <button
            type="button"
            data-testid="recovery-mode-apply-repair"
            style={{
              ...primaryButtonStyle,
              cursor: recovery.repairApplyBusy ? "wait" : "pointer",
            }}
            disabled={!recovery.repairSuggestion.civilization_id || recovery.repairApplyBusy}
            onClick={() => void onApplyRepair?.()}
          >
            {recovery.repairApplyBusy ? "Aplikuji opravu..." : "Aplikovat navrh opravy"}
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" data-testid="recovery-mode-close" onClick={onClose} style={ghostButtonStyle}>
          Zavrit recovery
        </button>
      </div>
    </aside>
  );
}
