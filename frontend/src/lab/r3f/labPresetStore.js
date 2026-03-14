import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import {
  createDefaultLabSnapshot,
  parseLabSnapshot,
  parseLabSnapshotText,
  stringifyLabSnapshot,
} from "./labConfigSchema.js";
import { clearLabSnapshot, loadLabSnapshot, saveLabSnapshot } from "./labPersistence.js";

function appendEventLog(eventLog, nextEntry) {
  return [...eventLog.slice(-29), nextEntry];
}

function normalizeLabEvent(entry) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: String(entry?.kind || "system"),
    label: String(entry?.label || "Neznama udalost"),
    detail: String(entry?.detail || ""),
  };
}

export function createLabPresetStore({ storage = null } = {}) {
  const loaded = loadLabSnapshot(storage);

  return createStore((set, get) => ({
    snapshot: loaded.snapshot,
    status: loaded.errorMessage ? "lab_invalid_preset" : "lab_booting",
    errorMessage: loaded.errorMessage,
    hadStoredSnapshot: loaded.hadStoredSnapshot,
    diagnostics: null,
    eventLog: [],
    markReady() {
      set((current) => ({
        status: current.status === "lab_invalid_preset" ? current.status : "lab_ready",
      }));
    },
    selectScene(sceneId) {
      set((current) => {
        const snapshot = parseLabSnapshot({
          ...current.snapshot,
          selectedSceneId: sceneId,
        });
        const persisted = saveLabSnapshot(snapshot, storage);
        return {
          snapshot,
          status: "lab_ready",
          errorMessage: "",
          hadStoredSnapshot: persisted || current.hadStoredSnapshot,
          eventLog: appendEventLog(
            current.eventLog,
            normalizeLabEvent({ kind: "scene", label: "Prepnuta scena", detail: sceneId })
          ),
        };
      });
    },
    setViewMode(viewMode) {
      set((current) => {
        const snapshot = parseLabSnapshot({
          ...current.snapshot,
          viewMode,
        });
        const persisted = saveLabSnapshot(snapshot, storage);
        return {
          snapshot,
          status: "lab_ready",
          errorMessage: "",
          hadStoredSnapshot: persisted || current.hadStoredSnapshot,
          eventLog: appendEventLog(
            current.eventLog,
            normalizeLabEvent({ kind: "mode", label: "Prepnuty rezim", detail: viewMode })
          ),
        };
      });
    },
    replaceSnapshot(nextSnapshot) {
      const snapshot = parseLabSnapshot(nextSnapshot);
      const persisted = saveLabSnapshot(snapshot, storage);
      set((current) => ({
        snapshot,
        status: "lab_ready",
        errorMessage: "",
        hadStoredSnapshot: persisted || current.hadStoredSnapshot,
        eventLog: appendEventLog(
          current.eventLog,
          normalizeLabEvent({ kind: "preset", label: "Preset nahrazen", detail: snapshot.selectedSceneId })
        ),
      }));
    },
    importSnapshotText(text) {
      try {
        const snapshot = parseLabSnapshotText(text);
        const persisted = saveLabSnapshot(snapshot, storage);
        set((current) => ({
          snapshot,
          status: "lab_ready",
          errorMessage: "",
          hadStoredSnapshot: persisted || current.hadStoredSnapshot,
          eventLog: appendEventLog(
            current.eventLog,
            normalizeLabEvent({ kind: "preset", label: "Preset importovan", detail: snapshot.selectedSceneId })
          ),
        }));
      } catch (error) {
        set((current) => ({
          status: "lab_invalid_preset",
          errorMessage: String(error?.message || "Preset nelze importovat."),
          eventLog: appendEventLog(
            current.eventLog,
            normalizeLabEvent({ kind: "error", label: "Import presetu selhal" })
          ),
        }));
      }
    },
    resetSnapshot() {
      const snapshot = createDefaultLabSnapshot();
      const persisted = saveLabSnapshot(snapshot, storage);
      set((current) => ({
        snapshot,
        status: "lab_ready",
        errorMessage: "",
        hadStoredSnapshot: persisted || current.hadStoredSnapshot,
        eventLog: appendEventLog(current.eventLog, normalizeLabEvent({ kind: "preset", label: "Preset resetovan" })),
      }));
    },
    clearStoredSnapshot() {
      clearLabSnapshot(storage);
      const snapshot = createDefaultLabSnapshot();
      set((current) => ({
        snapshot,
        status: "lab_ready",
        errorMessage: "",
        hadStoredSnapshot: false,
        eventLog: appendEventLog(
          current.eventLog,
          normalizeLabEvent({ kind: "preset", label: "Ulozeny preset smazan" })
        ),
      }));
    },
    exportSnapshotText() {
      return stringifyLabSnapshot(get().snapshot);
    },
    setDiagnostics(diagnostics) {
      set({ diagnostics });
    },
    logEvent(event) {
      set((current) => ({
        eventLog: appendEventLog(current.eventLog, normalizeLabEvent(event)),
      }));
    },
    clearEventLog() {
      set({ eventLog: [] });
    },
  }));
}

export const r3fLabPresetStore = createLabPresetStore();

export function useLabPresetStore(selector, store = r3fLabPresetStore) {
  return useStore(store, selector);
}
