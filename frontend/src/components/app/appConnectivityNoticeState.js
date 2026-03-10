export function buildOfflineEntryGuardMessage(actionLabel = "Tato akce") {
  return `${String(actionLabel || "Tato akce")} neni dostupna: jsi offline. Pockej na obnoveni spojeni.`;
}

export function resolveAppConnectivityNotice(isOnline, phase = "auth_entry") {
  if (isOnline !== false) return null;

  if (phase === "session_boot") {
    return {
      tone: "warn",
      title: "Jsi offline",
      message: "Relaci zatim neoverim. Jakmile se spojeni vrati, bootstrap session bude pokracovat.",
    };
  }

  if (phase === "galaxy_gate") {
    return {
      tone: "warn",
      title: "Jsi offline",
      message: "Vyber a vytvareni galaxii jsou docasne pozastavene, dokud se spojeni neobnovi.",
    };
  }

  return {
    tone: "warn",
    title: "Jsi offline",
    message: "Prihlaseni a registrace ted nemohou probehnout. Jakmile se spojeni vrati, muzes pokracovat bez reloadu.",
  };
}
