import { useState } from "react";

function shellStyle() {
  return {
    width: "100vw",
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "2rem",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at 20% 18%, rgba(36, 117, 170, 0.28), transparent 30%), radial-gradient(circle at 78% 12%, rgba(255, 193, 93, 0.18), transparent 34%), linear-gradient(180deg, #040913 0%, #02050c 100%)",
    color: "#ebf8ff",
  };
}

function panelStyle() {
  return {
    width: "min(720px, 100%)",
    display: "grid",
    gap: "1.2rem",
    padding: "2rem",
    borderRadius: "1.5rem",
    border: "1px solid rgba(119, 212, 255, 0.24)",
    background: "linear-gradient(160deg, rgba(5, 13, 28, 0.92), rgba(3, 8, 18, 0.88))",
    boxShadow: "0 24px 90px rgba(0, 0, 0, 0.45)",
  };
}

export default function EmptyGalaxyBootstrapScreen({
  connectivity = null,
  busy = false,
  error = "",
  onCreateGalaxy = async () => {},
}) {
  const [name, setName] = useState("Moje galaxie");

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    await onCreateGalaxy({ name });
  }

  return (
    <main data-testid="empty-galaxy-screen" style={shellStyle()}>
      <section style={panelStyle()}>
        <div style={{ display: "grid", gap: "0.45rem" }}>
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              color: connectivity?.isOnline === false ? "#ffce9a" : "#8ee8ff",
            }}
          >
            {connectivity?.isOnline === false ? "OFFLINE REZIM" : "GALAXY BOOTSTRAP"}
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.8rem)", lineHeight: 0.94 }}>Zazehni prvni galaxii</h1>
          <p style={{ margin: 0, maxWidth: "38rem", color: "rgba(225, 240, 252, 0.76)", lineHeight: 1.5 }}>
            Workspace zatim nema zadnou aktivni galaxii. Pro dalsi vstup vytvor minimalni runtime prostor a FE se do nej
            prepne jako do canonical `defaultGalaxy`.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.9rem",
          }}
        >
          <div
            style={{
              padding: "0.95rem 1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(111, 207, 255, 0.16)",
              background: "rgba(5, 11, 23, 0.6)",
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.84rem" }}>Minimalni scope</strong>
            <span style={{ fontSize: "0.8rem", color: "rgba(212, 231, 247, 0.76)" }}>
              Jen nazev galaxie. Zadny selector, zadne branches.
            </span>
          </div>
          <div
            style={{
              padding: "0.95rem 1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(111, 207, 255, 0.16)",
              background: "rgba(5, 11, 23, 0.6)",
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.84rem" }}>Po vytvoreni</strong>
            <span style={{ fontSize: "0.8rem", color: "rgba(212, 231, 247, 0.76)" }}>
              FE znovu nacte `/galaxies` a vstoupi do noveho workspace.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "rgba(181, 221, 248, 0.78)" }}>
              NAZEV GALAXIE
            </span>
            <input
              data-testid="create-galaxy-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Moje galaxie"
              disabled={busy}
              style={{
                borderRadius: "0.9rem",
                border: "1px solid rgba(116, 211, 255, 0.28)",
                background: "rgba(2, 8, 19, 0.92)",
                color: "#f4fbff",
                padding: "0.95rem 1rem",
                fontSize: "1rem",
              }}
            />
          </label>

          {error ? (
            <div
              data-testid="create-galaxy-error"
              style={{
                borderRadius: "0.9rem",
                border: "1px solid rgba(255, 152, 122, 0.28)",
                background: "rgba(63, 17, 14, 0.48)",
                color: "#ffd7cb",
                padding: "0.85rem 1rem",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            data-testid="create-galaxy-submit"
            type="submit"
            disabled={busy || !String(name || "").trim()}
            style={{
              justifySelf: "start",
              borderRadius: "999px",
              border: "1px solid rgba(255, 214, 129, 0.36)",
              background: busy
                ? "rgba(75, 92, 110, 0.7)"
                : "linear-gradient(120deg, rgba(255, 197, 93, 0.95), rgba(255, 234, 168, 0.9))",
              color: busy ? "rgba(235, 244, 249, 0.78)" : "#1a1408",
              padding: "0.85rem 1.2rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Vytvarim galaxii..." : "Vytvorit galaxii"}
          </button>
        </form>
      </section>
    </main>
  );
}
