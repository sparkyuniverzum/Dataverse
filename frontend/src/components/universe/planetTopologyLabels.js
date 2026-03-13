function phaseLabel(value) {
  const phase = String(value || "")
    .trim()
    .toUpperCase();
  if (phase === "ACTIVE") return "aktivni";
  if (phase === "OVERLOADED") return "pretizena";
  if (phase === "DORMANT") return "uspana";
  if (phase === "CORRODING") return "koroduje";
  if (phase === "CRITICAL") return "kriticka";
  if (phase === "CALM") return "klidna";
  return "neznama";
}

export function resolvePlanetTopologyLabels(item, state) {
  if (item?.type === "planet-slot") {
    const base = {
      title: String(item?.label || "Orbit slot"),
      subtitle: String(item?.subtitle || ""),
      detail:
        item?.slotState === "ready" ? "Slot pripraveny pro prvni planetu" : "Nejdřív uzamkni politiky Srdce hvezdy",
    };
    if (state?.approached) {
      return {
        ...base,
        detail:
          item?.slotState === "ready"
            ? "Priblizeni k pripravenemu slotu / ceká na budoucí create flow"
            : "Priblizeni k latentnimu slotu / zatim bez planety",
      };
    }
    if (state?.selected) {
      return {
        ...base,
        detail:
          item?.slotState === "ready"
            ? "Vybrany slot / pripraven pro dalsi osidleni"
            : "Vybrany slot / governance zatim nepovoluje vznik planety",
      };
    }
    return base;
  }

  const base = {
    title: String(item?.label || "Planeta"),
    subtitle: String(item?.subtitle || ""),
    detail: `Stav: ${phaseLabel(item?.statusLabel)} / kvalita ${Math.max(0, Number(item?.qualityScore) || 0)}%`,
  };

  if (state?.approached) {
    return {
      ...base,
      detail: `Priblizeni aktivni / ${phaseLabel(item?.statusLabel)} / ${Math.max(0, Number(item?.rows) || 0)} radku`,
    };
  }

  if (state?.selected) {
    return {
      ...base,
      detail: `Vybrana planeta / ${phaseLabel(item?.statusLabel)} / schema ${Math.max(0, Number(item?.complexity) || 0)}`,
    };
  }

  return base;
}
