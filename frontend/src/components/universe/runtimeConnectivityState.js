import { useEffect, useMemo, useState } from "react";

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

function readNavigatorOnline() {
  if (typeof navigator === "undefined") return true;
  if (typeof navigator.onLine !== "boolean") return true;
  return navigator.onLine;
}

export function useRuntimeConnectivityState() {
  const [isOnline, setIsOnline] = useState(() => readNavigatorOnline());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return useMemo(() => resolveRuntimeConnectivityState(isOnline), [isOnline]);
}
