function hudChipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.42rem 0.78rem",
    borderRadius: "999px",
    border: "1px solid rgba(110, 204, 255, 0.22)",
    background: "rgba(4, 11, 26, 0.58)",
    color: "#d9f7ff",
    fontSize: "0.77rem",
    letterSpacing: "0.02em",
    backdropFilter: "blur(14px)",
  };
}

function resolveViewMode(isStarFocused, isCoreEntered) {
  if (isCoreEntered) return "core_entry";
  if (isStarFocused) return "star_focus";
  return "outer_orbit";
}

function resolvePromptContent(model, viewMode) {
  if (model.state === "data_unavailable" || model.state === "loading") {
    return {
      title: model.commandPrompt,
      hint: model.commandHint,
    };
  }

  if (model.state === "star_core_locked_ready") {
    if (viewMode === "core_entry") {
      return {
        title: "Jsi uvnitř stabilizovaného Srdce hvězdy",
        hint: "První orbita už vznikla. Esc tě vrátí zpátky do hlavního prostoru galaxie.",
      };
    }
    return {
      title: "Hvězda je uzamčena a pracovní prostor je připraven",
      hint: "První orbita vznikla přímo z jádra. Další FE vrstva naváže založením planety.",
    };
  }

  if (viewMode === "core_entry") {
    return {
      title: "Jsi v prahu Srdce hvězdy",
      hint: "Tady naváže volba ústavy prostoru. Esc tě vrátí zpátky do hlavní orbity.",
    };
  }

  if (viewMode === "star_focus") {
    return {
      title: "Dvojklik otevře vstup do jádra",
      hint: "Pohybem myši si hvězdu obhlédneš. Dvojklik tě pak dovede dovnitř k ústavě a uzamčení politik.",
    };
  }

  return {
    title: "Dvojklikem vstoupíš do Srdce hvězdy",
    hint: "Pohybem myši obhlédneš hlavní prostor galaxie. Další rozhodnutí začíná až uvnitř jádra.",
  };
}

export default function StarCoreHudOverlay({ model, isStarFocused = false, isCoreEntered = false }) {
  const viewMode = resolveViewMode(isStarFocused, isCoreEntered);
  const prompt = resolvePromptContent(model, viewMode);

  return (
    <>
      <section
        data-testid="star-core-hud"
        aria-label="HUD Srdce hvězdy"
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 3,
          display: "grid",
          gap: "0.7rem",
          maxWidth: "22rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          <span style={hudChipStyle()}>{`Galaxie: ${model.galaxyName}`}</span>
          <span style={hudChipStyle()}>{model.globalStage}</span>
          <span style={hudChipStyle()}>{model.syncLabel}</span>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.28rem",
            padding: "0.92rem 1rem",
            borderRadius: "1rem",
            border: "1px solid rgba(112, 205, 255, 0.16)",
            background: "linear-gradient(180deg, rgba(4, 10, 23, 0.74) 0%, rgba(3, 7, 17, 0.46) 100%)",
            color: "#eef7ff",
            backdropFilter: "blur(18px)",
          }}
        >
          <strong style={{ fontSize: "0.94rem" }}>{model.hudTitle}</strong>
          <span style={{ color: "rgba(223, 239, 255, 0.76)", fontSize: "0.88rem", lineHeight: 1.45 }}>
            {model.hudSubtitle}
          </span>
          {model.state === "star_core_unlocked" ? (
            <span style={{ color: "rgba(169, 231, 255, 0.78)", fontSize: "0.8rem", lineHeight: 1.35 }}>
              {viewMode === "core_entry"
                ? "Uvnitř jádra se připravuje chytrá volba ústavy prostoru."
                : "Z hlavního prostoru zatím jen vstupuješ ke hvězdě a ověřuješ její stav."}
            </span>
          ) : null}
        </div>
      </section>

      <section
        data-testid="star-core-command"
        aria-label="Příkazový prompt Srdce hvězdy"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "1.4rem",
          transform: "translateX(-50%)",
          zIndex: 3,
          width: "min(42rem, calc(100vw - 2rem))",
          display: "grid",
          gap: "0.35rem",
          padding: "0.95rem 1.1rem",
          borderRadius: "1.15rem",
          border: "1px solid rgba(126, 217, 255, 0.18)",
          background:
            "linear-gradient(180deg, rgba(3, 9, 20, 0.82) 0%, rgba(3, 7, 16, 0.68) 100%), radial-gradient(circle at 50% 50%, rgba(111, 219, 255, 0.08), transparent 56%)",
          color: "#f2f8ff",
          textAlign: "left",
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ fontSize: "0.75rem", letterSpacing: "0.12em", opacity: 0.62, textTransform: "uppercase" }}>
          Taktický HUD
        </div>
        <strong style={{ fontSize: "1rem", fontWeight: 700 }}>{prompt.title}</strong>
        <span style={{ color: "rgba(220, 237, 255, 0.72)", fontSize: "0.89rem", lineHeight: 1.4 }}>{prompt.hint}</span>
        {model.errorHint ? <span style={{ color: "#ffc9b8", fontSize: "0.84rem" }}>{model.errorHint}</span> : null}
      </section>
    </>
  );
}
