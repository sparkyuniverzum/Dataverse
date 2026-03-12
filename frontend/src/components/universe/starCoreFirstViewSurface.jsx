function badgeStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.38rem 0.7rem",
    borderRadius: "999px",
    border: "1px solid rgba(120, 190, 255, 0.18)",
    background: "rgba(4, 15, 31, 0.56)",
    color: "#d9f7ff",
    fontSize: "0.76rem",
    letterSpacing: "0.02em",
  };
}

export default function StarCoreFirstViewSurface({ model, halo, loading = false }) {
  const disabledAction = true;
  const primaryActionStyle = {
    border: "none",
    borderRadius: "999px",
    padding: "0.88rem 1.25rem",
    fontWeight: 700,
    fontSize: "0.96rem",
    color: "#031522",
    background: `linear-gradient(135deg, ${model.tone.accent} 0%, ${model.tone.accentSoft || model.tone.accent} 100%)`,
    boxShadow: `0 14px 34px ${model.tone.glow}`,
    opacity: disabledAction ? 0.7 : 1,
    cursor: disabledAction ? "default" : "pointer",
  };

  return (
    <section
      aria-label="Star Core first view"
      data-testid="star-core-first-view"
      style={{
        position: "relative",
        zIndex: 1,
        width: "min(40rem, calc(100vw - 3rem))",
        display: "grid",
        gap: "1.2rem",
        padding: "1.4rem",
        borderRadius: "1.5rem",
        border: "1px solid rgba(255, 190, 121, 0.22)",
        background:
          "linear-gradient(180deg, rgba(10, 7, 4, 0.88) 0%, rgba(6, 8, 16, 0.9) 100%), radial-gradient(circle at 50% 0%, rgba(255, 192, 101, 0.12), transparent 48%)",
        boxShadow: "0 34px 120px rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        aria-hidden="true"
        data-testid="star-core-orb"
        style={{
          position: "absolute",
          inset: "auto auto 2.8rem 50%",
          transform: "translateX(-50%)",
          width: "13rem",
          height: "13rem",
          borderRadius: "999px",
          background: `radial-gradient(circle at 50% 45%, rgba(255, 247, 221, 0.98) 0%, ${model.tone.accent} 17%, rgba(18, 15, 9, 0.98) 58%, rgba(5, 7, 16, 0) 78%)`,
          boxShadow: `0 0 120px ${model.tone.glow}`,
          opacity: loading ? 0.72 : 1,
          filter: `saturate(${model.state === "star_core_locked_ready" ? 1.15 : 0.96})`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "auto auto 4.2rem 50%",
          transform: "translateX(-50%) rotate(-12deg)",
          width: "16.5rem",
          height: "4rem",
          borderRadius: "999px",
          border: `2px solid rgba(255, 208, 146, ${halo.orbitOpacity})`,
          boxShadow: `0 0 42px rgba(255, 191, 107, ${halo.intensity})`,
          opacity: model.state === "star_core_locked_ready" ? 1 : 0.78,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          {model.badges.map((badge) => (
            <span key={badge.label} style={badgeStyle()}>
              {badge.label}
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gap: "0.45rem", maxWidth: "28rem" }}>
          <div
            style={{
              fontSize: "0.74rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(224, 241, 255, 0.55)",
            }}
          >
            Star Core ignition tableau
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 3vw, 2.9rem)",
              lineHeight: 1.02,
              color: "#f6fbff",
            }}
          >
            {model.title}
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "32rem",
              color: "rgba(226, 239, 255, 0.82)",
              fontSize: "1rem",
              lineHeight: 1.55,
            }}
          >
            {model.description}
          </p>
        </div>

        <dl
          style={{
            display: "grid",
            gap: "0.72rem",
            margin: 0,
            padding: "1rem 1rem 5.8rem",
            borderRadius: "1.15rem",
            background: "rgba(5, 14, 28, 0.58)",
            border: "1px solid rgba(116, 179, 255, 0.14)",
          }}
        >
          {model.rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(9rem, 11rem) 1fr",
                gap: "0.85rem",
                color: "#dcefff",
              }}
            >
              <dt style={{ opacity: 0.62 }}>{row.label}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", alignItems: "center" }}>
          <button
            type="button"
            disabled={disabledAction}
            aria-disabled={disabledAction}
            title="Interakční workflow naváže v dalším FE bloku."
            style={primaryActionStyle}
          >
            {model.primaryActionLabel}
          </button>
          <span style={{ color: "rgba(224, 241, 255, 0.68)", fontSize: "0.92rem" }}>{model.secondaryActionLabel}</span>
        </div>
      </div>
    </section>
  );
}
