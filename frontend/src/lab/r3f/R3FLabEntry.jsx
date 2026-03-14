import { useEffect } from "react";

import {
  clearR3FLabActivation,
  isR3FLabQueryEnabled,
  R3F_LAB_QUERY_KEY,
  rememberR3FLabActivation,
} from "./labActivation.js";
import { r3fLabPresetStore } from "./labPresetStore.js";
import R3FLabShell from "./R3FLabShell.jsx";
import "./r3fLab.css";

function resolveWindowStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
}

function resolveWindowSearch() {
  if (typeof window === "undefined") return "";
  return window.location.search || "";
}

export default function R3FLabEntry({
  search = resolveWindowSearch(),
  storage = resolveWindowStorage(),
  store = r3fLabPresetStore,
  onExit = null,
}) {
  const activatedFromQuery = isR3FLabQueryEnabled(search);
  const activationSource = activatedFromQuery ? "query" : "storage";

  useEffect(() => {
    if (activatedFromQuery) {
      rememberR3FLabActivation(storage);
    }
    const state = store.getState();
    if (
      !state.eventLog.some(
        (entry) => entry.kind === "system" && entry.label === "R3F Lab aktivovan" && entry.detail === activationSource
      )
    ) {
      state.logEvent({
        kind: "system",
        label: "R3F Lab aktivovan",
        detail: activationSource,
      });
    }
    store.getState().markReady();
  }, [activatedFromQuery, activationSource, storage, store]);

  function handleExit() {
    clearR3FLabActivation(storage);
    if (typeof onExit === "function") {
      onExit();
      return;
    }
    if (typeof window === "undefined") return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete(R3F_LAB_QUERY_KEY);
    window.location.assign(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  return <R3FLabShell activationSource={activationSource} onExit={handleExit} store={store} />;
}
