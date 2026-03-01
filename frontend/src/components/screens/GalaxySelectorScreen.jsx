export default function GalaxySelectorScreen({
  user,
  galaxies,
  selectedGalaxyId,
  newGalaxyName,
  loading,
  busy,
  error,
  onSelect,
  onCreate,
  onNameChange,
  onExtinguish,
  onRefresh,
  onLogout,
}) {
  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "radial-gradient(circle at 20% 20%, #132b47 0%, #081022 45%, #02050c 100%)",
        color: "#e6faff",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>LEVEL 1 / GALAXY WORKSPACES</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 30 }}>Vyber galaxii</h2>
            <div style={{ marginTop: 4, fontSize: 14, opacity: 0.82 }}>Uživatel: {user?.email || "n/a"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onRefresh} disabled={loading} style={ghostButtonStyle}>
              Obnovit
            </button>
            <button type="button" onClick={onLogout} style={dangerButtonStyle}>
              Logout
            </button>
          </div>
        </header>

        <section
          style={{
            marginTop: 18,
            border: "1px solid rgba(95, 189, 220, 0.25)",
            borderRadius: 14,
            background: "rgba(5, 12, 22, 0.78)",
            padding: 14,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newGalaxyName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Nova galaxie"
              style={{
                flex: "1 1 280px",
                borderRadius: 9,
                border: "1px solid rgba(115, 207, 238, 0.28)",
                background: "rgba(3, 9, 18, 0.9)",
                color: "#dff9ff",
                padding: "9px 10px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button type="button" onClick={onCreate} disabled={busy || !newGalaxyName.trim()} style={actionButtonStyle}>
              Vytvorit galaxii
            </button>
          </div>
          {error ? <div style={{ marginTop: 8, color: "#ffb4c7", fontSize: 12 }}>{error}</div> : null}
        </section>

        <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {galaxies.map((galaxy) => {
            const selected = galaxy.id === selectedGalaxyId;
            return (
              <article
                key={galaxy.id}
                style={{
                  border: selected ? "1px solid rgba(111, 227, 255, 0.65)" : "1px solid rgba(99, 167, 194, 0.3)",
                  borderRadius: 12,
                  background: selected ? "rgba(20, 67, 93, 0.72)" : "rgba(5, 13, 24, 0.78)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16 }}>{galaxy.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.76 }}>ID: {galaxy.id}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                  <button type="button" onClick={() => onSelect(galaxy.id)} style={actionButtonStyle}>
                    {selected ? "Aktivni" : "Vstoupit"}
                  </button>
                  <button type="button" onClick={() => onExtinguish(galaxy.id)} style={dangerButtonStyle}>
                    Zhasnout
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

const actionButtonStyle = {
  border: "1px solid rgba(111, 227, 255, 0.52)",
  background: "linear-gradient(120deg, #28bbe9, #4bdcff)",
  color: "#052032",
  borderRadius: 9,
  fontWeight: 700,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const dangerButtonStyle = {
  border: "1px solid rgba(255, 136, 166, 0.45)",
  background: "rgba(43, 13, 21, 0.76)",
  color: "#ffc7d8",
  borderRadius: 9,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const ghostButtonStyle = {
  border: "1px solid rgba(111, 227, 255, 0.3)",
  background: "rgba(7, 18, 34, 0.84)",
  color: "#d7f6ff",
  borderRadius: 9,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};
