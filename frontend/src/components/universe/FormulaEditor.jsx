import { useState } from "react";

const availableFunctions = [
  { name: "SUM({sloupec})", description: "Součet hodnot v cílovém sloupci." },
  { name: "AVG({sloupec})", description: "Průměr hodnot v cílovém sloupci." },
  { name: "COUNT()", description: "Celkový počet propojených záznamů." },
  { name: "MIN({sloupec})", description: "Minimální hodnota v cílovém sloupci." },
  { name: "MAX({sloupec})", description: "Maximální hodnota v cílovém sloupci." },
  { name: "POW({základ}, {exponent})", description: "Umocní základ na daný exponent." },
];

export default function FormulaEditor({
  initialFormula = "",
  columns = [],
  onSave,
  onCancel,
  busy,
  error,
}) {
  const [formula, setFormula] = useState(initialFormula);

  const handleSave = () => {
    if (typeof onSave === "function") {
      onSave(formula);
    }
  };

  const handleCancel = () => {
    if (typeof onCancel === "function") {
      onCancel();
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Editor výpočtových vzorců</div>
        <div style={subtitleStyle}>Definujte logiku pro FLOW vazby vaší datové galaxie.</div>
      </div>

      <div style={mainContentStyle}>
        <div style={editorPanelStyle}>
          <label style={labelStyle}>
            Definice vzorce
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Např. SUM({příjmy}) - SUM({výdaje})"
              style={textareaStyle}
              rows={8}
            />
          </label>
          {error && <div style={errorStyle}>{error}</div>}
        </div>

        <div style={helpPanelStyle}>
          <div style={helpSectionStyle}>
            <h3 style={helpTitleStyle}>Dostupné sloupce</h3>
            <p style={helpTextStyle}>
              Názvy sloupců vkládejte do složených závorek, např. <strong>{`{název_sloupce}`}</strong>.
            </p>
            <ul style={listStyle}>
              {(columns || []).length > 0 ? (
                columns.map((col) => (
                  <li key={col}>
                    <code>{col}</code>
                  </li>
                ))
              ) : (
                <li style={{ opacity: 0.7, fontStyle: "italic" }}>Žádné dostupné sloupce.</li>
              )}
            </ul>
          </div>
          <div style={{ ...helpSectionStyle, marginTop: 16 }}>
            <h3 style={helpTitleStyle}>Dostupné funkce</h3>
            <ul style={listStyle}>
              {availableFunctions.map(({ name, description }) => (
                <li key={name}>
                  <strong>{name}</strong>: {description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div style={footerStyle}>
        <button type="button" onClick={handleCancel} style={cancelButtonStyle}>
          Zrušit
        </button>
        <button type="button" onClick={handleSave} disabled={busy} style={saveButtonStyle(busy)}>
          {busy ? "Ukládám..." : "Uložit a aktivovat vzorec"}
        </button>
      </div>
    </div>
  );
}

const containerStyle = {
  width: "min(840px, 94vw)",
  minHeight: "min(600px, 92vh)",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(99, 202, 241, 0.26)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
  background: "rgba(3, 8, 16, 0.8)",
  backdropFilter: "blur(12px)",
  color: "#e8f8ff",
  fontFamily: "inherit",
};

const headerStyle = {
  padding: "20px 24px",
  borderBottom: "1px solid rgba(94, 183, 222, 0.22)",
  background: "linear-gradient(180deg, rgba(7,17,32,0.8), rgba(4,10,20,0.6))",
};

const titleStyle = {
  fontSize: "clamp(20px, 2vw, 26px)",
  fontWeight: 800,
  lineHeight: 1.1,
};

const subtitleStyle = {
  marginTop: 6,
  fontSize: "var(--dv-fs-md)",
  opacity: 0.84,
  lineHeight: "var(--dv-lh-relaxed)",
};

const mainContentStyle = {
  display: "grid",
  gridTemplateColumns: "2fr 1.2fr",
  gap: 22,
  padding: "20px 24px",
  overflowY: "auto",
};

const editorPanelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const helpPanelStyle = {
  background: "rgba(8,18,32,0.64)",
  borderRadius: 12,
  border: "1px solid rgba(126, 221, 255, 0.18)",
  padding: "14px 18px",
  overflowY: "auto",
};

const labelStyle = {
  display: "grid",
  gap: 8,
  fontSize: "var(--dv-fs-xs)",
  opacity: 0.9,
  letterSpacing: "var(--dv-tr-wide)",
};

const textareaStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(118, 213, 248, 0.32)",
  background: "linear-gradient(140deg, rgba(8,20,36,0.92), rgba(5,12,22,0.9))",
  color: "#e2f8ff",
  padding: "12px 14px",
  fontSize: "var(--dv-fs-md)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  resize: "vertical",
};

const errorStyle = {
  fontSize: "var(--dv-fs-sm)",
  color: "#ffabc3",
  background: "rgba(255, 100, 140, 0.1)",
  border: "1px solid rgba(255, 100, 140, 0.3)",
  borderRadius: 8,
  padding: "8px 12px",
};

const helpSectionStyle = {};

const helpTitleStyle = {
  margin: 0,
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-wide)",
  color: "#98dbff",
};

const helpTextStyle = {
  margin: "6px 0 10px",
  fontSize: "var(--dv-fs-xs)",
  lineHeight: "var(--dv-lh-relaxed)",
  opacity: 0.88,
};

const listStyle = {
  margin: 0,
  paddingLeft: 18,
  display: "grid",
  gap: 8,
  fontSize: "var(--dv-fs-sm)",
  lineHeight: "var(--dv-lh-relaxed)",
};

const footerStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "16px 24px",
  borderTop: "1px solid rgba(94, 183, 222, 0.22)",
  background: "rgba(4, 9, 18, 0.88)",
};

const cancelButtonStyle = {
  background: "none",
  border: "1px solid rgba(118, 216, 250, 0.42)",
  borderRadius: 10,
  color: "#e4f8ff",
  padding: "8px 16px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--dv-fs-sm)",
};

function saveButtonStyle(busy) {
  return {
    borderRadius: 10,
    border: "1px solid rgba(114, 220, 255, 0.52)",
    background: busy ? "rgba(40,58,74,0.82)" : "linear-gradient(120deg, #24b8e5, #67e5ff)",
    color: busy ? "#b8cddb" : "#032434",
    padding: "8px 16px",
    fontWeight: 800,
    cursor: busy ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: "var(--dv-fs-sm)",
  };
}
