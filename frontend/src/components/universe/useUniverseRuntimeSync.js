import { useCallback, useEffect, useRef, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildGalaxyEventsStreamUrl,
  buildSnapshotUrl,
  buildTablesUrl,
  normalizeSnapshot,
} from "../../lib/dataverseApi";
import { applySseFrameCursor, drainSseBuffer, parseSseFrame, sleep } from "./runtimeSyncUtils";

const STREAM_RECONNECT_DELAY_MS = 900;

export function useUniverseRuntimeSync({ galaxyId }) {
  const [snapshot, setSnapshot] = useState({ asteroids: [], bonds: [] });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeGalaxyRef = useRef("");
  const refreshInFlightRef = useRef(null);
  const refreshQueuedRef = useRef(false);
  const streamCursorRef = useRef(0);

  const refreshProjection = useCallback(
    async ({ silent = false } = {}) => {
      if (!galaxyId) return;

      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true;
        return refreshInFlightRef.current;
      }

      const scopeGalaxyId = galaxyId;
      const task = (async () => {
        if (!silent) {
          setLoading(true);
        }
        try {
          const [snapshotResponse, tablesResponse] = await Promise.all([
            apiFetch(buildSnapshotUrl(API_BASE, null, scopeGalaxyId, null)),
            apiFetch(buildTablesUrl(API_BASE, null, scopeGalaxyId, null)),
          ]);

          if (!snapshotResponse.ok) {
            throw await apiErrorFromResponse(snapshotResponse, `Universe snapshot failed: ${snapshotResponse.status}`);
          }
          if (!tablesResponse.ok) {
            throw await apiErrorFromResponse(tablesResponse, `Universe tables failed: ${tablesResponse.status}`);
          }

          const [snapshotBody, tablesBody] = await Promise.all([snapshotResponse.json(), tablesResponse.json()]);
          const normalized = normalizeSnapshot(snapshotBody || {});
          const nextTables = Array.isArray(tablesBody?.tables) ? tablesBody.tables : [];

          if (activeGalaxyRef.current !== scopeGalaxyId) {
            return;
          }
          setSnapshot(normalized);
          setTables(nextTables);
          setError("");
        } catch (loadError) {
          if (activeGalaxyRef.current !== scopeGalaxyId) {
            return;
          }
          setError(loadError?.message || "Nacteni vesmiru selhalo.");
        } finally {
          if (!silent && activeGalaxyRef.current === scopeGalaxyId) {
            setLoading(false);
          }
        }
      })();

      refreshInFlightRef.current = task;
      try {
        await task;
      } finally {
        refreshInFlightRef.current = null;
      }

      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        return refreshProjection({ silent: true });
      }

      return null;
    },
    [galaxyId]
  );

  useEffect(() => {
    activeGalaxyRef.current = galaxyId;

    setError("");
    setSnapshot({ asteroids: [], bonds: [] });
    setTables([]);

    streamCursorRef.current = 0;

    if (galaxyId) {
      void refreshProjection();
    } else {
      setLoading(false);
    }
  }, [galaxyId, refreshProjection]);

  useEffect(() => {
    if (!galaxyId) return undefined;

    let isDisposed = false;
    const abortController = new AbortController();

    const handleFrame = (frame, consumeRefresh) => {
      const decision = applySseFrameCursor(frame, streamCursorRef.current);
      if (decision.changed) {
        streamCursorRef.current = decision.cursor;
      }
      if (decision.shouldRefresh) {
        consumeRefresh();
      }
    };

    const consumeStream = async () => {
      while (!isDisposed) {
        try {
          const streamUrl = buildGalaxyEventsStreamUrl(API_BASE, galaxyId, {
            lastEventSeq: streamCursorRef.current,
          });
          const response = await apiFetch(streamUrl, {
            signal: abortController.signal,
            headers: {
              Accept: "text/event-stream",
            },
          });

          if (!response.ok) {
            throw await apiErrorFromResponse(response, `Galaxy event stream failed: ${response.status}`);
          }
          if (!response.body) {
            throw new Error("Galaxy event stream has no body.");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!isDisposed) {
            const chunk = await reader.read();
            if (chunk.done) break;

            buffer += decoder.decode(chunk.value, { stream: true });
            buffer = drainSseBuffer(buffer, (frame) => {
              handleFrame(frame, () => {
                void refreshProjection({ silent: true });
              });
            });
          }

          const trailing = decoder.decode();
          if (trailing) {
            buffer += trailing;
          }
          const lastFrame = parseSseFrame(buffer);
          if (lastFrame) {
            handleFrame(lastFrame, () => {
              void refreshProjection({ silent: true });
            });
          }

          await reader.cancel().catch(() => {});
        } catch {
          if (isDisposed || abortController.signal.aborted) break;
          await sleep(STREAM_RECONNECT_DELAY_MS);
        }
      }
    };

    void consumeStream();

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [galaxyId, refreshProjection]);

  const clearRuntimeError = useCallback(() => {
    setError("");
  }, []);

  return {
    snapshot,
    tables,
    loading,
    error,
    setRuntimeError: setError,
    clearRuntimeError,
    refreshProjection,
  };
}
