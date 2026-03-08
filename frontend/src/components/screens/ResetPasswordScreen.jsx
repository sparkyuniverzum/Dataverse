import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function ResetPasswordScreen({ onNavigateToLogin }) {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError("V adrese chybí token pro obnovu hesla. Zkontrolujte prosím odkaz z e-mailu.");
      return;
    }
    if (password.length < 8) {
      setError("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Zadaná hesla se neshodují.");
      return;
    }

    setBusy(true);
    try {
      const result = await resetPassword(token, password);
      if (result?.message) {
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={containerStyle}>
      <section style={panelStyle}>
        <form onSubmit={handleFormSubmit} style={formStyle}>
          {successMessage ? (
            <>
              <div style={headerStyle}>
                <div style={titleStyle}>Heslo změněno</div>
                <div style={subtitleStyle}>{successMessage}</div>
              </div>
              <button type="button" onClick={onNavigateToLogin} style={{ ...ctaStyle(false), marginTop: 12 }}>
                Přejít na přihlášení
              </button>
            </>
          ) : (
            <>
              <div style={headerStyle}>
                <div style={titleStyle}>Nastavte si nové heslo</div>
                <div style={subtitleStyle}>
                  Zadejte nové heslo pro váš účet. Po uložení budete moci vstoupit do své galaxie.
                </div>
              </div>

              <label style={labelStyle}>
                <span style={spanStyle}>NOVÉ HESLO</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="********"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={spanStyle}>POTVRDIT NOVÉ HESLO</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="********"
                  style={inputStyle}
                />
              </label>

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={busy || !token} style={ctaStyle(busy || !token)}>
                {busy ? "Měním heslo..." : "Nastavit nové heslo"}
              </button>

              {!token && (
                <div style={{ ...errorStyle, marginTop: 12 }}>
                  Token pro obnovu nebyl nalezen. Prosím, použijte odkaz z e-mailu znovu.
                </div>
              )}
            </>
          )}
        </form>
      </section>
    </main>
  );
}

// Styles are inspired by LandingDashboard for consistency
const containerStyle = {
  width: "100vw",
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 14% 18%, rgba(44,123,177,0.28), transparent 38%), radial-gradient(circle at 78% 8%, rgba(74,188,224,0.18), transparent 42%), linear-gradient(180deg, #040913 0%, #02050c 100%)",
  color: "#e8f8ff",
  display: "grid",
  placeItems: "center",
  padding: 18,
  boxSizing: "border-box",
};

const panelStyle = {
  width: "min(520px, 94vw)",
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(99, 202, 241, 0.26)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
  background: "rgba(3, 8, 16, 0.76)",
  backdropFilter: "blur(10px)",
};

const formStyle = {
  display: "grid",
  gap: 16,
  padding: "28px min(5vw, 38px)",
  background: "linear-gradient(170deg, rgba(6,14,27,0.86), rgba(4,9,18,0.88))",
};

const headerStyle = {
  display: "grid",
  gap: 6,
};

const titleStyle = {
  fontSize: "clamp(22px, 2.2vw, 32px)",
  fontWeight: 800,
  lineHeight: 1.1,
};

const subtitleStyle = {
  fontSize: "var(--dv-fs-md)",
  opacity: 0.84,
  lineHeight: "var(--dv-lh-relaxed)",
};

const labelStyle = { display: "grid", gap: 6 };

const spanStyle = {
  fontSize: "var(--dv-fs-xs)",
  opacity: 0.8,
  letterSpacing: "var(--dv-tr-wide)",
};

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(118, 213, 248, 0.32)",
  background: "linear-gradient(140deg, rgba(8,20,36,0.88), rgba(5,12,22,0.86))",
  color: "#e2f8ff",
  padding: "10px 12px",
  fontSize: "var(--dv-fs-sm)",
  outline: "none",
  boxSizing: "border-box",
};

const errorStyle = {
  fontSize: "var(--dv-fs-sm)",
  color: "#ffabc3",
  background: "rgba(255, 100, 140, 0.1)",
  border: "1px solid rgba(255, 100, 140, 0.3)",
  borderRadius: 8,
  padding: "8px 12px",
  textAlign: "center",
};

function ctaStyle(busy) {
  return {
    marginTop: 8,
    borderRadius: 12,
    border: "1px solid rgba(114, 220, 255, 0.52)",
    background: busy ? "rgba(40,58,74,0.82)" : "linear-gradient(120deg, #24b8e5, #67e5ff)",
    color: busy ? "#b8cddb" : "#032434",
    padding: "12px 14px",
    fontWeight: 800,
    cursor: busy ? "not-allowed" : "pointer",
  };
}
