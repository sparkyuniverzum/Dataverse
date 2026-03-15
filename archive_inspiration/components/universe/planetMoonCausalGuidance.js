function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toUpperText(value) {
  return toText(value).toUpperCase();
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return {
      completed: 0,
      total: 0,
      nextStepKey: "",
    };
  }
  return {
    completed: Number.isFinite(Number(summary.completed)) ? Math.max(0, Math.floor(Number(summary.completed))) : 0,
    total: Number.isFinite(Number(summary.total)) ? Math.max(0, Math.floor(Number(summary.total))) : 0,
    nextStepKey: toText(summary.nextStepKey),
  };
}

function resolveStepLabel(stepKey, stepDefinitions) {
  const normalizedKey = toText(stepKey);
  if (!normalizedKey) return "";
  const items = Array.isArray(stepDefinitions) ? stepDefinitions : [];
  const found = items.find((item) => toText(item?.key) === normalizedKey);
  return toText(found?.blockLabel);
}

function normalizeNarrative(narrative) {
  const source = narrative && typeof narrative === "object" ? narrative : {};
  return {
    title: toText(source.title, "Planeta"),
    why: toText(source.why),
    action: toText(source.action),
    severity: "info",
    source: "builder",
  };
}

function resolvePlanetPhase(selectedPlanetNode) {
  const phaseRaw =
    selectedPlanetNode?.runtimePlanetPhysics?.phase ?? selectedPlanetNode?.v1?.status ?? selectedPlanetNode?.phase;
  return toUpperText(phaseRaw);
}

function resolveCorrosionLevel(selectedPlanetNode) {
  const parsed = Number(selectedPlanetNode?.physics?.corrosionLevel);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function resolveTableLabel(selectedTable, selectedPlanetNode) {
  return toText(selectedTable?.name) || toText(selectedPlanetNode?.label) || "Planeta";
}

function resolveMoonLabel(selectedMoonNode, selectedMoonLabel) {
  return toText(selectedMoonLabel) || toText(selectedMoonNode?.label) || "Mesic";
}

export function resolvePlanetMoonCausalGuidance({
  planetBuilderNarrative = null,
  stageZeroActive = false,
  stageZeroSetupOpen = false,
  stageZeroPresetSelected = false,
  stageZeroSchemaSummary = null,
  stageZeroAllSchemaStepsDone = false,
  stageZeroCommitBusy = false,
  quickGridOpen = false,
  selectedTable = null,
  selectedPlanetNode = null,
  selectedMoonNode = null,
  selectedMoonLabel = "",
  stageZeroStepDefinitions = [],
} = {}) {
  const base = normalizeNarrative(planetBuilderNarrative);
  const summary = normalizeSummary(stageZeroSchemaSummary);

  if (stageZeroActive && stageZeroSetupOpen && stageZeroPresetSelected) {
    if (stageZeroCommitBusy) {
      return {
        title: "Commit schema",
        why: "Schema planety se aplikuje atomicky do runtime vrstvy.",
        action: "Pockej na konvergenci preview a gridu.",
        severity: "info",
        source: "stage0",
      };
    }

    if (stageZeroAllSchemaStepsDone) {
      return {
        title: "Schema pripraveno",
        why: `Lego plan je kompletni (${summary.completed}/${summary.total}). Planeta ma jasne zakony pro civilizaci.`,
        action: "Klikni na Zazehnout Jadro a potvrd commit.",
        severity: "success",
        source: "stage0",
      };
    }

    const nextStepLabel = resolveStepLabel(summary.nextStepKey, stageZeroStepDefinitions);
    return {
      title: "Skladani zakonu planety",
      why: `Planeta reaguje na schema v realnem case (${summary.completed}/${summary.total} dilku).`,
      action: nextStepLabel ? `Dopln dalsi dil: ${nextStepLabel}.` : "Dopln dalsi schema dil podle planu.",
      severity: "info",
      source: "stage0",
    };
  }

  if (selectedMoonNode) {
    const moonLabel = resolveMoonLabel(selectedMoonNode, selectedMoonLabel);
    const parentPhase = toUpperText(selectedMoonNode?.parentPhase || selectedMoonNode?.v1?.status);
    const parentPhaseLabel = parentPhase || "UNKNOWN";
    return {
      title: `Mesic: ${moonLabel}`,
      why: `Mesic je capability vrstva planety. Nese kontext pro civilizaci a sdili fazi ${parentPhaseLabel}.`,
      action: quickGridOpen
        ? "Grid je otevreny. Over, ze mineral fakta odpovidaji moon capability pravidlum."
        : "Otevri grid a zkontroluj mineral fakta navazana na tento mesic.",
      severity: parentPhase === "CRITICAL" ? "critical" : parentPhase === "CORRODING" ? "warn" : "info",
      source: "moon",
    };
  }

  if (selectedPlanetNode || selectedTable) {
    const tableLabel = resolveTableLabel(selectedTable, selectedPlanetNode);
    const phase = resolvePlanetPhase(selectedPlanetNode);
    const corrosion = resolveCorrosionLevel(selectedPlanetNode);

    if (phase === "CRITICAL" || corrosion >= 0.75) {
      return {
        title: `Planeta: ${tableLabel}`,
        why: `Planeta je v kriticke fazi (${phase || "CRITICAL"}) a koroduje (${Math.round(corrosion * 100)}%).`,
        action: quickGridOpen
          ? "Analyzuj civilizaci v gridu a sniz write pressure nebo oprav kontraktni chyby."
          : "Otevri grid a zkontroluj civilizaci, kontrakty a write zatizeni.",
        severity: "critical",
        source: "planet_runtime",
      };
    }

    if (phase === "CORRODING" || corrosion >= 0.45) {
      return {
        title: `Planeta: ${tableLabel}`,
        why: `Planeta prechazi do faze ${phase || "CORRODING"}; rostou znamky degradace (${Math.round(corrosion * 100)}%).`,
        action: quickGridOpen
          ? "Sleduj civilizaci v gridu a priprav korektivni zapis nebo cleanup."
          : "Otevri grid a over kvalitu dat pred dalsim rozvojem.",
        severity: "warn",
        source: "planet_runtime",
      };
    }

    if (phase === "ACTIVE") {
      return {
        title: `Planeta: ${tableLabel}`,
        why: "Planeta je stabilni a aktivni. Fyzikalni zakony drzi konzistentni runtime chovani.",
        action: quickGridOpen ? "Pokracuj praci s civilizaci v gridu." : "Otevri grid a pokracuj pracovni tok.",
        severity: "success",
        source: "planet_runtime",
      };
    }

    return {
      title: `Planeta: ${tableLabel}`,
      why: "Planeta je pripraveny nosic dat. Dalsi kroky urci civilizacni tok a capability vrstva.",
      action: quickGridOpen ? "Pokracuj upravou civilizace v gridu." : "Otevri grid a zacni tvorit civilizaci.",
      severity: "info",
      source: "planet_runtime",
    };
  }

  return base;
}
