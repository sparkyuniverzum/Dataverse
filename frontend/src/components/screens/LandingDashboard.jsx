import { useState } from "react";
import { LANDING_GUIDE, MODEL_PATH_LABEL } from "../../lib/onboarding";

export default function LandingDashboard({ onLogin, onRegister, busy, error }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTags, setActiveTags] = useState(["Event-Sourcing"]);

  const toggleTag = (tag) => {
    setActiveTags((prev) => (
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    ));
  };

  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: `
          radial-gradient(circle at 18% 22%, rgba(57, 115, 173, 0.46) 0%, rgba(12, 28, 52, 0.28) 28%, rgba(2, 5, 12, 0) 55%),
          radial-gradient(circle at 82% 16%, rgba(67, 166, 201, 0.28) 0%, rgba(3, 13, 24, 0) 36%),
          linear-gradient(180deg, #070f1f 0%, #040a16 44%, #02050c 100%)
        `,
        color: "#e8fbff",
        display: "grid",
        placeItems: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "min(1080px, 96vw)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <article
          style={{
            border: "1px solid rgba(104, 205, 239, 0.34)",
            borderRadius: 18,
            background: "linear-gradient(160deg, rgba(6, 14, 27, 0.92), rgba(7, 18, 35, 0.86))",
            padding: 20,
            backdropFilter: "blur(9px)",
            boxShadow: "inset 0 0 0 1px rgba(122, 215, 247, 0.16), 0 22px 56px rgba(0, 0, 0, 0.42)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 0% 0%, rgba(84, 182, 226, 0.2), rgba(0,0,0,0) 34%), radial-gradient(circle at 100% 100%, rgba(62, 109, 176, 0.18), rgba(0,0,0,0) 42%)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.74 }}>PLAVIDLO / COMMAND BRIDGE</div>
            <div style={{ display: "flex", gap: 6 }}>
              <SignalLight color="#50ffc4" />
              <SignalLight color="#ffd76f" />
              <SignalLight color="#ff96ab" />
            </div>
          </div>

          <h1 style={{ margin: "8px 0 0", fontSize: "var(--dv-fs-display-md)", lineHeight: "var(--dv-lh-display)" }}>DataVerse Navigator</h1>
          <div style={{ marginTop: 5, fontSize: "var(--dv-fs-md)", opacity: 0.76 }}>Kokpit průzkumníka AURORA-01</div>

          <p style={{ marginTop: 12, maxWidth: 620, fontSize: "var(--dv-fs-xl)", opacity: 0.86 }}>
            Priprav se na vstup do datoveho vesmiru. Po odemceni kokpitu jedes podle jednotne mapy:
            {" "}
            {MODEL_PATH_LABEL}.
          </p>

          <div
            style={{
              marginTop: 16,
              border: "1px solid rgba(101, 194, 224, 0.26)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(4, 12, 24, 0.72)",
              display: "grid",
              gap: 9,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-sm)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.72 }}>PŘEDLETOVÝ CHECKLIST</div>
            {LANDING_GUIDE.map((item) => (
              <ChecklistItem key={item} text={item} />
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag text="Event-Sourcing" active={activeTags.includes("Event-Sourcing")} onToggle={toggleTag} />
            <Tag text="Soft Delete Only" active={activeTags.includes("Soft Delete Only")} onToggle={toggleTag} />
            <Tag text="3D Workspace First" active={activeTags.includes("3D Workspace First")} onToggle={toggleTag} />
          </div>
        </article>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const handler = mode === "login" ? onLogin : onRegister;
            handler(email.trim(), password);
          }}
          style={{
            border: "1px solid rgba(102, 201, 237, 0.34)",
            borderRadius: 18,
            background: "linear-gradient(170deg, rgba(5, 14, 27, 0.92), rgba(3, 9, 18, 0.9))",
            padding: 18,
            backdropFilter: "blur(9px)",
            display: "grid",
            gap: 10,
            boxShadow: "inset 0 0 0 1px rgba(115, 209, 242, 0.15), 0 20px 46px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-code)", opacity: 0.74, fontFamily: "var(--dv-font-mono)" }}>
            AIRLOCK AUTH MODULE
          </div>
          <div style={{ fontSize: "var(--dv-fs-xl)", fontWeight: 700, marginTop: -2 }}>Ověření posádky</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode("login")}
              style={{
                flex: 1,
                borderRadius: 9,
                border: "1px solid rgba(111, 207, 239, 0.36)",
                background: mode === "login" ? "rgba(45, 114, 154, 0.86)" : "rgba(9, 18, 31, 0.8)",
                color: "#dff8ff",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              style={{
                flex: 1,
                borderRadius: 9,
                border: "1px solid rgba(111, 207, 239, 0.36)",
                background: mode === "register" ? "rgba(45, 114, 154, 0.86)" : "rgba(9, 18, 31, 0.8)",
                color: "#dff8ff",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Register
            </button>
          </div>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="Email"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            placeholder="Password"
            style={inputStyle}
          />

          {error ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#ffadc3" }}>{error}</div> : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(95, 201, 236, 0.52)",
              background: busy ? "rgba(43, 62, 77, 0.84)" : "linear-gradient(120deg, #20b4e3, #52deff)",
              color: busy ? "#b8ccd7" : "#022130",
              fontWeight: 700,
              padding: "10px 12px",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Navazuji spojení..." : mode === "login" ? "Vstoupit do kokpitu" : "Registrovat člena posádky"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SignalLight({ color }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 12px ${color}`,
        display: "inline-block",
      }}
    />
  );
}

function ChecklistItem({ text }) {
  const [active, setActive] = useState(false);
  return (
    <div
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--dv-fs-md)",
        padding: "4px 2px",
        borderRadius: 8,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          border: `1px solid ${active ? "rgba(130, 232, 255, 0.86)" : "rgba(92, 178, 207, 0.4)"}`,
          background: active ? "rgba(74, 203, 241, 0.28)" : "rgba(11, 28, 43, 0.9)",
          boxShadow: active ? "0 0 16px rgba(114, 225, 255, 0.52)" : "none",
          display: "inline-block",
        }}
      />
      <span style={{ opacity: active ? 1 : 0.9 }}>{text}</span>
      <span
        style={{
          fontSize: "var(--dv-fs-2xs)",
          letterSpacing: "var(--dv-tr-xwide)",
          color: active ? "#a8eeff" : "rgba(178, 225, 242, 0.6)",
          fontFamily: "var(--dv-font-mono)",
        }}
      >
        {active ? "SCAN ON" : "READY"}
      </span>
    </div>
  );
}

function Tag({ text, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(text)}
      style={{
        cursor: "pointer",
        border: "1px solid rgba(112, 206, 236, 0.32)",
        background: active ? "rgba(12, 40, 66, 0.9)" : "rgba(5, 16, 29, 0.84)",
        color: "#d6f7ff",
        borderRadius: 999,
        padding: "5px 10px",
        fontSize: "var(--dv-fs-xs)",
        boxShadow: active ? "0 0 20px rgba(69, 191, 231, 0.42), inset 0 0 0 1px rgba(132, 226, 255, 0.28)" : "none",
      }}
    >
      {text}
    </button>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(118, 210, 242, 0.28)",
  background: "rgba(4, 9, 17, 0.92)",
  color: "#dff9ff",
  padding: "9px 10px",
  fontSize: "var(--dv-fs-lg)",
  outline: "none",
  boxSizing: "border-box",
};
