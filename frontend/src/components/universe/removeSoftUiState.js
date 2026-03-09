export function resolveRemoveSoftUiState({ armed = false, mineralKey = "" } = {}) {
  const key = String(mineralKey || "").trim();
  if (!armed) {
    return {
      primaryButtonLabel: "Provést remove_soft",
      explicitButtonLabel: "Odebrat nerost",
      confirmMessage: key ? `Potvrd remove_soft pro '${key}' dalsim klikem.` : "Potvrd remove_soft dalsim klikem.",
      badgeMessage: "",
    };
  }
  return {
    primaryButtonLabel: "Potvrdit remove_soft",
    explicitButtonLabel: "Potvrdit odebrani",
    confirmMessage: "",
    badgeMessage: key ? `Remove_soft je pripraven pro '${key}'. Potvrd dalsim klikem.` : "Remove_soft je pripraven.",
  };
}
