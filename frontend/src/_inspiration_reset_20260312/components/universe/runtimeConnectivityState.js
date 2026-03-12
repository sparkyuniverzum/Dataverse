import { useMemo } from "react";
import { useConnectivityState } from "../../hooks/useConnectivityState";

export const RUNTIME_CONNECTIVITY_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
};

export function resolveRuntimeConnectivityState(isOnline) {
  const online = isOnline !== false;
  return {
    isOnline: online,
    status: online ? RUNTIME_CONNECTIVITY_STATUS.ONLINE : RUNTIME_CONNECTIVITY_STATUS.OFFLINE,
    badgeLabel: online ? "online" : "offline",
    sidebarMessage: online
      ? "Runtime stream je pripojeny. Zapisy jsou povolene."
      : "Workspace je offline. Zapisy jsou docasne pozastavene, dokud se spojeni neobnovi.",
    writeBlocked: !online,
  };
}

export function buildOfflineWriteGuardMessage(operationLabel = "Zapis") {
  return `${String(operationLabel || "Zapis")} nelze provest: workspace je offline. Pockej na obnoveni spojeni.`;
}

export function useRuntimeConnectivityState() {
  const { isOnline } = useConnectivityState();
  return useMemo(() => resolveRuntimeConnectivityState(isOnline), [isOnline]);
}
