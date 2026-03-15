/**
 * Adaptér pro R3F Lab: Star Core Interior
 * Mapuje BE InteriorReadModel na vizuální parametry pro Lab scénu.
 */
export function mapInteriorToLabProps(interiorModel) {
  if (!interiorModel) return null;

  const { interior_phase, selected_constitution_id } = interiorModel;

  // Základní barevná schémata podle ústavy
  const constitutionVisuals = {
    rust: { accent: "#ff4e4e", atmosphere: "#5c1a1a", pulseRate: 1.8 },
    rovnovaha: { accent: "#76d5ff", atmosphere: "#2f7cff", pulseRate: 0.8 },
    straz: { accent: "#c9ff76", atmosphere: "#1a5c2b", pulseRate: 0.4 },
    archiv: { accent: "#d1d1d1", atmosphere: "#2a2a2a", pulseRate: 0.2 },
  };

  const currentVisual = constitutionVisuals[selected_constitution_id] || constitutionVisuals.rovnovaha;

  // Modifikace podle fáze
  let intensity = 1.0;
  let scale = 1.0;
  let statusLabel = "NOMINAL";

  switch (interior_phase) {
    case "star_core_interior_entry":
      intensity = 2.5; // Dočasný záblesk při vstupu
      scale = 1.15;
      statusLabel = "BOOTING";
      break;
    case "constitution_select":
      intensity = 0.9;
      statusLabel = "SELECTING";
      break;
    case "policy_lock_ready":
      intensity = 1.2;
      statusLabel = "READY";
      break;
    case "policy_lock_transition":
      intensity = 3.0; // Silné pulzování během locku
      statusLabel = "LOCKING";
      break;
    case "first_orbit_ready":
      intensity = 0.7; // Zklidnění po locku
      scale = 0.95;
      statusLabel = "STABLE";
      break;
    default:
      break;
  }

  return {
    ...currentVisual,
    intensity,
    scale,
    statusLabel,
    phase: interior_phase,
    constitution: selected_constitution_id,
  };
}
