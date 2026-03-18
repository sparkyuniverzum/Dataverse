import { useDeferredValue } from "react";

function cardStyle() {
  return {
    borderRadius: "1.2rem",
    border: "1px solid rgba(119, 211, 255, 0.18)",
    background: "linear-gradient(160deg, rgba(5, 13, 30, 0.94), rgba(3, 8, 18, 0.88))",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.38)",
  };
}

function summarizePreview(preview = null) {
  const source = preview && typeof preview === "object" ? preview : {};
  const becauseChain = Array.isArray(source.becauseChain) ? source.becauseChain : [];
  const expectedEvents = Array.isArray(source.expectedEvents) ? source.expectedEvents : [];
  const riskFlags = Array.isArray(source.riskFlags) ? source.riskFlags : [];
  return {
    resolvedCommand: String(source.resolvedCommand || "").trim(),
    becauseChain,
    expectedEvents,
    riskFlags,
    taskCount: Math.max(0, Array.isArray(source.tasks) ? source.tasks.length : 0),
  };
}

export default function WorkspaceCommandBar({
  isOpen = false,
  command = "",
  preview = null,
  busy = false,
  error = "",
  feedback = "",
  onChange = () => {},
  onClose = () => {},
  onPreview = () => {},
  onCommit = () => {},
}) {
  const deferredCommand = useDeferredValue(command);
  const previewSummary = summarizePreview(preview);

  if (!isOpen) return null;

  return (
    <section
      data-testid="command-bar"
      aria-label="Command Bar"
      style={{
        position: "absolute",
        left: "50%",
        top: "1.4rem",
        transform: "translateX(-50%)",
        zIndex: 32,
        width: "min(920px, calc(100vw - 2rem))",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <div style={{ ...cardStyle(), padding: "1rem" }}>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
            <div style={{ display: "grid", gap: "0.16rem" }}>
              <strong style={{ fontSize: "0.98rem", color: "#f3fbff" }}>Command Bar</strong>
              <span style={{ fontSize: "0.78rem", color: "rgba(206, 227, 242, 0.72)" }}>
                Preview je povinny pred commit. MVP write surface je jen tady.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(118, 208, 255, 0.24)",
                background: "rgba(4, 12, 28, 0.74)",
                color: "#eaf8ff",
                padding: "0.52rem 0.8rem",
                cursor: "pointer",
              }}
            >
              Zavrit
            </button>
          </div>

          <textarea
            data-testid="command-input"
            value={command}
            onChange={(event) => onChange(event.target.value)}
            placeholder="napr. nastav civ-001.status na aktivni"
            rows={3}
            style={{
              width: "100%",
              borderRadius: "1rem",
              border: "1px solid rgba(120, 213, 255, 0.24)",
              background: "rgba(2, 8, 19, 0.92)",
              color: "#f2fbff",
              padding: "0.95rem 1rem",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              data-testid="command-preview-trigger"
              onClick={onPreview}
              disabled={busy || !String(command || "").trim()}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(255, 213, 125, 0.34)",
                background: busy ? "rgba(61, 74, 87, 0.72)" : "linear-gradient(120deg, #f5c76c, #fff0b8)",
                color: busy ? "rgba(232, 242, 248, 0.72)" : "#1c160b",
                padding: "0.74rem 1rem",
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "Pracuji..." : "Vytvorit preview"}
            </button>
            <button
              type="button"
              data-testid="command-commit"
              onClick={onCommit}
              disabled={busy || !previewSummary.taskCount}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(132, 229, 199, 0.3)",
                background: busy ? "rgba(61, 74, 87, 0.72)" : "rgba(7, 35, 31, 0.94)",
                color: busy ? "rgba(232, 242, 248, 0.72)" : "#d9fff3",
                padding: "0.74rem 1rem",
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Commit
            </button>
            <span style={{ fontSize: "0.78rem", color: "rgba(200, 223, 238, 0.66)" }}>
              Draft: {deferredCommand.trim() ? deferredCommand.trim() : "prazdny"}
            </span>
          </div>

          {error ? (
            <div
              data-testid="command-error"
              style={{
                borderRadius: "0.95rem",
                border: "1px solid rgba(255, 142, 118, 0.28)",
                background: "rgba(66, 18, 15, 0.52)",
                color: "#ffd5c8",
                padding: "0.8rem 0.95rem",
              }}
            >
              {error}
            </div>
          ) : null}

          {feedback ? (
            <div
              style={{
                borderRadius: "0.95rem",
                border: "1px solid rgba(121, 216, 255, 0.2)",
                background: "rgba(7, 18, 36, 0.6)",
                color: "#dff5ff",
                padding: "0.8rem 0.95rem",
                fontSize: "0.84rem",
              }}
            >
              {feedback}
            </div>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div data-testid="command-preview" style={{ ...cardStyle(), padding: "1rem", display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.18rem" }}>
            <strong style={{ color: "#f3fbff" }}>Preview</strong>
            <span style={{ color: "rgba(199, 223, 241, 0.72)", fontSize: "0.8rem" }}>
              {previewSummary.resolvedCommand || "Parser vratil preview bez resolved_command."}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", color: "#fff1c6" }}>{`Tasks: ${previewSummary.taskCount}`}</span>
            <span style={{ fontSize: "0.78rem", color: "#cdefff" }}>
              {`Expected events: ${previewSummary.expectedEvents.length}`}
            </span>
            <span
              style={{ fontSize: "0.78rem", color: "#d8ffef" }}
            >{`Because chain: ${previewSummary.becauseChain.length}`}</span>
          </div>

          {previewSummary.expectedEvents.length ? (
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {previewSummary.expectedEvents.map((eventItem, index) => (
                <div
                  key={`expected-event-${index}`}
                  style={{
                    borderRadius: "0.85rem",
                    border: "1px solid rgba(117, 205, 255, 0.12)",
                    background: "rgba(4, 11, 25, 0.56)",
                    color: "#e6f6ff",
                    padding: "0.68rem 0.8rem",
                    fontSize: "0.82rem",
                  }}
                >
                  {String(eventItem || "")}
                </div>
              ))}
            </div>
          ) : null}

          {previewSummary.becauseChain.length ? (
            <div style={{ display: "grid", gap: "0.3rem" }}>
              {previewSummary.becauseChain.map((item, index) => (
                <div key={`because-${index}`} style={{ color: "rgba(220, 238, 252, 0.78)", fontSize: "0.82rem" }}>
                  {String(item || "")}
                </div>
              ))}
            </div>
          ) : null}

          {previewSummary.riskFlags.length ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {previewSummary.riskFlags.map((item, index) => (
                <span
                  key={`risk-${index}`}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid rgba(255, 166, 122, 0.28)",
                    background: "rgba(66, 26, 13, 0.52)",
                    color: "#ffd9c6",
                    padding: "0.35rem 0.65rem",
                    fontSize: "0.76rem",
                  }}
                >
                  {String(item || "")}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
