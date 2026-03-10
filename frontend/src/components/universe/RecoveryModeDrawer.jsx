const panelStyle = {
  position: "fixed",
  top: 18,
  right: 18,
  zIndex: 65,
  width: "min(420px, calc(100vw - 24px))",
  borderRadius: 18,
  border: "1px solid rgba(255, 169, 196, 0.28)",
  background:
    "linear-gradient(180deg, rgba(28, 13, 26, 0.95), rgba(12, 10, 21, 0.98)), radial-gradient(circle at top right, rgba(255, 122, 172, 0.18), transparent 44%)",
  color: "#ffe7f0",
  boxShadow: "0 28px 80px rgba(0, 0, 0, 0.48), 0 0 42px rgba(255, 121, 177, 0.16)",
  backdropFilter: "blur(18px)",
  padding: 16,
  display: "grid",
  gap: 12,
};

const ghostButtonStyle = {
  border: "1px solid rgba(255, 204, 226, 0.22)",
  background: "rgba(28, 18, 33, 0.92)",
  color: "#ffe7f0",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
};

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
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255, 185, 212, 0.24)",
            background: "rgba(44, 19, 31, 0.4)",
            padding: "10px 11px",
            display: "grid",
            gap: 6,
          }}
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
              border: "1px solid rgba(255, 175, 203, 0.5)",
              background: "linear-gradient(120deg, #ff8eb7, #ffd0e1)",
              color: "#3d1227",
              borderRadius: 10,
              padding: "9px 12px",
              fontWeight: 700,
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
