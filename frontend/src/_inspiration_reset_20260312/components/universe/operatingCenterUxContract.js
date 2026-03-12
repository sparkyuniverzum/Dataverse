const SURFACE_COPY = Object.freeze({
  promote: Object.freeze({
    eyebrow: "REALITY TRANSFER",
    subtitle: "Review surface pro presun reality. 3D workspace zustava aktivni a drzi vizualni kontext dopadu.",
    closeLabel: "Zpet do provozniho centra",
    launcherClosed: "Otevrit reality transfer review",
    launcherOpen: "Reality transfer review otevren",
  }),
  recovery: Object.freeze({
    eyebrow: "RECOVERY MODE",
    subtitle:
      "Blokovany nebo degradovany stav je soustredeny do jednoho opravneho surface pro rychly navrat do provozu.",
    closeLabel: "Zpet do provozniho centra",
    launcherClosed: "Otevrit recovery mode",
    launcherOpen: "Recovery mode otevren",
  }),
  governance: Object.freeze({
    eyebrow: "STAR CORE GOVERNANCE",
    subtitle: "Ridici centrum fyzikalnich zakonu galaxie s plnym provoznim kontextem.",
    closeLabel: "Zpet do provozniho centra",
  }),
});

export function resolveSurfaceCopy(mode) {
  return SURFACE_COPY[mode] || SURFACE_COPY.governance;
}

export function resolveWorkspacePresentationMode({ governanceMode, promoteReview, recoveryMode }) {
  if (governanceMode?.open) {
    return {
      cinematicMode: governanceMode.cinematicMode || "governance_mode",
      filter: "saturate(1.12) contrast(1.05) brightness(0.9)",
      transform: "translateX(-14px) scale(0.988)",
    };
  }
  if (recoveryMode?.open) {
    return {
      cinematicMode: recoveryMode.cinematicMode || "recovery_mode",
      filter: "saturate(1.04) contrast(1.03) brightness(0.94)",
      transform: "translateX(-8px) scale(0.994)",
    };
  }
  if (promoteReview?.open) {
    return {
      cinematicMode: promoteReview.cinematicMode || "promote_review",
      filter: "saturate(1.08) contrast(1.04) brightness(0.96)",
      transform: "translateX(-10px) scale(0.992)",
    };
  }
  return {
    cinematicMode: "default",
    filter: "none",
    transform: "none",
  };
}
