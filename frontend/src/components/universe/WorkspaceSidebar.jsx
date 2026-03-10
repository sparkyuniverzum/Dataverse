import { resolvePreviewSeverityColor } from "./previewAccessibility";
import { deriveCivilizationInspectorModel } from "./civilizationInspectorModel";

const inputStyle = {
  width: "100%",
  borderRadius: 9,
  border: "1px solid rgba(112, 205, 238, 0.24)",
  background: "rgba(4, 10, 18, 0.92)",
  color: "#ddf7ff",
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
};

const actionButtonStyle = {
  border: "1px solid rgba(114, 219, 252, 0.5)",
  background: "linear-gradient(120deg, #21bbea, #44d8ff)",
  color: "#072737",
  borderRadius: 10,
  padding: "8px 11px",
  fontWeight: 700,
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  boxShadow: "0 0 14px rgba(55, 178, 224, 0.2)",
  transition: "transform 120ms ease, box-shadow 180ms ease, filter 180ms ease",
};

const ghostButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease",
};

const selectStyle = {
  ...inputStyle,
  padding: "6px 8px",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(181, 236, 255, 0.78) 50%), linear-gradient(135deg, rgba(181, 236, 255, 0.78) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  paddingRight: 24,
};

const hudBadgeStyle = {
  border: "1px solid rgba(101, 191, 223, 0.3)",
  background: "rgba(8, 18, 31, 0.85)",
  color: "#d8f6ff",
  borderRadius: 999,
  padding: "4px 9px",
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  lineHeight: "var(--dv-lh-compact)",
};

export default function WorkspaceSidebar({
  galaxy,
  branches = [],
  selectedBranchId = "",
  onSelectBranch = null,
  branchCreateName = "",
  onBranchCreateNameChange = null,
  branchCreateBusy = false,
  onCreateBranch = null,
  branchPromoteBusy = false,
  branchPromoteSummary = "",
  onPromoteBranch = null,
  onboarding = null,
  tableNodes,
  asteroidCount,
  bondCount,
  loading,
  busy,
  error,
  selectedTableId,
  selectedTableLabel,
  selectedAsteroidLabel,
  moonRows = [],
  moonImpact = null,
  moonImpactLoading = false,
  moonImpactError = "",
  selectedMoonId = "",
  onSelectTable,
  onSelectMoon = null,
  onOpenGrid,
  onAddPlanet = null,
  onRefresh,
  onOpenStarHeart,
  onBackToGalaxies,
  onLogout,
  interactionLocked = false,
  builderState = "",
  builderTitle = "",
  builderWhy = "",
  builderAction = "",
  builderSeverity = "info",
  repairSuggestion = null,
  repairApplyBusy = false,
  onApplyRepair = null,
  repairAuditCount = 0,
}) {
  const severityColor = resolvePreviewSeverityColor(builderSeverity);
  const safeMoonRows = Array.isArray(moonRows) ? moonRows : [];
  const selectedMoon =
    safeMoonRows.find((row) => String(row?.id || "") === String(selectedMoonId || "")) ||
    safeMoonRows.find((row) => String(row?.value || "") === String(selectedAsteroidLabel || "")) ||
    null;
  const moonInspector = deriveCivilizationInspectorModel(selectedMoon, moonImpact, selectedMoonId);

  return (
    <aside
      style={{
        position: "fixed",
        right: 12,
        top: 12,
        zIndex: 56,
        width: "min(360px, calc(100vw - 24px))",
        borderRadius: 14,
        border: "1px solid rgba(96, 189, 223, 0.32)",
        background: "rgba(5, 13, 24, 0.82)",
        color: "#d9f8ff",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 24px rgba(34, 132, 182, 0.2)",
        padding: "10px 10px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84 }}>SIDEBAR</div>
      <div style={{ fontSize: "var(--dv-fs-sm)" }}>
        Galaxie: <strong>{galaxy?.name || "n/a"}</strong>
      </div>
      <div style={{ display: "grid", gap: 4, fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
        <div>
          Aktivni branches: <strong>{Array.isArray(branches) ? branches.length : 0}</strong>
        </div>
        <div>
          Onboarding: <strong>{String(onboarding?.current_stage_key || "n/a")}</strong>
        </div>
        <div>
          Rezim: <strong>{String(onboarding?.mode || "n/a")}</strong> | Can advance:{" "}
          <strong>{onboarding?.can_advance ? "ano" : "ne"}</strong>
        </div>
      </div>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, letterSpacing: "var(--dv-tr-wide)" }}>
          TIMELINE (BRANCH)
        </span>
        <select
          data-testid="workspace-branch-select"
          value={String(selectedBranchId || "")}
          onChange={(event) => {
            if (typeof onSelectBranch === "function") {
              onSelectBranch(String(event.target.value || ""));
            }
          }}
          style={selectStyle}
        >
          <option value="">Main timeline</option>
          {(Array.isArray(branches) ? branches : [])
            .filter((item) => !item?.deleted_at)
            .map((branch) => (
              <option key={String(branch.id)} value={String(branch.id)}>
                {String(branch.name || branch.id)}
              </option>
            ))}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
        <input
          data-testid="workspace-branch-create-input"
          value={String(branchCreateName || "")}
          onChange={(event) => {
            if (typeof onBranchCreateNameChange === "function") {
              onBranchCreateNameChange(String(event.target.value || ""));
            }
          }}
          placeholder="Novy branch"
          style={inputStyle}
        />
        <button
          type="button"
          data-testid="workspace-branch-create-button"
          onClick={() => {
            if (typeof onCreateBranch === "function") {
              onCreateBranch();
            }
          }}
          disabled={branchCreateBusy || !String(branchCreateName || "").trim()}
          style={ghostButtonStyle}
        >
          {branchCreateBusy ? "Creating..." : "Create"}
        </button>
      </div>
      <button
        type="button"
        data-testid="workspace-branch-promote-button"
        onClick={() => {
          if (typeof onPromoteBranch === "function") {
            onPromoteBranch();
          }
        }}
        disabled={!selectedBranchId || branchPromoteBusy}
        style={ghostButtonStyle}
      >
        {branchPromoteBusy ? "Promoting..." : "Promote branch"}
      </button>
      {branchPromoteSummary ? (
        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }} data-testid="branch-promote-summary">
          {branchPromoteSummary}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={hudBadgeStyle}>Planety {tableNodes.length}</span>
        <span style={hudBadgeStyle}>Civilizace {asteroidCount}</span>
        <span style={hudBadgeStyle}>Vazby {bondCount}</span>
        {loading ? <span style={{ ...hudBadgeStyle, color: "#9de7ff" }}>Nacitam...</span> : null}
        {busy ? <span style={{ ...hudBadgeStyle, color: "#ffd59c" }}>Ukladam...</span> : null}
      </div>

      {builderState ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            border: "1px solid rgba(108, 206, 240, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.56)",
            padding: "8px 9px",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            PLANET BUILDER
          </div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
            Stav: <strong>{builderState}</strong>
          </div>
          {builderTitle ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", color: severityColor }}>
              <strong>{builderTitle}</strong>
            </div>
          ) : null}
          {builderWhy ? (
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, lineHeight: "var(--dv-lh-base)" }}>
              {builderWhy}
            </div>
          ) : null}
          {builderAction ? (
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, lineHeight: "var(--dv-lh-base)" }}>
              {builderAction}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpenStarHeart}
        data-testid="workspace-open-star-heart-button"
        style={actionButtonStyle}
      >
        Vstoupit do srdce hvezdy
      </button>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, letterSpacing: "var(--dv-tr-wide)" }}>
          AKTIVNI PLANETA
        </span>
        <select
          value={selectedTableId}
          onChange={(event) => onSelectTable(String(event.target.value || ""))}
          style={selectStyle}
          disabled={!tableNodes.length || interactionLocked}
        >
          {tableNodes.length ? (
            tableNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.entityName} &gt; {node.label}
              </option>
            ))
          ) : (
            <option value="">Zatim bez planet</option>
          )}
        </select>
      </label>

      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
        {selectedTableLabel || "Vyber planetu kliknutim v prostoru."}
      </div>
      {selectedAsteroidLabel ? (
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          Vybrana civilizace: <strong>{selectedAsteroidLabel}</strong>
        </div>
      ) : null}
      {selectedTableId ? (
        <div
          style={{
            border: "1px solid rgba(108, 206, 240, 0.24)",
            borderRadius: 10,
            background: "rgba(6, 18, 30, 0.56)",
            padding: "8px 9px",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
            CIVILIZATION ORBIT
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>
            Civilizace kolem planety: <strong>{safeMoonRows.length}</strong> | 1 klik = Inspector
          </div>
          {safeMoonRows.length ? (
            <div
              data-testid="moon-orbit-list"
              style={{ display: "grid", gap: 5, maxHeight: 156, overflow: "auto", paddingRight: 2 }}
            >
              {safeMoonRows.map((moon) => {
                const moonId = String(moon?.id || "").trim();
                const selected = moonId && moonId === String(selectedMoonId || "");
                const label = String(moon?.value || moonId || "Civilizace");
                return (
                  <button
                    key={moonId || label}
                    type="button"
                    data-testid={`moon-orbit-item-${moonId || "unknown"}`}
                    onClick={() => {
                      if (typeof onSelectMoon === "function") {
                        onSelectMoon(moonId);
                      }
                    }}
                    style={{
                      border: selected ? "1px solid rgba(121, 224, 255, 0.64)" : "1px solid rgba(113, 202, 234, 0.3)",
                      background: selected
                        ? "linear-gradient(120deg, rgba(34, 127, 168, 0.74), rgba(76, 195, 230, 0.34))"
                        : "rgba(7, 18, 32, 0.86)",
                      color: "#d7f7ff",
                      borderRadius: 9,
                      padding: "6px 8px",
                      fontSize: "var(--dv-fs-xs)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.68 }}>Planeta zatim nema civilizacni zaznamy.</div>
          )}
          {selectedMoon ? (
            <div
              data-testid="moon-inspector-card"
              style={{
                border: "1px solid rgba(104, 196, 228, 0.24)",
                borderRadius: 9,
                background: "rgba(7, 20, 34, 0.74)",
                padding: "7px 8px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>
                CIVILIZATION INSPECTOR
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
                Stav: <strong>{moonInspector.state}</strong> | violations:{" "}
                <strong>{moonInspector.violationCount}</strong>
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                health: {moonInspector.healthScore} | event_seq: {moonInspector.eventSeq}
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                Nerosty pod vlivem:{" "}
                {moonInspector.impactedMinerals.length ? moonInspector.impactedMinerals.join(", ") : "n/a"}
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
                Aktivni pravidla: {moonInspector.activeRules.length ? moonInspector.activeRules.join(", ") : "n/a"}
              </div>
              <button
                type="button"
                data-testid="moon-inspector-open-grid-button"
                onClick={() => {
                  if (typeof onOpenGrid === "function") {
                    onOpenGrid();
                  }
                }}
                disabled={!selectedTableId || interactionLocked}
                style={ghostButtonStyle}
              >
                Otevrit v grid inspectoru
              </button>
              {moonImpactLoading ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.68 }}>Nacitam impact data...</div>
              ) : null}
              {moonImpactError ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffc1d3", opacity: 0.92 }}>{moonImpactError}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button
          type="button"
          onClick={() => {
            if (typeof onAddPlanet === "function") {
              onAddPlanet();
            }
          }}
          disabled={busy}
          data-testid="workspace-add-planet-button"
          style={actionButtonStyle}
        >
          Pridat planetu
        </button>
        <button
          type="button"
          onClick={onOpenGrid}
          disabled={!selectedTableId || interactionLocked}
          data-testid="workspace-open-grid-button"
          style={actionButtonStyle}
        >
          Otevrit grid
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} style={ghostButtonStyle}>
          {loading ? "..." : "Refresh"}
        </button>
        <button type="button" onClick={onBackToGalaxies} style={ghostButtonStyle}>
          Vyber galaxie
        </button>
        <button
          type="button"
          onClick={onLogout}
          data-testid="auth-logout-button"
          style={{ ...ghostButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
        >
          Logout
        </button>
      </div>

      {error ? (
        <div
          style={{
            fontSize: "var(--dv-fs-xs)",
            color: "#ffb7c9",
            borderTop: "1px solid rgba(255, 134, 170, 0.22)",
            paddingTop: 6,
            lineHeight: "var(--dv-lh-base)",
          }}
        >
          {error}
        </div>
      ) : null}

      {repairSuggestion ? (
        <div
          style={{
            borderTop: "1px solid rgba(118, 215, 247, 0.24)",
            paddingTop: 6,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.8 }}>
            GUIDED REPAIR
          </div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
            {repairSuggestion.mineral_key} -&gt; <strong>{repairSuggestion.suggested_raw_value}</strong>
          </div>
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76 }}>
            strategy={repairSuggestion.strategy_key} | audit log={repairAuditCount}
          </div>
          <button
            type="button"
            style={actionButtonStyle}
            disabled={!repairSuggestion.civilization_id || repairApplyBusy}
            onClick={() => {
              if (typeof onApplyRepair === "function") {
                onApplyRepair();
              }
            }}
          >
            {repairApplyBusy ? "Aplikuji opravu..." : "Aplikovat navrh opravy"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
