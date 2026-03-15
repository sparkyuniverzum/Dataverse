export function ParserComposerModal({
  composer,
  commandInputRef,
  commandInput = "",
  onCommandInputChange,
  onPreview,
  onExecute,
  onClose,
  onResolveToActivePlanet,
  onResolveTableChange,
  onResolveToPickedPlanet,
}) {
  if (!composer?.open) return null;

  return (
    <section
      data-testid="workspace-command-bar-modal"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 63,
        display: "grid",
        placeItems: "start center",
        paddingTop: 48,
        background: "radial-gradient(circle at 50% 20%, rgba(19, 42, 66, 0.2), rgba(2, 6, 14, 0.74))",
      }}
    >
      <article
        style={{
          width: "min(760px, calc(100vw - 24px))",
          borderRadius: 14,
          border: "1px solid rgba(126, 216, 250, 0.38)",
          background: "rgba(5, 13, 24, 0.94)",
          color: "#d8f8ff",
          padding: 14,
          display: "grid",
          gap: 10,
          boxShadow: "0 0 24px rgba(46, 145, 189, 0.24)",
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
          COMMAND BAR
        </div>
        <input
          ref={commandInputRef}
          data-testid="command-bar-input"
          value={commandInput}
          onChange={(event) => onCommandInputChange?.(event.target.value)}
          placeholder='Např. "Invoice 2026" (table: Finance > Cashflow, amount: 1250, status: paid)'
          style={{
            width: "100%",
            borderRadius: 10,
            border: "1px solid rgba(112, 205, 238, 0.24)",
            background: "rgba(4, 10, 18, 0.92)",
            color: "#ddf7ff",
            padding: "10px 11px",
            fontSize: "var(--dv-fs-sm)",
            lineHeight: "var(--dv-lh-base)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="command-bar-preview-button"
            onClick={() => void onPreview?.()}
            disabled={!composer.canPreview}
            style={{
              border: "1px solid rgba(114, 219, 252, 0.5)",
              background: "linear-gradient(120deg, #21bbea, #44d8ff)",
              color: "#072737",
              borderRadius: 9,
              padding: "8px 10px",
              fontWeight: 700,
              cursor: composer.previewBusy ? "wait" : "pointer",
            }}
          >
            {composer.previewBusy ? "Generuji nahled..." : "Nahled"}
          </button>
          <button
            type="button"
            data-testid="command-bar-execute-button"
            onClick={() => void onExecute?.()}
            disabled={!composer.canExecute}
            style={{
              border: "1px solid rgba(128, 226, 182, 0.52)",
              background: "linear-gradient(120deg, #2bbd82, #7ee5af)",
              color: "#073323",
              borderRadius: 9,
              padding: "8px 10px",
              fontWeight: 700,
              cursor: composer.executeBusy ? "wait" : "pointer",
            }}
          >
            {composer.executeBusy ? "Provadim..." : "Potvrdit a vykonat"}
          </button>
          <button
            type="button"
            data-testid="command-bar-cancel-button"
            onClick={onClose}
            style={{
              border: "1px solid rgba(113, 202, 234, 0.3)",
              background: "rgba(7, 18, 32, 0.86)",
              color: "#d5f5ff",
              borderRadius: 9,
              padding: "8px 10px",
              cursor: "pointer",
            }}
          >
            Zavrit
          </button>
        </div>
        <div
          style={{
            border: "1px solid rgba(95, 188, 220, 0.26)",
            borderRadius: 10,
            background: "rgba(7, 18, 32, 0.74)",
            padding: "8px 9px",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
            Nahled je backend preview (bez zapisu). Trvaly zapis probiha az po potvrzeni.
          </div>
          {composer.preview ? (
            <>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
                Akce: <strong>{composer.preview.action}</strong>
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                Plan uloh: <strong>{composer.preview.taskCount}</strong>
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>
                Kontext: {composer.preview.selectedTableLabel || "bez aktivni planety"}
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>
                Nahled dopadu: civilizace <strong>{composer.preview.civilizationsCount}</strong> | vazby{" "}
                <strong>{composer.preview.bondsCount}</strong>
              </div>
              {composer.preview.entities.length ? (
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>
                  Entity: {composer.preview.entities.join(", ")}
                </div>
              ) : null}
              {composer.preview.warnings.length ? (
                <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffc08f" }}>
                  {composer.preview.warnings.join(" ")}
                </div>
              ) : null}
              {composer.preview.ambiguityHints.length ? (
                <div
                  data-testid="command-bar-ambiguity-hints"
                  style={{
                    border: "1px solid rgba(248, 187, 128, 0.35)",
                    background: "rgba(51, 30, 15, 0.45)",
                    borderRadius: 8,
                    padding: "6px 8px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.9 }}>
                    AMBIGUITY HINTS
                  </div>
                  {composer.preview.ambiguityHints.map((hint, idx) => (
                    <div
                      key={`${hint?.severity || "warning"}-${idx}`}
                      style={{
                        fontSize: "var(--dv-fs-xs)",
                        color: hint?.severity === "blocking" ? "#ffb5b5" : "#ffd5a3",
                      }}
                    >
                      {hint?.severity === "blocking" ? "BLOCK" : "WARN"}: {hint?.message}
                    </div>
                  ))}
                  {composer.resolve.showAction ? (
                    composer.resolve.showResolveToActivePlanet ? (
                      <button
                        type="button"
                        data-testid="command-bar-resolve-planet-button"
                        onClick={() => void onResolveToActivePlanet?.()}
                        disabled={composer.busy}
                        style={{
                          marginTop: 2,
                          border: "1px solid rgba(146, 229, 185, 0.42)",
                          background: "rgba(20, 66, 44, 0.56)",
                          color: "#d2ffe7",
                          borderRadius: 8,
                          padding: "7px 8px",
                          fontSize: "var(--dv-fs-xs)",
                          cursor: composer.previewBusy ? "wait" : "pointer",
                        }}
                      >
                        Pouzit aktivni planetu a pregenerovat nahled
                      </button>
                    ) : composer.resolve.showResolvePlanetPicker ? (
                      <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                        <select
                          data-testid="command-bar-resolve-planet-select"
                          value={composer.resolve.tableId}
                          onChange={(event) => onResolveTableChange?.(event.target.value)}
                          style={{
                            border: "1px solid rgba(113, 202, 234, 0.3)",
                            background: "rgba(7, 18, 32, 0.86)",
                            color: "#d5f5ff",
                            borderRadius: 8,
                            padding: "7px 8px",
                            fontSize: "var(--dv-fs-xs)",
                          }}
                        >
                          <option value="">Vyber cilovou planetu</option>
                          {composer.resolve.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          data-testid="command-bar-resolve-planet-picker-button"
                          onClick={() => void onResolveToPickedPlanet?.()}
                          disabled={!composer.resolve.canPickPlanet}
                          style={{
                            border: "1px solid rgba(146, 229, 185, 0.42)",
                            background: "rgba(20, 66, 44, 0.56)",
                            color: "#d2ffe7",
                            borderRadius: 8,
                            padding: "7px 8px",
                            fontSize: "var(--dv-fs-xs)",
                            cursor: composer.previewBusy ? "wait" : "pointer",
                          }}
                        >
                          Vybrat planetu a pregenerovat nahled
                        </button>
                      </div>
                    ) : null
                  ) : null}
                </div>
              ) : null}
              {composer.resolveSummary ? (
                <div
                  data-testid="command-bar-resolve-summary"
                  style={{
                    border: "1px solid rgba(124, 219, 170, 0.38)",
                    background: "rgba(18, 60, 39, 0.46)",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: "var(--dv-fs-xs)",
                    color: "#d7ffe9",
                  }}
                >
                  {composer.resolveSummary}
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>{composer.emptyStateMessage}</div>
          )}
          {composer.error ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffb4b4" }}>{composer.error}</div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
