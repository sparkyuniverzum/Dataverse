import PlanetBuilderWizardHarnessPanel from "../universe/PlanetBuilderWizardHarnessPanel";

export default function PlanetBuilderSmokeScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 20%, rgba(37, 112, 173, 0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(95, 184, 227, 0.12), transparent 36%), #02060d",
        color: "#dff8ff",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <section style={{ width: "min(920px, calc(100vw - 24px))", display: "grid", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 28px)" }}>Planet Builder Browser Smoke</h1>
        <p style={{ margin: 0, opacity: 0.82 }}>
          Route only for automated browser smoke. Simulates first planet wizard mission end-to-end.
        </p>
        <PlanetBuilderWizardHarnessPanel initiallyLocked={false} schemaStepsTotal={3} />
      </section>
    </main>
  );
}
