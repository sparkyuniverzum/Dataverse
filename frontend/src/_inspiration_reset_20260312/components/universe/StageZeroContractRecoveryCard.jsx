import { buildContractViolationRecovery } from "./contractViolationRecovery";

export function StageZeroContractRecoveryCard({
  errorMessage,
  knownFieldKeys = [],
  onAutofix,
  onOpenSchema,
  onRevalidate,
}) {
  const recovery = buildContractViolationRecovery(errorMessage, { knownFieldKeys });
  if (!recovery.hasViolation || !recovery.missingFields.length) return null;

  return (
    <div
      data-testid="stage0-contract-recovery-card"
      style={{
        border: "1px solid rgba(255, 178, 147, 0.42)",
        borderRadius: 8,
        background: "rgba(39, 14, 14, 0.58)",
        padding: "7px 8px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", color: "#ffd4c3" }}>
        CONTRACT RECOVERY
      </div>
      <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffd9c9" }}>
        Chybi povinna pole: <strong>{recovery.missingFields.join(", ")}</strong>
      </div>
      {recovery.unresolved.length ? (
        <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffd4c3", opacity: 0.9 }}>
          Neznamy klic pro stage0 auto-opravu: {recovery.unresolved.join(", ")}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          data-testid="stage0-recovery-autofix-button"
          onClick={() => {
            onAutofix?.(recovery.recoverable);
          }}
          disabled={!recovery.recoverable.length}
          style={{
            border: "1px solid rgba(245, 182, 138, 0.56)",
            background: "rgba(73, 34, 21, 0.86)",
            color: "#ffe5d8",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: "var(--dv-fs-2xs)",
            fontWeight: 700,
            cursor: recovery.recoverable.length ? "pointer" : "not-allowed",
            opacity: recovery.recoverable.length ? 1 : 0.64,
          }}
        >
          Doplnit automaticky
        </button>
        <button
          type="button"
          data-testid="stage0-recovery-open-schema-button"
          onClick={() => onOpenSchema?.()}
          style={{
            border: "1px solid rgba(124, 214, 247, 0.52)",
            background: "rgba(10, 27, 42, 0.78)",
            color: "#d5f4ff",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: "var(--dv-fs-2xs)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Otevrit schema composer
        </button>
        <button
          type="button"
          data-testid="stage0-recovery-revalidate-button"
          onClick={() => onRevalidate?.()}
          style={{
            border: "1px solid rgba(114, 219, 252, 0.5)",
            background: "rgba(8, 22, 36, 0.72)",
            color: "#d7f7ff",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: "var(--dv-fs-2xs)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Znovu validovat
        </button>
      </div>
    </div>
  );
}
