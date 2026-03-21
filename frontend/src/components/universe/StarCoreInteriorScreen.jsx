export default function StarCoreInteriorScreen({ screenModel = null }) {
  if (!screenModel?.isVisible) return null;

  return (
    <section
      data-testid="star-core-interior-screen"
      aria-label="Srdce hvezdy"
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "#020408",
      }}
    >
      <div data-testid="ritual-chamber-core" style={{ position: "absolute", inset: 0 }} />
    </section>
  );
}
