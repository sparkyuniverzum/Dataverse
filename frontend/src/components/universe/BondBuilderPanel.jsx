function inputStyle() {
  return {
    width: "100%",
    borderRadius: 9,
    border: "1px solid rgba(112, 205, 238, 0.24)",
    background: "rgba(4, 10, 18, 0.92)",
    color: "#ddf7ff",
    padding: "7px 9px",
    fontSize: "var(--dv-fs-xs)",
    lineHeight: "var(--dv-lh-base)",
    boxSizing: "border-box",
  };
}

function buttonStyle({ primary = false } = {}) {
  if (primary) {
    return {
      border: "1px solid rgba(114, 219, 252, 0.5)",
      background: "linear-gradient(120deg, #21bbea, #44d8ff)",
      color: "#072737",
      borderRadius: 9,
      padding: "8px 10px",
      fontWeight: 700,
      fontSize: "var(--dv-fs-xs)",
      cursor: "pointer",
    };
  }
  return {
    border: "1px solid rgba(113, 202, 234, 0.3)",
    background: "rgba(7, 18, 32, 0.86)",
    color: "#d5f5ff",
    borderRadius: 9,
    padding: "8px 10px",
    fontSize: "var(--dv-fs-xs)",
    cursor: "pointer",
  };
}

function normalizeReasons(preview) {
  const rows = Array.isArray(preview?.reasons) ? preview.reasons : [];
  return rows.map((item) => ({
    code: String(item?.code || "unknown"),
    severity: String(item?.severity || "error"),
    message: String(item?.message || "Validation failed"),
    blocking: Boolean(item?.blocking),
  }));
}

export default function BondBuilderPanel({
  open = false,
  visualBuilderState = "",
  options = [],
  selectedAsteroidId = "",
  bondState = "BOND_IDLE",
  sourceId = "",
  targetId = "",
  bondType = "RELATION",
  preview = null,
  previewBusy = false,
  commitBusy = false,
  onStartDraft = null,
  onSourceChange = null,
  onTargetChange = null,
  onTypeChange = null,
  onRequestPreview = null,
  onCommit = null,
  onCancel = null,
}) {
  if (!open) return null;
  const reasonRows = normalizeReasons(preview);
  const isPreviewCommittable =
    String(preview?.decision || "").toUpperCase() !== "REJECT" && !preview?.blocking && !previewBusy;

  return (
    <aside
      data-testid="bond-builder-panel"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 58,
        width: "min(440px, calc(100vw - 24px))",
        borderRadius: 14,
        border: "1px solid rgba(108, 206, 240, 0.34)",
        background: "rgba(5, 13, 24, 0.9)",
        color: "#ddf7ff",
        padding: 11,
        display: "grid",
        gap: 8,
        boxShadow: "0 0 24px rgba(34, 132, 182, 0.18)",
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
        BOND BUILDER
      </div>
      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
        Flow: source -&gt; target -&gt; type -&gt; preview -&gt; commit | state: <strong>{bondState}</strong>
      </div>
      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>
        visual_state: <strong>{String(visualBuilderState || "n/a")}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>SOURCE CIVILIZATION</span>
          <select
            data-testid="bond-source-select"
            value={sourceId}
            onChange={(event) => {
              if (typeof onSourceChange === "function") onSourceChange(String(event.target.value || ""));
            }}
            style={inputStyle()}
          >
            <option value="">Vyber source</option>
            {options.map((item) => (
              <option key={`source-${item.id}`} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>TARGET CIVILIZATION</span>
          <select
            data-testid="bond-target-select"
            value={targetId}
            onChange={(event) => {
              if (typeof onTargetChange === "function") onTargetChange(String(event.target.value || ""));
            }}
            style={inputStyle()}
          >
            <option value="">Vyber target</option>
            {options
              .filter((item) => String(item.id) !== String(sourceId))
              .map((item) => (
                <option key={`target-${item.id}`} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: 3 }}>
        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>BOND TYPE</span>
        <select
          data-testid="bond-type-select"
          value={bondType}
          onChange={(event) => {
            if (typeof onTypeChange === "function") onTypeChange(String(event.target.value || ""));
          }}
          style={inputStyle()}
        >
          {["RELATION", "FLOW", "TYPE", "GUARDIAN"].map((item) => (
            <option key={`bond-type-${item}`} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          style={buttonStyle()}
          data-testid="bond-start-selected-button"
          onClick={() => {
            if (typeof onStartDraft === "function") onStartDraft(String(selectedAsteroidId || ""));
          }}
          disabled={!selectedAsteroidId}
        >
          Start from selected
        </button>
        <button
          type="button"
          style={buttonStyle({ primary: true })}
          data-testid="bond-preview-button"
          onClick={() => {
            if (typeof onRequestPreview === "function") onRequestPreview();
          }}
          disabled={previewBusy || !sourceId || !targetId || !bondType}
        >
          {previewBusy ? "Preview..." : "Preview"}
        </button>
        <button
          type="button"
          style={buttonStyle({ primary: true })}
          data-testid="bond-commit-button"
          onClick={() => {
            if (typeof onCommit === "function") onCommit();
          }}
          disabled={commitBusy || !isPreviewCommittable}
        >
          {commitBusy ? "Commit..." : "Commit"}
        </button>
        <button
          type="button"
          style={buttonStyle()}
          data-testid="bond-cancel-button"
          onClick={() => {
            if (typeof onCancel === "function") onCancel();
          }}
        >
          Cancel
        </button>
      </div>

      <div
        data-testid="bond-preview-card"
        style={{
          border: "1px solid rgba(95, 183, 218, 0.22)",
          borderRadius: 9,
          background: "rgba(7, 20, 34, 0.72)",
          padding: "7px 8px",
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
          PRE-COMMIT VALIDATION
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
          decision: <strong>{String(preview?.decision || "n/a")}</strong> | blocking:{" "}
          <strong>{preview?.blocking ? "true" : "false"}</strong>
        </div>
        {reasonRows.length ? (
          reasonRows.map((row, index) => (
            <div key={`${row.code}-${index}`} style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
              [{row.severity}] {row.code}: {row.message}
            </div>
          ))
        ) : (
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>
            Preview ještě neproběhlo nebo nevrátilo žádné reasons.
          </div>
        )}
      </div>
    </aside>
  );
}
