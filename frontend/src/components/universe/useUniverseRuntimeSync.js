import { useCallback, useEffect, useRef, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildGalaxyEventsStreamUrl,
  buildSnapshotUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildTablesUrl,
  normalizeSnapshot,
} from "../../lib/dataverseApi";
import { applySseFrameCursor, drainSseBuffer, parseSseFrame, sleep } from "./runtimeSyncUtils";

const STREAM_RECONNECT_DELAY_MS = 900;
const STAR_TELEMETRY_THROTTLE_MS = 4000;
const STAR_PULSE_RETENTION_MS = 18000;

export function useUniverseRuntimeSync({ galaxyId }) {
  const [snapshot, setSnapshot] = useState({ asteroids: [], bonds: [] });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starRuntime, setStarRuntime] = useState(null);
  const [starDomains, setStarDomains] = useState([]);
  const [starPolicy, setStarPolicy] = useState(null);
  const [starPulseByEntity, setStarPulseByEntity] = useState({});
  const [starPulseLastEventSeq, setStarPulseLastEventSeq] = useState(0);

  const activeGalaxyRef = useRef("");
  const refreshInFlightRef = useRef(null);
  const refreshQueuedRef = useRef(false);
  const streamCursorRef = useRef(0);
  const pulseCursorRef = useRef(0);
  const pulseByEntityRef = useRef(new Map());
  const pulseInFlightRef = useRef(null);
  const pulseQueuedRef = useRef(false);
  const telemetryInFlightRef = useRef(null);
  const telemetryLastAtRef = useRef(0);

  const mergePulsePayload = useCallback((payload, scopeGalaxyId) => {
    if (activeGalaxyRef.current !== scopeGalaxyId) return;
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const now = Date.now();
    const next = new Map(pulseByEntityRef.current);
    events.forEach((event) => {
      const entityId = String(event?.entity_id || "").trim();
      if (!entityId) return;
      const eventSeq = Number.isFinite(event?.event_seq) ? Math.floor(Number(event.event_seq)) : 0;
      const intensityRaw = Number.isFinite(event?.intensity) ? Number(event.intensity) : 0;
      next.set(entityId, {
        visualHint: String(event?.visual_hint || "orbital_pulse"),
        intensity: Math.max(0, Math.min(1.5, intensityRaw)),
        eventType: String(event?.event_type || ""),
        updatedAtMs: now,
        eventSeq,
      });
    });
    for (const [entityId, item] of next.entries()) {
      if (!item || now - Number(item.updatedAtMs || 0) > STAR_PULSE_RETENTION_MS) {
        next.delete(entityId);
      }
    }
    pulseByEntityRef.current = next;
    setStarPulseByEntity(Object.fromEntries(next.entries()));

    const nextCursorRaw = Number(payload?.last_event_seq);
    const nextCursor = Number.isFinite(nextCursorRaw) && nextCursorRaw >= 0 ? Math.floor(nextCursorRaw) : pulseCursorRef.current;
    pulseCursorRef.current = Math.max(pulseCursorRef.current, nextCursor);
    setStarPulseLastEventSeq(pulseCursorRef.current);
  }, []);

  const requestStarPulse = useCallback(
    async ({ afterEventSeq = null, limit = 64 } = {}) => {
      if (!galaxyId) return null;
      if (pulseInFlightRef.current) {
        pulseQueuedRef.current = true;
        return pulseInFlightRef.current;
      }

      const scopeGalaxyId = galaxyId;
      const task = (async () => {
        try {
          const response = await apiFetch(
            buildStarCorePulseUrl(API_BASE, scopeGalaxyId, {
              afterEventSeq,
              limit,
            })
          );
          if (!response.ok) {
            throw await apiErrorFromResponse(response, `Star pulse failed: ${response.status}`);
          }
          const body = await response.json().catch(() => ({}));
          mergePulsePayload(body, scopeGalaxyId);
        } catch {
          // Pulse feed is auxiliary; stream + snapshot refresh stay primary.
        }
      })();

      pulseInFlightRef.current = task;
      try {
        await task;
      } finally {
        pulseInFlightRef.current = null;
      }
      if (pulseQueuedRef.current) {
        pulseQueuedRef.current = false;
        return requestStarPulse({
          afterEventSeq: pulseCursorRef.current,
          limit,
        });
      }
      return null;
    },
    [galaxyId, mergePulsePayload]
  );

  const refreshStarTelemetry = useCallback(
    async ({ force = false } = {}) => {
      if (!galaxyId) return null;
      const now = Date.now();
      if (!force && now - telemetryLastAtRef.current < STAR_TELEMETRY_THROTTLE_MS) {
        return telemetryInFlightRef.current;
      }
      telemetryLastAtRef.current = now;
      if (telemetryInFlightRef.current) {
        return telemetryInFlightRef.current;
      }

      const scopeGalaxyId = galaxyId;
      const task = (async () => {
        try {
          const [runtimeResponse, domainsResponse, policyResponse] = await Promise.all([
            apiFetch(buildStarCoreRuntimeUrl(API_BASE, scopeGalaxyId, { windowEvents: 120 })),
            apiFetch(buildStarCoreDomainMetricsUrl(API_BASE, scopeGalaxyId, { windowEvents: 240 })),
            apiFetch(buildStarCorePolicyUrl(API_BASE, scopeGalaxyId)),
          ]);
          if (!runtimeResponse.ok || !domainsResponse.ok || !policyResponse.ok) {
            return;
          }
          const [runtimeBody, domainsBody, policyBody] = await Promise.all([
            runtimeResponse.json().catch(() => null),
            domainsResponse.json().catch(() => null),
            policyResponse.json().catch(() => null),
          ]);
          if (activeGalaxyRef.current !== scopeGalaxyId) {
            return;
          }
          setStarRuntime(runtimeBody && typeof runtimeBody === "object" ? runtimeBody : null);
          setStarDomains(Array.isArray(domainsBody?.domains) ? domainsBody.domains : []);
          setStarPolicy(policyBody && typeof policyBody === "object" ? policyBody : null);
        } catch {
          // Telemetry is non-blocking for core workspace operations.
        }
      })();

      telemetryInFlightRef.current = task;
      try {
        await task;
      } finally {
        telemetryInFlightRef.current = null;
      }
      return null;
    },
    [galaxyId]
  );

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
          void refreshStarTelemetry();
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
    [galaxyId, refreshStarTelemetry]
  );

  useEffect(() => {
    activeGalaxyRef.current = galaxyId;

    setError("");
    setSnapshot({ asteroids: [], bonds: [] });
    setTables([]);
    setStarRuntime(null);
    setStarDomains([]);
    setStarPolicy(null);
    setStarPulseByEntity({});
    setStarPulseLastEventSeq(0);

    streamCursorRef.current = 0;
    pulseCursorRef.current = 0;
    pulseByEntityRef.current = new Map();
    telemetryLastAtRef.current = 0;

    if (galaxyId) {
      void refreshProjection();
      void refreshStarTelemetry({ force: true });
      void requestStarPulse({ afterEventSeq: null, limit: 64 });
    } else {
      setLoading(false);
    }
  }, [galaxyId, refreshProjection, refreshStarTelemetry, requestStarPulse]);

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
        void requestStarPulse({ afterEventSeq: pulseCursorRef.current, limit: 96 });
        void refreshStarTelemetry();
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
  }, [galaxyId, refreshProjection, refreshStarTelemetry, requestStarPulse]);

  const clearRuntimeError = useCallback(() => {
    setError("");
  }, []);

  return {
    snapshot,
    tables,
    loading,
    error,
    starRuntime,
    starDomains,
    starPolicy,
    starPulseByEntity,
    starPulseLastEventSeq,
    setRuntimeError: setError,
    clearRuntimeError,
    refreshProjection,
    refreshStarTelemetry,
  };
}
