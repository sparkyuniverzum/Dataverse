import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  bondSemanticsFromType,
  buildOccConflictMessage,
  buildGalaxyBondsUrl,
  buildGalaxyEventsStreamUrl,
  buildGalaxyMoonsUrl,
  buildGalaxyPlanetsUrl,
  buildImportJobErrorsUrl,
  buildImportJobUrl,
  buildImportRunUrl,
  buildParserPayload,
  buildSnapshotUrl,
  buildTablesUrl,
  isOccConflictError,
  normalizeBondType,
  normalizeSnapshot,
  toAsOfIso,
} from "../../lib/dataverseApi";
import { MODEL_PATH_LABEL, WORKSPACE_GUIDE } from "../../lib/onboarding";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import {
  DEFAULT_NODE_PHYSICS,
  deriveAsteroidBondDensityMap,
  deriveLinkPhysics,
  deriveMoonPhysics,
  derivePlanetPhysics,
  deriveTableBondDensity,
  normalizePhysicsKey,
} from "../../lib/physics_laws";
import { useUniverseStore } from "../../store/useUniverseStore";
import FloatingPanel from "../ui/FloatingPanel";
import ContextMenu from "../ui/ContextMenu";
import UniverseCanvas from "./UniverseCanvas";

function safeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function valueToLabel(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveTableForAsteroid(tables, asteroidId) {
  for (const table of tables) {
    const members = Array.isArray(table.members) ? table.members : [];
    if (members.some((row) => String(row.id) === String(asteroidId))) {
      return table;
    }
  }
  return null;
}

function resolveLinkEndpointValue(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value.source_id || value.target_id || "");
  }
  return String(value);
}

function parseSseMessage(block) {
  const text = String(block || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let event = "message";
  const dataLines = [];
  lines.forEach((line) => {
    if (!line || line.startsWith(":")) return;
    const colonIndex = line.indexOf(":");
    const field = colonIndex >= 0 ? line.slice(0, colonIndex) : line;
    const rawValue = colonIndex >= 0 ? line.slice(colonIndex + 1) : "";
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") {
      event = value || "message";
      return;
    }
    if (field === "data") {
      dataLines.push(value);
    }
  });
  if (!dataLines.length) return null;
  const rawData = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return { event, data: null };
  }
}

const TABLE_PREFIX_RE = /^\s*([A-Za-zÀ-ž0-9 _-]{2,64})\s*:/;

function deriveTableNameFromEvent(value, metadata) {
  const data = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  for (const key of ["kategorie", "category", "typ", "type", "table", "table_name"]) {
    const candidate = data[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (typeof value === "string") {
    const match = value.match(TABLE_PREFIX_RE);
    if (match?.[1]) return match[1].trim();
  }
  return "Uncategorized";
}

function splitEntityAndPlanetName(table) {
  const explicitConstellation = String(table?.constellation_name || "").trim();
  const explicitPlanet = String(table?.planet_name || "").trim();
  if (explicitConstellation && explicitPlanet) {
    return {
      entityName: explicitConstellation,
      planetName: explicitPlanet,
    };
  }

  const raw = String(table?.name || "").trim() || "Souhvezdi";
  const separators = [">", "/", "::", "|"];
  for (const separator of separators) {
    if (!raw.includes(separator)) continue;
    const parts = raw.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        entityName: parts[0],
        planetName: parts.slice(1).join(" / "),
      };
    }
  }
  return {
    entityName: raw,
    planetName: raw,
  };
}

function resolveStatusColor(status) {
  const key = String(status || "GREEN").toUpperCase();
  if (key === "RED") return "#ff97b1";
  if (key === "YELLOW") return "#ffd58f";
  return "#92ffd8";
}

const RESERVED_METADATA_KEYS = new Set(["table", "table_id", "table_name"]);
const QUICK_LINK_TYPE_OPTIONS = [
  {
    value: "RELATION",
    label: "RELATION",
    direction: "A ↔ B",
    description: "Vzájemná vazba bez směru. A+B je stejná vazba jako B+A.",
  },
  {
    value: "TYPE",
    label: "TYPE",
    direction: "A → B",
    description: "Typová vazba. A je instance/součást typu B.",
  },
  {
    value: "FLOW",
    label: "FLOW",
    direction: "A → B",
    description: "Datový tok ze zdroje A do cíle B.",
  },
  {
    value: "GUARDIAN",
    label: "GUARDIAN",
    direction: "A → B",
    description: "Kontrolní/hlídací tok ze zdroje A na cíl B.",
  },
];

export default function UniverseWorkspace({ galaxy, onBackToGalaxies, onLogout }) {
  const {
    level,
    selectedTableId,
    selectedAsteroidId,
    camera,
    panels,
    contextMenu,
    linkDraft,
    focusTable,
    focusAsteroid,
    backToTables,
    openContextMenu,
    closeContextMenu,
    startLinkDraft,
    updateLinkDraft,
    clearLinkDraft,
    patchPanel,
  } = useUniverseStore();

  const [asOfInput, setAsOfInput] = useState("");
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState({ asteroids: [], bonds: [] });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hoveredLink, setHoveredLink] = useState(null);
  const [createFieldKey, setCreateFieldKey] = useState("");
  const [createFieldValue, setCreateFieldValue] = useState("");
  const [gridDraft, setGridDraft] = useState({});
  const [constellations, setConstellations] = useState([]);
  const [constellationsLoading, setConstellationsLoading] = useState(false);
  const [constellationsError, setConstellationsError] = useState("");
  const [planets, setPlanets] = useState([]);
  const [planetsLoading, setPlanetsLoading] = useState(false);
  const [planetsError, setPlanetsError] = useState("");
  const [moons, setMoons] = useState([]);
  const [moonsLoading, setMoonsLoading] = useState(false);
  const [moonsError, setMoonsError] = useState("");
  const [bondsV1, setBondsV1] = useState([]);
  const [bondsV1Loading, setBondsV1Loading] = useState(false);
  const [bondsV1Error, setBondsV1Error] = useState("");
  const [draftEntityName, setDraftEntityName] = useState("");
  const [draftPlanetName, setDraftPlanetName] = useState("");
  const [draftMoonLabel, setDraftMoonLabel] = useState("");
  const [draftMetaKey, setDraftMetaKey] = useState("");
  const [draftMetaValue, setDraftMetaValue] = useState("");
  const [quickLinkSourceId, setQuickLinkSourceId] = useState("");
  const [quickLinkTargetId, setQuickLinkTargetId] = useState("");
  const [quickLinkType, setQuickLinkType] = useState("RELATION");
  const [quickFindTargetId, setQuickFindTargetId] = useState("");
  const [quickFormulaTargetId, setQuickFormulaTargetId] = useState("");
  const [quickFormulaField, setQuickFormulaField] = useState("marze");
  const [quickFormulaFunction, setQuickFormulaFunction] = useState("SUM");
  const [quickFormulaSourceField, setQuickFormulaSourceField] = useState("cena");
  const [quickGuardianTargetId, setQuickGuardianTargetId] = useState("");
  const [quickGuardianField, setQuickGuardianField] = useState("cena");
  const [quickGuardianOperator, setQuickGuardianOperator] = useState(">");
  const [quickGuardianThreshold, setQuickGuardianThreshold] = useState("1000");
  const [quickGuardianAction, setQuickGuardianAction] = useState("ALERT");
  const [quickDeleteTargetId, setQuickDeleteTargetId] = useState("");
  const [selectedBondId, setSelectedBondId] = useState("");
  const [bondEditorType, setBondEditorType] = useState("RELATION");
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState("");
  const [branchBusy, setBranchBusy] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [draftBranchName, setDraftBranchName] = useState("staging");
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("preview");
  const [importStrict, setImportStrict] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [importInfo, setImportInfo] = useState("");
  const [lastImportJob, setLastImportJob] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [streamState, setStreamState] = useState("OFF");

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });
  const streamCursorRef = useRef(null);
  const streamRefreshTimeoutRef = useRef(null);
  const tablesRef = useRef(tables);

  const asOfIso = useMemo(() => toAsOfIso(asOfInput), [asOfInput]);
  const historicalMode = Boolean(asOfIso);
  const activeBranchId = selectedBranchId || null;
  const selectedBranch = useMemo(
    () => branches.find((item) => String(item.id) === String(selectedBranchId || "")) || null,
    [branches, selectedBranchId]
  );
  const activeWorkspaceLabel = selectedBranch ? `branch:${selectedBranch.name}` : "main";

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    streamCursorRef.current = null;
  }, [activeBranchId, galaxy?.id, historicalMode]);

  const loadBranches = useCallback(async () => {
    if (!galaxy?.id) return;
    setBranchesLoading(true);
    setBranchesError("");
    try {
      const url = new URL(`${API_BASE}/branches`);
      url.searchParams.set("galaxy_id", String(galaxy.id));
      const response = await apiFetch(url.toString());
      if (!response.ok) {
        throw new Error(`Branches failed: ${response.status}`);
      }
      const body = await response.json();
      const items = Array.isArray(body) ? body : [];
      setBranches(items);
      setSelectedBranchId((previous) => {
        if (!previous) return "";
        const exists = items.some((branch) => String(branch?.id || "") === String(previous));
        return exists ? previous : "";
      });
    } catch (loadError) {
      setBranchesError(loadError.message || "Branches load failed");
    } finally {
      setBranchesLoading(false);
    }
  }, [galaxy?.id]);

  useEffect(() => {
    setImportFile(null);
    setImportInfo("");
    setLastImportJob(null);
    setImportErrors([]);
    setImportMode("preview");
    setImportStrict(true);
    setSelectedBranchId("");
    setBranches([]);
    setBranchesError("");
    setDraftBranchName("staging");
  }, [galaxy?.id]);

  const loadUniverse = useCallback(async () => {
    if (!galaxy?.id) return;
    setLoading(true);
    setError("");
    try {
      const [snapshotRes, tablesRes] = await Promise.all([
        apiFetch(buildSnapshotUrl(API_BASE, asOfIso, galaxy.id, activeBranchId)),
        apiFetch(buildTablesUrl(API_BASE, asOfIso, galaxy.id, activeBranchId)),
      ]);

      if (!snapshotRes.ok) throw new Error(`Snapshot failed: ${snapshotRes.status}`);
      if (!tablesRes.ok) throw new Error(`Tables failed: ${tablesRes.status}`);

      const snapBody = await snapshotRes.json();
      const tableBody = await tablesRes.json();
      const normalized = normalizeSnapshot(snapBody);

      setSnapshot(normalized);
      setTables(Array.isArray(tableBody?.tables) ? tableBody.tables : []);
      setGridDraft({});
    } catch (loadError) {
      setError(loadError.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, asOfIso, galaxy?.id]);
  const refreshDerivedData = useCallback(async () => {
    if (!galaxy?.id) return;
    try {
      const constellationsUrl = new URL(`${API_BASE}/galaxies/${galaxy.id}/constellations`);
      const planetsUrl = new URL(buildGalaxyPlanetsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
      const moonsUrl = new URL(buildGalaxyMoonsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
      const bondsUrl = new URL(buildGalaxyBondsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
      if (asOfIso) {
        constellationsUrl.searchParams.set("as_of", asOfIso);
      }
      if (activeBranchId) {
        constellationsUrl.searchParams.set("branch_id", String(activeBranchId));
      }

      const [tablesRes, constellationsRes, planetsRes, moonsRes, bondsRes] = await Promise.all([
        apiFetch(buildTablesUrl(API_BASE, asOfIso, galaxy.id, activeBranchId)),
        apiFetch(constellationsUrl.toString()),
        apiFetch(planetsUrl.toString()),
        apiFetch(moonsUrl.toString()),
        apiFetch(bondsUrl.toString()),
      ]);

      if (tablesRes.ok) {
        const body = await tablesRes.json();
        setTables(Array.isArray(body?.tables) ? body.tables : []);
      }
      if (constellationsRes.ok) {
        const body = await constellationsRes.json();
        setConstellations(Array.isArray(body?.items) ? body.items : []);
      }
      if (planetsRes.ok) {
        const body = await planetsRes.json();
        setPlanets(Array.isArray(body?.items) ? body.items : []);
      }
      if (moonsRes.ok) {
        const body = await moonsRes.json();
        setMoons(Array.isArray(body?.items) ? body.items : []);
      }
      if (bondsRes.ok) {
        const body = await bondsRes.json();
        setBondsV1(Array.isArray(body?.items) ? body.items : []);
      }
    } catch {
      // Keep stream alive even when a refresh round fails.
    }
  }, [activeBranchId, asOfIso, galaxy?.id]);
  const refreshDerivedDataRef = useRef(refreshDerivedData);
  useEffect(() => {
    refreshDerivedDataRef.current = refreshDerivedData;
  }, [refreshDerivedData]);

  const applyStreamDelta = useCallback((events) => {
    const safeEvents = Array.isArray(events) ? events : [];
    if (!safeEvents.length) return;

    setSnapshot((prev) => {
      const asteroidsById = new Map((Array.isArray(prev?.asteroids) ? prev.asteroids : []).map((item) => [String(item.id), { ...item }]));
      const bondsById = new Map((Array.isArray(prev?.bonds) ? prev.bonds : []).map((item) => [String(item.id), { ...item }]));
      const tablesByName = new Map(
        (Array.isArray(tablesRef.current) ? tablesRef.current : []).map((table) => [String(table?.name || "").trim().toLowerCase(), table])
      );

      const removeBondsByAsteroid = (asteroidId) => {
        const asteroidKey = String(asteroidId || "");
        if (!asteroidKey) return;
        for (const [bondId, bond] of bondsById.entries()) {
          if (String(bond?.source_id || "") === asteroidKey || String(bond?.target_id || "") === asteroidKey) {
            bondsById.delete(bondId);
          }
        }
      };

      const resolveTableIdentity = (value, metadata) => {
        const tableName = deriveTableNameFromEvent(value, metadata);
        const byName = tablesByName.get(tableName.toLowerCase());
        const semantic = splitEntityAndPlanetName(byName || { name: tableName });
        return {
          tableName,
          tableId: String(byName?.table_id || byName?.id || `pending:${tableName.toLowerCase()}`),
          constellationName: String(byName?.constellation_name || semantic.entityName || "Uncategorized"),
          planetName: String(byName?.planet_name || semantic.planetName || "Planet"),
        };
      };

      safeEvents.forEach((event) => {
        const eventType = String(event?.event_type || "").toUpperCase();
        const entityId = String(event?.entity_id || "");
        const payload = event?.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {};
        const timestamp = String(event?.timestamp || new Date().toISOString());

        if (eventType === "ASTEROID_CREATED") {
          if (!entityId) return;
          const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata) ? payload.metadata : {};
          const value = payload.value ?? null;
          const tableIdentity = resolveTableIdentity(value, metadata);
          asteroidsById.set(entityId, {
            id: entityId,
            value,
            table_id: tableIdentity.tableId,
            table_name: tableIdentity.tableName,
            constellation_name: tableIdentity.constellationName,
            planet_name: tableIdentity.planetName,
            metadata,
            calculated_values: {},
            active_alerts: [],
            created_at: timestamp,
          });
          return;
        }

        if (eventType === "ASTEROID_VALUE_UPDATED") {
          const asteroid = asteroidsById.get(entityId);
          if (!asteroid) return;
          const nextValue = payload.value;
          const tableIdentity = resolveTableIdentity(nextValue, asteroid.metadata);
          asteroidsById.set(entityId, {
            ...asteroid,
            value: nextValue,
            table_id: tableIdentity.tableId,
            table_name: tableIdentity.tableName,
            constellation_name: tableIdentity.constellationName,
            planet_name: tableIdentity.planetName,
          });
          return;
        }

        if (eventType === "METADATA_UPDATED") {
          const asteroid = asteroidsById.get(entityId);
          if (!asteroid) return;
          const metadataPatch = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata) ? payload.metadata : {};
          const mergedMetadata = { ...(asteroid.metadata || {}), ...metadataPatch };
          const tableIdentity = resolveTableIdentity(asteroid.value, mergedMetadata);
          asteroidsById.set(entityId, {
            ...asteroid,
            metadata: mergedMetadata,
            table_id: tableIdentity.tableId,
            table_name: tableIdentity.tableName,
            constellation_name: tableIdentity.constellationName,
            planet_name: tableIdentity.planetName,
          });
          return;
        }

        if (eventType === "ASTEROID_SOFT_DELETED") {
          asteroidsById.delete(entityId);
          removeBondsByAsteroid(entityId);
          return;
        }

        if (eventType === "BOND_FORMED") {
          const sourceId = String(payload.source_id || "");
          const targetId = String(payload.target_id || "");
          if (!entityId || !sourceId || !targetId || sourceId === targetId) return;
          const sourceAsteroid = asteroidsById.get(sourceId);
          const targetAsteroid = asteroidsById.get(targetId);
          if (!sourceAsteroid || !targetAsteroid) return;
          const semantics = bondSemanticsFromType(payload.type || "RELATION");
          bondsById.set(entityId, {
            id: entityId,
            source_id: sourceId,
            target_id: targetId,
            type: semantics.type,
            directional: semantics.directional,
            flow_direction: semantics.flow_direction,
            source_table_id: String(sourceAsteroid.table_id || ""),
            source_table_name: String(sourceAsteroid.table_name || "Unknown"),
            source_constellation_name: String(sourceAsteroid.constellation_name || "Unknown"),
            source_planet_name: String(sourceAsteroid.planet_name || "Unknown"),
            target_table_id: String(targetAsteroid.table_id || ""),
            target_table_name: String(targetAsteroid.table_name || "Unknown"),
            target_constellation_name: String(targetAsteroid.constellation_name || "Unknown"),
            target_planet_name: String(targetAsteroid.planet_name || "Unknown"),
          });
          return;
        }

        if (eventType === "BOND_SOFT_DELETED") {
          bondsById.delete(entityId);
        }
      });

      const nextAsteroids = [...asteroidsById.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const asteroidIdSet = new Set(nextAsteroids.map((item) => String(item.id)));
      const nextBonds = [...bondsById.values()]
        .filter(
          (bond) =>
            asteroidIdSet.has(String(bond?.source_id || "")) &&
            asteroidIdSet.has(String(bond?.target_id || ""))
        )
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

      return {
        asteroids: nextAsteroids,
        bonds: nextBonds,
      };
    });
  }, []);

  const scheduleStreamRefresh = useCallback(() => {
    if (streamRefreshTimeoutRef.current) return;
    streamRefreshTimeoutRef.current = window.setTimeout(() => {
      streamRefreshTimeoutRef.current = null;
      refreshDerivedDataRef.current?.();
    }, 260);
  }, []);

  useEffect(() => {
    loadUniverse();
  }, [loadUniverse]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(
    () => () => {
      if (streamRefreshTimeoutRef.current) {
        window.clearTimeout(streamRefreshTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!galaxy?.id || historicalMode) {
      setStreamState("OFF");
      return;
    }

    let active = true;
    let reconnectTimer = null;
    let controller = null;

    const consumeStream = async () => {
      controller = new AbortController();
      setStreamState("CONNECTING");

      const url = buildGalaxyEventsStreamUrl(API_BASE, galaxy.id, {
        branchId: activeBranchId,
        lastEventSeq: Number.isFinite(streamCursorRef.current) ? streamCursorRef.current : null,
        pollMs: 1200,
        heartbeatSec: 15,
      });
      const response = await apiFetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
        },
      });
      if (!response.ok || !response.body) {
        throw new Error(`Events stream failed: ${response.status}`);
      }

      setStreamState("LIVE");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (active) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let delimiterIndex = buffer.indexOf("\n\n");
        while (delimiterIndex >= 0) {
          const chunk = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + 2);
          delimiterIndex = buffer.indexOf("\n\n");
          const parsed = parseSseMessage(chunk);
          if (!parsed || !parsed.data || typeof parsed.data !== "object") continue;
          const nextSeq = Number(parsed.data.last_event_seq);
          if (Number.isFinite(nextSeq) && nextSeq >= 0) {
            streamCursorRef.current = Math.floor(nextSeq);
          }
          if (parsed.event === "update") {
            const events = Array.isArray(parsed.data.events) ? parsed.data.events : [];
            if (events.length) {
              applyStreamDelta(events);
            }
            scheduleStreamRefresh();
          }
        }
      }

      reader.releaseLock();
      if (active) {
        throw new Error("Events stream closed");
      }
    };

    const connect = async () => {
      try {
        await consumeStream();
      } catch (streamError) {
        if (!active) return;
        if (controller?.signal?.aborted) return;
        setStreamState("RETRY");
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, 1400);
      }
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (controller) controller.abort();
      if (streamRefreshTimeoutRef.current) {
        window.clearTimeout(streamRefreshTimeoutRef.current);
        streamRefreshTimeoutRef.current = null;
      }
      setStreamState("OFF");
    };
  }, [activeBranchId, applyStreamDelta, galaxy?.id, historicalMode, scheduleStreamRefresh]);

  useEffect(() => {
    if (!galaxy?.id) return;
    let active = true;
    const loadConstellations = async () => {
      setConstellationsLoading(true);
      setConstellationsError("");
      try {
        const url = new URL(`${API_BASE}/galaxies/${galaxy.id}/constellations`);
        if (asOfIso) {
          url.searchParams.set("as_of", asOfIso);
        }
        if (activeBranchId) {
          url.searchParams.set("branch_id", String(activeBranchId));
        }
        const response = await apiFetch(url.toString());
        if (!response.ok) {
          throw new Error(`Constellations failed: ${response.status}`);
        }
        const body = await response.json();
        if (!active) return;
        setConstellations(Array.isArray(body?.items) ? body.items : []);
      } catch (loadError) {
        if (!active) return;
        setConstellationsError(loadError.message || "Constellations load failed");
      } finally {
        if (active) setConstellationsLoading(false);
      }
    };
    loadConstellations();
    return () => {
      active = false;
    };
  }, [activeBranchId, galaxy?.id, asOfIso]);

  useEffect(() => {
    if (!galaxy?.id) return;
    let active = true;
    const loadBonds = async () => {
      setBondsV1Loading(true);
      setBondsV1Error("");
      try {
        const response = await apiFetch(buildGalaxyBondsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
        if (!response.ok) {
          throw new Error(`Bonds failed: ${response.status}`);
        }
        const body = await response.json();
        if (!active) return;
        setBondsV1(Array.isArray(body?.items) ? body.items : []);
      } catch (loadError) {
        if (!active) return;
        setBondsV1Error(loadError.message || "Bonds load failed");
      } finally {
        if (active) setBondsV1Loading(false);
      }
    };
    loadBonds();
    return () => {
      active = false;
    };
  }, [activeBranchId, galaxy?.id, asOfIso]);

  useEffect(() => {
    if (!galaxy?.id) return;
    let active = true;
    const loadPlanets = async () => {
      setPlanetsLoading(true);
      setPlanetsError("");
      try {
        const response = await apiFetch(buildGalaxyPlanetsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
        if (!response.ok) {
          throw new Error(`Planets failed: ${response.status}`);
        }
        const body = await response.json();
        if (!active) return;
        setPlanets(Array.isArray(body?.items) ? body.items : []);
      } catch (loadError) {
        if (!active) return;
        setPlanetsError(loadError.message || "Planets load failed");
      } finally {
        if (active) setPlanetsLoading(false);
      }
    };
    loadPlanets();
    return () => {
      active = false;
    };
  }, [activeBranchId, galaxy?.id, asOfIso]);

  useEffect(() => {
    if (!galaxy?.id) return;
    let active = true;
    const loadMoons = async () => {
      setMoonsLoading(true);
      setMoonsError("");
      try {
        const response = await apiFetch(buildGalaxyMoonsUrl(API_BASE, galaxy.id, asOfIso, activeBranchId));
        if (!response.ok) {
          throw new Error(`Moons failed: ${response.status}`);
        }
        const body = await response.json();
        if (!active) return;
        setMoons(Array.isArray(body?.items) ? body.items : []);
      } catch (loadError) {
        if (!active) return;
        setMoonsError(loadError.message || "Moons load failed");
      } finally {
        if (active) setMoonsLoading(false);
      }
    };
    loadMoons();
    return () => {
      active = false;
    };
  }, [activeBranchId, galaxy?.id, asOfIso]);

  useEffect(() => {
    if (!selectedTableId) return;
    const exists = tables.some((table) => String(table.table_id) === String(selectedTableId));
    if (!exists) {
      backToTables();
    }
  }, [backToTables, selectedTableId, tables]);

  const asteroidById = useMemo(() => {
    const map = new Map();
    snapshot.asteroids.forEach((asteroid) => {
      map.set(String(asteroid.id), asteroid);
    });
    return map;
  }, [snapshot.asteroids]);
  const snapshotBondById = useMemo(() => {
    const map = new Map();
    snapshot.bonds.forEach((bond) => {
      map.set(String(bond.id), bond);
    });
    return map;
  }, [snapshot.bonds]);
  const planetMetricsByTableId = useMemo(() => {
    const map = new Map();
    planets.forEach((item) => {
      const tableId = String(item?.table_id || "");
      if (!tableId) return;
      map.set(tableId, item);
    });
    return map;
  }, [planets]);
  const moonMetricsByAsteroidId = useMemo(() => {
    const map = new Map();
    moons.forEach((item) => {
      const asteroidId = String(item?.asteroid_id || "");
      if (!asteroidId) return;
      map.set(asteroidId, item);
    });
    return map;
  }, [moons]);
  const bondMetricsById = useMemo(() => {
    const map = new Map();
    bondsV1.forEach((item) => {
      const bondId = String(item?.bond_id || "");
      if (!bondId) return;
      map.set(bondId, item);
    });
    return map;
  }, [bondsV1]);
  const constellationMetricsByName = useMemo(() => {
    const map = new Map();
    constellations.forEach((item) => {
      const key = normalizePhysicsKey(item?.name);
      if (!key) return;
      map.set(key, item);
    });
    return map;
  }, [constellations]);
  const asteroidBondDensityById = useMemo(() => deriveAsteroidBondDensityMap(snapshot.bonds), [snapshot.bonds]);
  const tablePhysicsById = useMemo(() => {
    const map = new Map();
    tables.forEach((table) => {
      const tableId = String(table?.table_id || "");
      if (!tableId) return;
      const semantic = splitEntityAndPlanetName(table);
      const constellationKey = normalizePhysicsKey(table?.constellation_name || semantic.entityName);
      const planetMetric = planetMetricsByTableId.get(tableId) || null;
      const constellationMetric = constellationMetricsByName.get(constellationKey) || null;
      const bondDensity = deriveTableBondDensity(table);
      map.set(
        tableId,
        derivePlanetPhysics({
          planetMetrics: planetMetric,
          constellationMetrics: constellationMetric,
          bondDensity,
        })
      );
    });
    return map;
  }, [constellationMetricsByName, planetMetricsByTableId, tables]);
  const asteroidPhysicsById = useMemo(() => {
    const map = new Map();
    snapshot.asteroids.forEach((asteroid) => {
      const asteroidId = String(asteroid?.id || "");
      if (!asteroidId) return;
      const moonMetric = moonMetricsByAsteroidId.get(asteroidId) || null;
      const bondDensity = asteroidBondDensityById.get(asteroidId) || 0;
      map.set(
        asteroidId,
        deriveMoonPhysics({
          moonMetrics: moonMetric,
          bondDensity,
        })
      );
    });
    return map;
  }, [asteroidBondDensityById, moonMetricsByAsteroidId, snapshot.asteroids]);

  const layout = useMemo(() => {
    const next = calculateHierarchyLayout({
      tables,
      selectedTableId,
      asteroidById,
      tablePhysicsById,
      asteroidPhysicsById,
      previous: layoutRef.current,
    });
    layoutRef.current = {
      tablePositions: next.tablePositions,
      asteroidPositions: next.asteroidPositions,
    };
    return next;
  }, [tables, selectedTableId, asteroidById, tablePhysicsById, asteroidPhysicsById]);

  const tableNodes = useMemo(
    () =>
      layout.tableNodes.map((node) => ({
        ...node,
        position: layout.tablePositions.get(node.id) || [0, 0, 0],
        v1: planetMetricsByTableId.get(node.id) || null,
        physics: tablePhysicsById.get(node.id) || DEFAULT_NODE_PHYSICS,
      })),
    [layout, planetMetricsByTableId, tablePhysicsById]
  );

  const asteroidNodes = useMemo(
    () =>
      layout.asteroidNodes.map((node) => ({
        ...node,
        position: layout.asteroidPositions.get(node.id) || [0, 0, 0],
        v1: moonMetricsByAsteroidId.get(node.id) || null,
        physics: asteroidPhysicsById.get(node.id) || DEFAULT_NODE_PHYSICS,
      })),
    [layout, moonMetricsByAsteroidId, asteroidPhysicsById]
  );
  const tableNodeById = useMemo(() => new Map(tableNodes.map((node) => [node.id, node])), [tableNodes]);
  const enrichedTableLinks = useMemo(
    () =>
      layout.tableLinks.map((link) => {
        const sourceId = resolveLinkEndpointValue(link.source);
        const targetId = resolveLinkEndpointValue(link.target);
        const sourceNode = tableNodeById.get(sourceId);
        const targetNode = tableNodeById.get(targetId);
        return {
          ...link,
          physics: deriveLinkPhysics({
            link,
            sourcePhysics: sourceNode?.physics,
            targetPhysics: targetNode?.physics,
          }),
        };
      }),
    [layout.tableLinks, tableNodeById]
  );
  const enrichedAsteroidLinks = useMemo(
    () =>
      layout.asteroidLinks.map((link) => {
        const snapshotBond = snapshotBondById.get(String(link.id));
        const metric = bondMetricsById.get(String(link.id));
        const merged = snapshotBond ? { ...link, ...snapshotBond } : link;
        const sourceId = resolveLinkEndpointValue(merged.source || merged.source_id);
        const targetId = resolveLinkEndpointValue(merged.target || merged.target_id);
        const sourcePhysics = asteroidPhysicsById.get(sourceId);
        const targetPhysics = asteroidPhysicsById.get(targetId);
        const linked = metric ? { ...merged, v1: metric } : merged;
        return {
          ...linked,
          physics: deriveLinkPhysics({
            link: linked,
            bondMetrics: metric,
            sourcePhysics,
            targetPhysics,
          }),
        };
      }),
    [asteroidPhysicsById, bondMetricsById, layout.asteroidLinks, snapshotBondById]
  );

  const selectedTable = useMemo(
    () => tables.find((table) => String(table.table_id) === String(selectedTableId || "")) || null,
    [selectedTableId, tables]
  );

  const selectedAsteroid = useMemo(
    () => snapshot.asteroids.find((asteroid) => String(asteroid.id) === String(selectedAsteroidId || "")) || null,
    [selectedAsteroidId, snapshot.asteroids]
  );
  const selectedBond = useMemo(
    () => snapshot.bonds.find((bond) => String(bond.id) === String(selectedBondId || "")) || null,
    [selectedBondId, snapshot.bonds]
  );
  const selectedMoonV1 = useMemo(
    () => moons.find((item) => String(item.asteroid_id) === String(selectedAsteroidId || "")) || null,
    [moons, selectedAsteroidId]
  );
  const selectedBondV1 = useMemo(
    () => bondsV1.find((item) => String(item.bond_id) === String(selectedBondId || "")) || null,
    [bondsV1, selectedBondId]
  );
  const selectedSemantic = useMemo(
    () => splitEntityAndPlanetName(selectedTable),
    [selectedTable]
  );
  const moonQuickOptions = useMemo(
    () =>
      snapshot.asteroids
        .map((asteroid) => {
          const id = String(asteroid.id);
          const label = valueToLabel(asteroid.value) || id.slice(0, 8);
          const table = resolveTableForAsteroid(tables, asteroid.id);
          const semantic = splitEntityAndPlanetName(table);
          return {
            id,
            label: `${label} • ${semantic.entityName}/${semantic.planetName}`,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [snapshot.asteroids, tables]
  );
  const selectedQuickLinkTypeOption = useMemo(
    () => QUICK_LINK_TYPE_OPTIONS.find((item) => item.value === quickLinkType) || QUICK_LINK_TYPE_OPTIONS[0],
    [quickLinkType]
  );

  useEffect(() => {
    if (!moonQuickOptions.length) {
      setQuickFindTargetId("");
      setQuickFormulaTargetId("");
      setQuickGuardianTargetId("");
      setQuickDeleteTargetId("");
      setQuickLinkSourceId("");
      setQuickLinkTargetId("");
      return;
    }

    const firstId = moonQuickOptions[0].id;
    const secondId = moonQuickOptions[1]?.id || firstId;
    const validIds = new Set(moonQuickOptions.map((item) => item.id));

    setQuickFindTargetId((previous) => (previous && validIds.has(previous) ? previous : firstId));
    setQuickFormulaTargetId((previous) => (previous && validIds.has(previous) ? previous : firstId));
    setQuickGuardianTargetId((previous) => (previous && validIds.has(previous) ? previous : firstId));
    setQuickDeleteTargetId((previous) => (previous && validIds.has(previous) ? previous : firstId));
    setQuickLinkSourceId((previous) => (previous && validIds.has(previous) ? previous : firstId));
    setQuickLinkTargetId((previous) => (previous && validIds.has(previous) ? previous : secondId));
  }, [moonQuickOptions]);

  useEffect(() => {
    if (!selectedBondId) return;
    const exists = snapshot.bonds.some((bond) => String(bond.id) === String(selectedBondId));
    if (!exists) {
      setSelectedBondId("");
    }
  }, [selectedBondId, snapshot.bonds]);

  useEffect(() => {
    if (!selectedBond) return;
    setBondEditorType(normalizeBondType(selectedBond.type || "RELATION"));
  }, [selectedBond]);

  const tableRows = useMemo(() => {
    if (!selectedTable) return [];
    const members = Array.isArray(selectedTable.members) ? selectedTable.members : [];
    return members
      .map((member) => {
        const asteroid = asteroidById.get(String(member.id));
        return asteroid || { id: member.id, value: member.value || member.id, metadata: {} };
      })
      .sort((a, b) => valueToLabel(a.value).localeCompare(valueToLabel(b.value)));
  }, [selectedTable, asteroidById]);

  const gridColumns = useMemo(() => {
    const set = new Set(["value"]);
    if (selectedTable?.schema_fields) {
      selectedTable.schema_fields.forEach((field) => {
        if (!RESERVED_METADATA_KEYS.has(String(field))) {
          set.add(field);
        }
      });
    }
    tableRows.forEach((row) => {
      Object.keys(safeMetadata(row.metadata)).forEach((field) => {
        if (!RESERVED_METADATA_KEYS.has(String(field))) {
          set.add(field);
        }
      });
    });
    return [...set];
  }, [selectedTable, tableRows]);

  const getCellDraft = useCallback(
    (rowId, field, baseline) => {
      const key = `${rowId}::${field}`;
      if (Object.prototype.hasOwnProperty.call(gridDraft, key)) return gridDraft[key];
      return baseline;
    },
    [gridDraft]
  );

  const focusByTarget = useCallback(
    (targetRaw) => {
      const targetText = normalizeText(targetRaw);
      if (!targetText) return false;

      const foundAsteroid = snapshot.asteroids.find(
        (asteroid) => normalizeText(String(asteroid.id)) === targetText || normalizeText(valueToLabel(asteroid.value)) === targetText
      );
      if (foundAsteroid) {
        const table = resolveTableForAsteroid(tables, foundAsteroid.id);
        if (table) {
          const tableNode = tableNodes.find((node) => node.id === String(table.table_id));
          if (tableNode) {
            focusTable({ tableId: tableNode.id, cameraTarget: tableNode.position, cameraDistance: 180 });
          }
        }
        const asteroidNode = asteroidNodes.find((node) => node.id === String(foundAsteroid.id));
        if (asteroidNode) {
          focusAsteroid({ asteroidId: asteroidNode.id, cameraTarget: asteroidNode.position, cameraDistance: 56 });
        }
        return true;
      }

      const foundTable = tables.find((table) => {
        if (normalizeText(String(table.table_id)) === targetText) return true;
        if (normalizeText(table.name) === targetText) return true;
        const semantic = splitEntityAndPlanetName(table);
        return normalizeText(semantic.entityName) === targetText || normalizeText(semantic.planetName) === targetText;
      });
      if (foundTable) {
        const node = tableNodes.find((item) => item.id === String(foundTable.table_id));
        if (node) {
          focusTable({ tableId: node.id, cameraTarget: node.position, cameraDistance: 220 });
          return true;
        }
      }

      return false;
    },
    [asteroidNodes, focusAsteroid, focusTable, snapshot.asteroids, tableNodes, tables]
  );

  const executeParserCommand = useCallback(
    async (raw, { clearInput = false } = {}) => {
      const normalized = String(raw || "").trim();
      if (!normalized || busy) return false;
      if (historicalMode) {
        setError("Historicky mod je jen pro cteni.");
        return false;
      }

      setBusy(true);
      setError("");
      try {
        const response = await apiFetch(`${API_BASE}/parser/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildParserPayload(normalized, galaxy.id, activeBranchId)),
        });
        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response, "Parser failed");
          if (isOccConflictError(apiError)) {
            await loadUniverse();
            throw new Error(buildOccConflictMessage(apiError, "parser execute"));
          }
          throw apiError;
        }
        if (clearInput) {
          setQuery("");
        }
        await loadUniverse();
        return true;
      } catch (commandError) {
        setError(commandError.message || "Command failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [activeBranchId, busy, galaxy.id, historicalMode, loadUniverse]
  );

  const handleCreateBranch = useCallback(async () => {
    if (!galaxy?.id) return;
    const name = draftBranchName.trim();
    if (!name) {
      setError("Vypln nazev branch.");
      return;
    }
    setBranchBusy(true);
    setError("");
    try {
      const payload = { name, galaxy_id: galaxy.id };
      if (asOfIso) {
        payload.as_of = asOfIso;
      }
      const response = await apiFetch(`${API_BASE}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Branch create failed: ${response.status}`);
      }
      const created = await response.json();
      await loadBranches();
      setSelectedBranchId(String(created?.id || ""));
      setDraftBranchName(name);
      setImportInfo(`Branch vytvorena: ${created?.name || name}`);
      await loadUniverse();
    } catch (branchError) {
      setError(branchError.message || "Branch create failed");
    } finally {
      setBranchBusy(false);
    }
  }, [asOfIso, draftBranchName, galaxy?.id, loadBranches, loadUniverse]);

  const handlePromoteBranch = useCallback(async () => {
    if (!galaxy?.id || !activeBranchId) return;
    setBranchBusy(true);
    setError("");
    try {
      const response = await apiFetch(`${API_BASE}/branches/${activeBranchId}/promote?galaxy_id=${galaxy.id}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Branch promote failed: ${response.status}`);
      }
      const body = await response.json();
      setImportInfo(
        `Promote hotov: ${body?.branch?.name || activeBranchId} · events ${body?.promoted_events_count ?? 0}`
      );
      setSelectedBranchId("");
      await loadBranches();
      await loadUniverse();
    } catch (promoteError) {
      setError(promoteError.message || "Branch promote failed");
    } finally {
      setBranchBusy(false);
    }
  }, [activeBranchId, galaxy?.id, loadBranches, loadUniverse]);

  const loadImportErrors = useCallback(async (jobId) => {
    if (!jobId) {
      setImportErrors([]);
      return [];
    }
    const response = await apiFetch(buildImportJobErrorsUrl(API_BASE, jobId));
    if (!response.ok) {
      throw new Error(`Import errors failed: ${response.status}`);
    }
    const body = await response.json();
    const rows = Array.isArray(body?.errors) ? body.errors : [];
    setImportErrors(rows);
    return rows;
  }, []);

  const refreshImportJob = useCallback(async () => {
    if (!lastImportJob?.id) return;
    setImportBusy(true);
    setError("");
    try {
      const response = await apiFetch(buildImportJobUrl(API_BASE, lastImportJob.id));
      if (!response.ok) {
        throw new Error(`Import job refresh failed: ${response.status}`);
      }
      const body = await response.json();
      setLastImportJob(body);
      if (Number(body?.errors_count || 0) > 0) {
        await loadImportErrors(body.id);
      } else {
        setImportErrors([]);
      }
      setImportInfo(
        `Import ${body.mode} · ${body.status} · radky ${body.processed_rows}/${body.total_rows} · chyby ${body.errors_count}`
      );
    } catch (jobError) {
      setError(jobError.message || "Import job refresh failed");
    } finally {
      setImportBusy(false);
    }
  }, [lastImportJob, loadImportErrors]);

  const handleCsvImport = useCallback(async () => {
    if (historicalMode) {
      setError("Historicky mod je jen pro cteni.");
      return;
    }
    if (!galaxy?.id) {
      setError("Vyber aktivni galaxii.");
      return;
    }
    if (!importFile) {
      setError("Vyber CSV soubor pro import.");
      return;
    }
    const filename = String(importFile.name || "");
    if (!filename.toLowerCase().endsWith(".csv")) {
      setError("Import podporuje jen CSV soubor.");
      return;
    }

    setImportBusy(true);
    setError("");
    setImportInfo("");
    try {
      const formData = new FormData();
      formData.append("file", importFile, filename || "import.csv");
      formData.append("mode", importMode);
      formData.append("strict", importStrict ? "true" : "false");
      formData.append("galaxy_id", String(galaxy.id));
      if (activeBranchId) {
        formData.append("branch_id", String(activeBranchId));
      }

      const response = await apiFetch(buildImportRunUrl(API_BASE), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.status}`);
      }
      const body = await response.json();
      const job = body?.job || null;
      if (!job?.id) {
        throw new Error("Import failed: missing job payload");
      }
      setLastImportJob(job);
      if (Number(job.errors_count || 0) > 0) {
        await loadImportErrors(job.id);
      } else {
        setImportErrors([]);
      }
      setImportInfo(`Import ${job.mode} · ${job.status} · radky ${job.processed_rows}/${job.total_rows} · chyby ${job.errors_count}`);
      if (importMode === "commit" && String(job.status || "").toUpperCase() !== "FAILED") {
        await loadUniverse();
      }
    } catch (importError) {
      setError(importError.message || "Import failed");
    } finally {
      setImportBusy(false);
    }
  }, [activeBranchId, galaxy?.id, historicalMode, importFile, importMode, importStrict, loadImportErrors, loadUniverse]);

  const mutateAsteroid = useCallback(
    async (asteroidId, payload) => {
      const asteroid = snapshot.asteroids.find((item) => String(item?.id) === String(asteroidId));
      const expectedEventSeq =
        Number.isInteger(asteroid?.current_event_seq) && payload?.expected_event_seq === undefined
          ? asteroid.current_event_seq
          : payload?.expected_event_seq;
      const response = await apiFetch(`${API_BASE}/asteroids/${asteroidId}/mutate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(expectedEventSeq !== undefined ? { expected_event_seq: expectedEventSeq } : {}),
          galaxy_id: galaxy.id,
          branch_id: activeBranchId,
        }),
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Mutate failed");
        if (isOccConflictError(apiError)) {
          await loadUniverse();
          throw new Error(buildOccConflictMessage(apiError, "mutace bunky"));
        }
        throw apiError;
      }
      await loadUniverse();
    },
    [activeBranchId, galaxy.id, loadUniverse, snapshot.asteroids]
  );

  const extinguishAsteroid = useCallback(
    async (asteroidId) => {
      const asteroid = snapshot.asteroids.find((item) => String(item?.id) === String(asteroidId));
      const query = new URLSearchParams({ galaxy_id: String(galaxy.id) });
      if (activeBranchId) {
        query.set("branch_id", String(activeBranchId));
      }
      if (Number.isInteger(asteroid?.current_event_seq)) {
        query.set("expected_event_seq", String(asteroid.current_event_seq));
      }
      const response = await apiFetch(`${API_BASE}/asteroids/${asteroidId}/extinguish?${query.toString()}`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Extinguish failed");
        if (isOccConflictError(apiError)) {
          await loadUniverse();
          throw new Error(buildOccConflictMessage(apiError, "zhasnuti mesice"));
        }
        throw apiError;
      }
      await loadUniverse();
    },
    [activeBranchId, galaxy.id, loadUniverse, snapshot.asteroids]
  );

  const mutateBondType = useCallback(
    async (bondId, nextType) => {
      const bond = snapshot.bonds.find((item) => String(item?.id) === String(bondId));
      if (!bond) {
        throw new Error("Vazba uz neexistuje.");
      }
      const normalizedType = normalizeBondType(nextType);
      const response = await apiFetch(`${API_BASE}/bonds/${bondId}/mutate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: normalizedType,
          ...(Number.isInteger(bond?.current_event_seq) ? { expected_event_seq: bond.current_event_seq } : {}),
          galaxy_id: galaxy.id,
          branch_id: activeBranchId,
        }),
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Bond mutate failed");
        if (isOccConflictError(apiError)) {
          await loadUniverse();
          throw new Error(buildOccConflictMessage(apiError, "zmena typu vazby"));
        }
        throw apiError;
      }
      const body = await response.json();
      setSelectedBondId(String(body?.id || ""));
      await loadUniverse();
    },
    [activeBranchId, galaxy.id, loadUniverse, snapshot.bonds]
  );

  const extinguishBond = useCallback(
    async (bondId) => {
      const bond = snapshot.bonds.find((item) => String(item?.id) === String(bondId));
      if (!bond) {
        throw new Error("Vazba uz neexistuje.");
      }
      const query = new URLSearchParams({ galaxy_id: String(galaxy.id) });
      if (activeBranchId) {
        query.set("branch_id", String(activeBranchId));
      }
      if (Number.isInteger(bond?.current_event_seq)) {
        query.set("expected_event_seq", String(bond.current_event_seq));
      }
      const response = await apiFetch(`${API_BASE}/bonds/${bondId}/extinguish?${query.toString()}`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Bond extinguish failed");
        if (isOccConflictError(apiError)) {
          await loadUniverse();
          throw new Error(buildOccConflictMessage(apiError, "zhasnuti vazby"));
        }
        throw apiError;
      }
      setSelectedBondId("");
      await loadUniverse();
    },
    [activeBranchId, galaxy.id, loadUniverse, snapshot.bonds]
  );

  const handleCommand = useCallback(
    async (event) => {
      event.preventDefault();
      const raw = query.trim();
      if (!raw || busy) return;
      if (historicalMode) {
        setError("Historicky mod je jen pro cteni.");
        return;
      }

      const focusMatch = raw.match(/^(ukaz|ukaž|najdi)\s*:\s*(.+)$/i);
      if (focusMatch) {
        if (focusByTarget(focusMatch[2])) {
          setQuery("");
          return;
        }
        setError(`Nenalezeno: ${focusMatch[2]}`);
        return;
      }

      const success = await executeParserCommand(raw);
      if (success) {
        setQuery("");
      }
    },
    [busy, executeParserCommand, focusByTarget, historicalMode, query]
  );

  const handleLinkComplete = useCallback(
    async ({ sourceId, sourceKind, targetId, targetKind, relationType = "RELATION" }) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      if (sourceKind !== "asteroid" || targetKind !== "asteroid") return;
      if (historicalMode) {
        setError("Historicky mod je jen pro cteni.");
        return;
      }
      try {
        const normalizedType = normalizeBondType(relationType);
        const source = snapshot.asteroids.find((item) => String(item?.id) === String(sourceId));
        const target = snapshot.asteroids.find((item) => String(item?.id) === String(targetId));
        const response = await apiFetch(`${API_BASE}/bonds/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: sourceId,
            target_id: targetId,
            type: normalizedType,
            ...(Number.isInteger(source?.current_event_seq) ? { expected_source_event_seq: source.current_event_seq } : {}),
            ...(Number.isInteger(target?.current_event_seq) ? { expected_target_event_seq: target.current_event_seq } : {}),
            galaxy_id: galaxy.id,
            branch_id: activeBranchId,
          }),
        });
        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response, "Link failed");
          if (isOccConflictError(apiError)) {
            await loadUniverse();
            throw new Error(buildOccConflictMessage(apiError, "vytvoreni vazby"));
          }
          throw apiError;
        }
        const body = await response.json();
        if (body?.id) {
          setSelectedBondId(String(body.id));
        }
        await loadUniverse();
      } catch (linkError) {
        setError(linkError.message || "Link creation failed");
      }
    },
    [activeBranchId, galaxy.id, historicalMode, loadUniverse, snapshot.asteroids]
  );

  const handleQuickCreate = useCallback(async () => {
    const entity = draftEntityName.trim();
    const planet = draftPlanetName.trim();
    const moon = draftMoonLabel.trim();
    if (!entity || !planet || !moon) {
      setError("Pro zalozeni vypln Entitu, Hvezdu/Planetu a Mesic.");
      return;
    }

    const metadataParts = [`table: ${entity} > ${planet}`];
    const nextMetaKey = draftMetaKey.trim();
    if (nextMetaKey) {
      metadataParts.push(`${nextMetaKey}: ${draftMetaValue.trim() || "1"}`);
    }
    const command = `${moon} (${metadataParts.join(", ")})`;
    const success = await executeParserCommand(command, { clearInput: false });
    if (!success) return;
    setQuery(command);
    setDraftMoonLabel("");
    setDraftMetaKey("");
    setDraftMetaValue("");
  }, [draftEntityName, draftMetaKey, draftMetaValue, draftMoonLabel, draftPlanetName, executeParserCommand]);

  const handleQuickFocus = useCallback(() => {
    if (!quickFindTargetId) {
      setError("Vyber Mesic pro fokus.");
      return;
    }
    const found = focusByTarget(quickFindTargetId);
    if (!found) {
      setError("Fokus selhal: vybrany Mesic uz neexistuje.");
      return;
    }
    setQuery(`Ukaz : ${quickFindTargetId}`);
    setError("");
  }, [focusByTarget, quickFindTargetId]);

  const handleQuickLink = useCallback(async () => {
    if (!quickLinkSourceId || !quickLinkTargetId) {
      setError("Vyber zdrojovy i cilovy Mesic.");
      return;
    }
    if (quickLinkSourceId === quickLinkTargetId) {
      setError("Zdrojovy a cilovy Mesic musi byt rozdilne.");
      return;
    }
    await handleLinkComplete({
      sourceId: quickLinkSourceId,
      targetId: quickLinkTargetId,
      sourceKind: "asteroid",
      targetKind: "asteroid",
      relationType: quickLinkType,
    });
  }, [handleLinkComplete, quickLinkSourceId, quickLinkTargetId, quickLinkType]);

  const handleQuickFormula = useCallback(async () => {
    const field = quickFormulaField.trim();
    const sourceField = quickFormulaSourceField.trim();
    if (!quickFormulaTargetId || !field || !sourceField) {
      setError("Vyber Mesic, nazev pole a zdrojove pole pro vzorec.");
      return;
    }
    const command = `spocitej : ${quickFormulaTargetId}.${field} = ${quickFormulaFunction}(${sourceField})`;
    const success = await executeParserCommand(command, { clearInput: false });
    if (success) {
      setQuery(command);
    }
  }, [executeParserCommand, quickFormulaField, quickFormulaFunction, quickFormulaSourceField, quickFormulaTargetId]);

  const handleQuickGuardian = useCallback(async () => {
    const field = quickGuardianField.trim();
    const threshold = quickGuardianThreshold.trim();
    const actionName = quickGuardianAction.trim();
    if (!quickGuardianTargetId || !field || !threshold || !actionName) {
      setError("Vypln Mesic, pole, operator, limit a akci Guardianu.");
      return;
    }
    const command = `hlidej : ${quickGuardianTargetId}.${field} ${quickGuardianOperator} ${threshold} -> ${actionName}`;
    const success = await executeParserCommand(command, { clearInput: false });
    if (success) {
      setQuery(command);
    }
  }, [
    executeParserCommand,
    quickGuardianAction,
    quickGuardianField,
    quickGuardianOperator,
    quickGuardianTargetId,
    quickGuardianThreshold,
  ]);

  const handleQuickDelete = useCallback(async () => {
    if (!quickDeleteTargetId) {
      setError("Vyber Mesic k soft delete.");
      return;
    }
    const command = `zhasni : ${quickDeleteTargetId}`;
    const success = await executeParserCommand(command, { clearInput: false });
    if (success) {
      setQuery(command);
    }
  }, [executeParserCommand, quickDeleteTargetId]);

  const handleContextAction = useCallback(
    async (action, menu) => {
      closeContextMenu();
      if (!menu) return;

      if (action === "focus") {
        if (menu.kind === "table") {
          const table = tableNodes.find((node) => node.id === menu.id);
          if (table) {
            focusTable({ tableId: table.id, cameraTarget: table.position, cameraDistance: 190 });
          }
        } else {
          const asteroid = asteroidNodes.find((node) => node.id === menu.id);
          if (asteroid) {
            focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 54 });
          }
        }
        return;
      }

      if (action === "back") {
        backToTables();
        return;
      }

      if (action === "edit") {
        const asteroid = asteroidNodes.find((node) => node.id === menu.id);
        if (asteroid) {
          focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 54 });
          patchPanel("inspector", { collapsed: false });
        }
        return;
      }

      if (action === "extinguish" && menu.kind === "asteroid") {
        try {
          await extinguishAsteroid(menu.id);
        } catch (extinguishError) {
          setError(extinguishError.message || "Soft delete failed");
        }
      }
    },
    [asteroidNodes, backToTables, closeContextMenu, extinguishAsteroid, focusAsteroid, focusTable, patchPanel, tableNodes]
  );

  const breadcrumb = `L2 Souhvezdi/Entity${level >= 3 && selectedTable ? ` / ${selectedSemantic.entityName} / Planeta ${selectedSemantic.planetName}` : ""}${level >= 3 && selectedAsteroid ? ` / Mesic ${valueToLabel(selectedAsteroid.value)}` : ""}`;

  const minimizedPanels = Object.entries(panels)
    .filter(([, cfg]) => cfg.collapsed)
    .map(([id]) => id);
  const minimizedPanelItems = minimizedPanels
    .map((panelId) => ({
      id: panelId,
      title: panels[panelId]?.title || panelId,
    }))
    .filter((item) => Boolean(item.id));
  const importDisabled = importBusy || busy || branchBusy || historicalMode;

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}>
      <UniverseCanvas
        level={level}
        tableNodes={tableNodes}
        asteroidNodes={asteroidNodes}
        tableLinks={enrichedTableLinks}
        asteroidLinks={enrichedAsteroidLinks}
        cameraState={camera}
        selectedTableId={selectedTableId}
        selectedAsteroidId={selectedAsteroidId}
        linkDraft={linkDraft}
        onSelectTable={(tableId) => {
          const table = tableNodes.find((node) => node.id === tableId);
          if (table) {
            focusTable({ tableId: table.id, cameraTarget: table.position, cameraDistance: 210 });
          }
        }}
        onSelectAsteroid={(asteroidId) => {
          const asteroid = asteroidNodes.find((node) => node.id === asteroidId);
          if (asteroid) {
            focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 56 });
          }
        }}
        onOpenContext={openContextMenu}
        onLinkStart={startLinkDraft}
        onLinkMove={updateLinkDraft}
        onLinkComplete={handleLinkComplete}
        onLinkCancel={clearLinkDraft}
        onHoverLink={setHoveredLink}
        onLeaveLink={() => setHoveredLink(null)}
        onSelectLink={(link) => {
          const bondId = String(link?.id || "");
          if (!bondId) return;
          setSelectedBondId(bondId);
          patchPanel("inspector", { collapsed: false });
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 39,
          borderRadius: 999,
          border: "1px solid rgba(96, 189, 223, 0.42)",
          background: "rgba(5, 13, 24, 0.84)",
          color: "#d9f8ff",
          padding: "8px 13px",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 9,
          backdropFilter: "blur(7px)",
        }}
      >
        <strong>{galaxy?.name || "Galaxie"}</strong>
        <span style={{ opacity: 0.85 }}>{breadcrumb}</span>
        {historicalMode ? <span style={{ color: "#ffd9a4" }}>Historical</span> : null}
        {loading ? <span style={{ color: "#9de7ff" }}>Loading...</span> : null}
        {!historicalMode ? (
          <span
            style={{
              color: streamState === "LIVE" ? "#9affd7" : streamState === "RETRY" ? "#ffd58f" : "#9ec9ff",
            }}
          >
            Stream: {streamState}
          </span>
        ) : null}
        <span style={{ opacity: 0.82 }}>
          Workspace: <strong style={{ color: activeBranchId ? "#8affde" : "#d9f8ff" }}>{activeWorkspaceLabel}</strong>
        </span>
        <select
          value={selectedBranchId}
          onChange={(event) => setSelectedBranchId(event.target.value)}
          disabled={branchBusy || branchesLoading}
          style={{
            ...selectStyle,
            width: 180,
            fontSize: 11,
            padding: "4px 7px",
            borderRadius: 999,
          }}
        >
          <option value="">Main</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <span style={{ opacity: 0.8 }}>Model: {MODEL_PATH_LABEL}</span>
        <span style={{ opacity: 0.78 }}>
          Vazby:
          <span style={{ marginLeft: 5, color: "#58d2ff" }}>RELATION</span>
          <span style={{ marginLeft: 6, color: "#91a8ff" }}>TYPE</span>
          <span style={{ marginLeft: 6, color: "#84ffd1" }}>FLOW</span>
          <span style={{ marginLeft: 6, color: "#ffb15f" }}>GUARDIAN</span>
        </span>
        <span style={{ opacity: 0.78 }}>
          V1:
          <span style={{ marginLeft: 5, color: resolveStatusColor("GREEN") }}>GREEN</span>
          <span style={{ marginLeft: 6, color: resolveStatusColor("YELLOW") }}>YELLOW</span>
          <span style={{ marginLeft: 6, color: resolveStatusColor("RED") }}>RED</span>
        </span>
        <button type="button" onClick={backToTables} style={hudButtonStyle}>Souhvezdi</button>
        <button type="button" onClick={loadUniverse} style={hudButtonStyle}>Refresh</button>
        <button
          type="button"
          onClick={onBackToGalaxies}
          style={{ ...hudButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
        >
          Galaxie
        </button>
        <button
          type="button"
          onClick={onLogout}
          style={{ ...hudButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
        >
          Logout
        </button>
      </div>

      <FloatingPanel
        id="command"
        title={panels.command.title}
        config={panels.command}
        minimizedDockIndex={minimizedPanels.indexOf("command")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 7 }}>
          Akcni centrum: uzivatel muze vse zakladni provest primo tlacitky bez hadani syntaxe.
          Model nema samostatny objekt "hvezda" - hvezda/planeta vznikne pri zalozeni prvniho Mesice.
        </div>
        <form onSubmit={handleCommand} style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy || historicalMode}
            placeholder='Napr. "Kancelar : Praha", "Ukaz : Praha", "Spocitej : Sklad.zasoba = SUM(mnozstvi)"'
            style={inputStyle}
          />
          <button type="submit" disabled={busy || historicalMode} style={actionButtonStyle}>
            {busy ? "..." : "RUN"}
          </button>
        </form>
        <div style={{ marginTop: 8, display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            value={asOfInput}
            onChange={(event) => setAsOfInput(event.target.value)}
            style={{ ...inputStyle, maxWidth: 240 }}
          />
          <button type="button" onClick={() => setAsOfInput("")} style={ghostButtonStyle}>Live</button>
          <button type="button" onClick={() => patchPanel("grid", { collapsed: false })} style={ghostButtonStyle}>
            Otevrit tabulku
          </button>
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>BRANCH / STAGING WORKFLOW</div>
          <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.35 }}>
            Aktivni workspace: <strong>{activeWorkspaceLabel}</strong>. Main = produkcni timeline, branch = izolovana sandbox vrstva.
          </div>
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            disabled={branchBusy || branchesLoading}
            style={selectStyle}
          >
            <option value="">Main (live timeline)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6 }}>
            <input
              value={draftBranchName}
              onChange={(event) => setDraftBranchName(event.target.value)}
              placeholder="Nazev branch (napr. staging)"
              style={inputStyle}
              disabled={branchBusy}
            />
            <button type="button" onClick={handleCreateBranch} disabled={branchBusy || !draftBranchName.trim()} style={ghostButtonStyle}>
              {branchBusy ? "..." : "Create"}
            </button>
            <button type="button" onClick={loadBranches} disabled={branchBusy || branchesLoading} style={ghostButtonStyle}>
              Refresh
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handlePromoteBranch}
              disabled={branchBusy || historicalMode || !activeBranchId}
              style={{ ...actionButtonStyle, background: "linear-gradient(120deg, #4dd7b6, #8affde)" }}
            >
              Promote do main
            </button>
            {historicalMode ? <div style={{ fontSize: 11, opacity: 0.75 }}>Promote je v historical modu uzamcen.</div> : null}
          </div>
          {branchesLoading ? <div style={{ fontSize: 11, color: "#9de7ff" }}>Nacitam branche...</div> : null}
          {branchesError ? <div style={{ fontSize: 11, color: "#ffb7c9" }}>{branchesError}</div> : null}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>CSV IMPORT (PREVIEW / COMMIT)</div>
          <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.35 }}>
            1) Vyber CSV soubor. 2) Zvol preview (bez zapisu) nebo commit (zapis). 3) Strict urcuje stop na prvni chybe.
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setImportFile(event.target.files?.[0] || null)}
            disabled={importDisabled}
            style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value)}
              disabled={importDisabled}
              style={selectStyle}
            >
              <option value="preview">Preview (bez zapisu)</option>
              <option value="commit">Commit (zapsat data)</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.88 }}>
              <input
                type="checkbox"
                checked={importStrict}
                onChange={(event) => setImportStrict(event.target.checked)}
                disabled={importDisabled}
              />
              Strict
            </label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={handleCsvImport} disabled={importDisabled || !importFile} style={actionButtonStyle}>
              {importBusy ? "..." : "Spustit import"}
            </button>
            <button type="button" onClick={refreshImportJob} disabled={importBusy || !lastImportJob?.id} style={ghostButtonStyle}>
              Refresh job
            </button>
            <button
              type="button"
              onClick={() => {
                if (!lastImportJob?.id) return;
                loadImportErrors(lastImportJob.id).catch((importErrorsError) =>
                  setError(importErrorsError.message || "Import errors load failed")
                );
              }}
              disabled={importBusy || !lastImportJob?.id}
              style={ghostButtonStyle}
            >
              Nacist chyby
            </button>
          </div>
          {importFile ? (
            <div style={{ fontSize: 11, opacity: 0.82 }}>
              Soubor: <strong>{importFile.name}</strong>
            </div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.72 }}>Soubor zatim neni vybran.</div>
          )}
          {importInfo ? <div style={{ fontSize: 12, color: "#9de7ff" }}>{importInfo}</div> : null}
          {lastImportJob ? (
            <div style={{ fontSize: 11, opacity: 0.84 }}>
              Job {lastImportJob.id} · mode {lastImportJob.mode} · status {lastImportJob.status}
            </div>
          ) : null}
          {importErrors.length ? (
            <div style={{ display: "grid", gap: 4 }}>
              {importErrors.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: 11,
                    border: "1px solid rgba(255, 148, 176, 0.28)",
                    borderRadius: 8,
                    background: "rgba(42, 9, 19, 0.45)",
                    color: "#ffd4e0",
                    padding: "5px 7px",
                    lineHeight: 1.35,
                  }}
                >
                  Radek {item.row_number}: {item.message}
                </div>
              ))}
              {importErrors.length > 6 ? (
                <div style={{ fontSize: 11, opacity: 0.74 }}>Zobrazeno 6/{importErrors.length} chyb.</div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>KDE CO UDELAS (bez vahani)</div>
          {WORKSPACE_GUIDE.map((item, index) => (
            <div key={item} style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
              {index + 1}) {item}
            </div>
          ))}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>RYCHLE ZALOZENI (nova hvezda/planeta i mesic)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              value={draftEntityName}
              onChange={(event) => setDraftEntityName(event.target.value)}
              placeholder="Entita / Souhvezdi"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
            <input
              value={draftPlanetName}
              onChange={(event) => setDraftPlanetName(event.target.value)}
              placeholder="Hvezda / Planeta"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
          </div>
          <div style={{ marginTop: 6 }}>
            <input
              value={draftMoonLabel}
              onChange={(event) => setDraftMoonLabel(event.target.value)}
              placeholder="Mesic (nazev zaznamu)"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
          </div>
          <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              value={draftMetaKey}
              onChange={(event) => setDraftMetaKey(event.target.value)}
              placeholder="Pole (volitelne)"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
            <input
              value={draftMetaValue}
              onChange={(event) => setDraftMetaValue(event.target.value)}
              placeholder="Hodnota"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={handleQuickCreate} disabled={busy || historicalMode} style={actionButtonStyle}>
              Zalozit
            </button>
            <button
              type="button"
              onClick={() =>
                setQuery(
                  `${draftMoonLabel.trim() || "NovyMesic"} (table: ${draftEntityName.trim() || "Entita"} > ${
                    draftPlanetName.trim() || "Planeta"
                  })`
                )
              }
              style={ghostButtonStyle}
            >
              Vlozit prikaz
            </button>
          </div>
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>AKCE NAD EXISTUJICIM MESICEM</div>
          <div style={{ fontSize: 11, opacity: 0.78, marginBottom: 6 }}>
            Vyberas z aktivnich Mesicu; system vytvori presny prikaz sam.
          </div>

          <div style={{ display: "grid", gap: 5, marginBottom: 8 }}>
            <div style={miniTitleStyle}>Fokus na Mesic</div>
            <select value={quickFindTargetId} onChange={(event) => setQuickFindTargetId(event.target.value)} style={selectStyle}>
              <option value="">Vyber Mesic</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleQuickFocus} style={ghostButtonStyle}>
              Fokus
            </button>
          </div>

          <div style={{ display: "grid", gap: 5, marginBottom: 8 }}>
            <div style={miniTitleStyle}>Rychla vazba (RELATION / TYPE / FLOW / GUARDIAN)</div>
            <select value={quickLinkType} onChange={(event) => setQuickLinkType(event.target.value)} style={selectStyle}>
              {QUICK_LINK_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.direction})
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, opacity: 0.78 }}>{selectedQuickLinkTypeOption.description}</div>
            <select value={quickLinkSourceId} onChange={(event) => setQuickLinkSourceId(event.target.value)} style={selectStyle}>
              <option value="">Zdrojovy Mesic</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select value={quickLinkTargetId} onChange={(event) => setQuickLinkTargetId(event.target.value)} style={selectStyle}>
              <option value="">Cilovy Mesic</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleQuickLink} disabled={busy || historicalMode} style={ghostButtonStyle}>
              Vytvorit vazbu
            </button>
          </div>

          <div style={{ display: "grid", gap: 5, marginBottom: 8 }}>
            <div style={miniTitleStyle}>Formula (SET_FORMULA)</div>
            <select value={quickFormulaTargetId} onChange={(event) => setQuickFormulaTargetId(event.target.value)} style={selectStyle}>
              <option value="">Mesic pro vzorec</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6 }}>
              <input
                value={quickFormulaField}
                onChange={(event) => setQuickFormulaField(event.target.value)}
                placeholder="cilove pole"
                style={inputStyle}
                disabled={busy || historicalMode}
              />
              <select
                value={quickFormulaFunction}
                onChange={(event) => setQuickFormulaFunction(event.target.value)}
                style={{ ...selectStyle, minWidth: 86 }}
              >
                <option value="SUM">SUM</option>
                <option value="AVG">AVG</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
                <option value="COUNT">COUNT</option>
              </select>
              <input
                value={quickFormulaSourceField}
                onChange={(event) => setQuickFormulaSourceField(event.target.value)}
                placeholder="zdrojove pole"
                style={inputStyle}
                disabled={busy || historicalMode}
              />
            </div>
            <button type="button" onClick={handleQuickFormula} disabled={busy || historicalMode} style={ghostButtonStyle}>
              Nastavit formuli
            </button>
          </div>

          <div style={{ display: "grid", gap: 5, marginBottom: 8 }}>
            <div style={miniTitleStyle}>Guardian (ADD_GUARDIAN)</div>
            <select value={quickGuardianTargetId} onChange={(event) => setQuickGuardianTargetId(event.target.value)} style={selectStyle}>
              <option value="">Mesic pro guardian</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr", gap: 6 }}>
              <input
                value={quickGuardianField}
                onChange={(event) => setQuickGuardianField(event.target.value)}
                placeholder="pole"
                style={inputStyle}
                disabled={busy || historicalMode}
              />
              <select
                value={quickGuardianOperator}
                onChange={(event) => setQuickGuardianOperator(event.target.value)}
                style={{ ...selectStyle, minWidth: 74 }}
              >
                <option value=">">{">"}</option>
                <option value=">=">{">="}</option>
                <option value="<">{"<"}</option>
                <option value="<=">{"<="}</option>
                <option value="==">{"=="}</option>
              </select>
              <input
                value={quickGuardianThreshold}
                onChange={(event) => setQuickGuardianThreshold(event.target.value)}
                placeholder="limit"
                style={inputStyle}
                disabled={busy || historicalMode}
              />
              <input
                value={quickGuardianAction}
                onChange={(event) => setQuickGuardianAction(event.target.value)}
                placeholder="akce"
                style={inputStyle}
                disabled={busy || historicalMode}
              />
            </div>
            <button type="button" onClick={handleQuickGuardian} disabled={busy || historicalMode} style={ghostButtonStyle}>
              Pridat guardian
            </button>
          </div>

          <div style={{ display: "grid", gap: 5 }}>
            <div style={miniTitleStyle}>Soft Delete (DELETE/EXTINGUISH)</div>
            <select value={quickDeleteTargetId} onChange={(event) => setQuickDeleteTargetId(event.target.value)} style={selectStyle}>
              <option value="">Mesic ke zhasnuti</option>
              {moonQuickOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleQuickDelete}
              disabled={busy || historicalMode}
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 136, 166, 0.4)", color: "#ffc6d8" }}
            >
              Zhasnout mesic
            </button>
          </div>
        </div>
        {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#ffb7c9" }}>{error}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="constellations"
        title={panels.constellations.title}
        config={panels.constellations}
        minimizedDockIndex={minimizedPanels.indexOf("constellations")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 8 }}>
          L2 vrstva: Souhvezdi/Entity s agregovanou kvalitou dat.
        </div>
        {constellationsLoading ? <div style={{ fontSize: 12, color: "#9de6ff" }}>Nacitam souhvezdi...</div> : null}
        {!constellationsLoading && !constellations.length ? (
          <div style={{ fontSize: 12, opacity: 0.78 }}>Zatim nejsou dostupna data souhvezdi.</div>
        ) : null}
        {!constellationsLoading && constellations.length ? (
          <div style={{ display: "grid", gap: 7 }}>
            {constellations.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    const table = tables.find((candidate) => {
                      const semantic = splitEntityAndPlanetName(candidate);
                      return normalizeText(semantic.entityName) === normalizeText(item.name);
                    });
                    if (!table) return;
                    const node = tableNodes.find((candidate) => candidate.id === String(table.table_id));
                    if (!node) return;
                    focusTable({ tableId: node.id, cameraTarget: node.position, cameraDistance: 220 });
                  }}
                  style={{
                    border: "1px solid rgba(102, 196, 227, 0.28)",
                    borderRadius: 8,
                    background: "rgba(6, 16, 30, 0.72)",
                    color: "#d8f6ff",
                    padding: "7px 8px",
                    textAlign: "left",
                    display: "grid",
                    gap: 3,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Planety {item.planets_count} · Mesice {item.moons_count} · Vazby {item.internal_bonds_count + item.external_bonds_count}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.quality_score}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {constellationsError ? <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3c7" }}>{constellationsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="planets"
        title={panels.planets.title}
        config={panels.planets}
        minimizedDockIndex={minimizedPanels.indexOf("planets")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 8 }}>
          L3 vrstva: Planety (tabulky) s V1 metrikami a kvalitou.
        </div>
        {planetsLoading ? <div style={{ fontSize: 12, color: "#9de6ff" }}>Nacitam planety...</div> : null}
        {!planetsLoading && !planets.length ? (
          <div style={{ fontSize: 12, opacity: 0.78 }}>Zatim nejsou dostupna data planet.</div>
        ) : null}
        {!planetsLoading && planets.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {planets.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const tableNode = tableNodes.find((candidate) => candidate.id === String(item.table_id));
              return (
                <button
                  key={`${item.table_id}`}
                  type="button"
                  onClick={() => {
                    if (!tableNode) return;
                    focusTable({ tableId: tableNode.id, cameraTarget: tableNode.position, cameraDistance: 205 });
                  }}
                  style={{
                    border: "1px solid rgba(102, 196, 227, 0.28)",
                    borderRadius: 8,
                    background: "rgba(6, 16, 30, 0.72)",
                    color: "#d8f6ff",
                    padding: "7px 8px",
                    textAlign: "left",
                    display: "grid",
                    gap: 3,
                    cursor: tableNode ? "pointer" : "default",
                    opacity: tableNode ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    {item.constellation_name} · Mesice {item.moons_count} · Schema {item.schema_fields_count}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Formula {item.formula_fields_count} · Vazby {item.internal_bonds_count + item.external_bonds_count} · Rezim {item.sector_mode}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.quality_score}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {planetsError ? <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3c7" }}>{planetsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="moons"
        title={panels.moons.title}
        config={panels.moons}
        minimizedDockIndex={minimizedPanels.indexOf("moons")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 8 }}>
          L4 vrstva: Mesice (radky) s V1 kvalitou dat.
        </div>
        {moonsLoading ? <div style={{ fontSize: 12, color: "#9de6ff" }}>Nacitam mesice...</div> : null}
        {!moonsLoading && !moons.length ? (
          <div style={{ fontSize: 12, opacity: 0.78 }}>Zatim nejsou dostupna data mesicu.</div>
        ) : null}
        {!moonsLoading && moons.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {moons.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const tableNode = tableNodes.find((candidate) => candidate.id === String(item.table_id));
              const moonNode = asteroidNodes.find((candidate) => candidate.id === String(item.asteroid_id));
              return (
                <button
                  key={`${item.asteroid_id}`}
                  type="button"
                  onClick={() => {
                    if (tableNode) {
                      focusTable({ tableId: tableNode.id, cameraTarget: tableNode.position, cameraDistance: 198 });
                    }
                    if (moonNode) {
                      focusAsteroid({ asteroidId: moonNode.id, cameraTarget: moonNode.position, cameraDistance: 56 });
                    }
                  }}
                  style={{
                    border: "1px solid rgba(102, 196, 227, 0.28)",
                    borderRadius: 8,
                    background: "rgba(6, 16, 30, 0.72)",
                    color: "#d8f6ff",
                    padding: "7px 8px",
                    textAlign: "left",
                    display: "grid",
                    gap: 3,
                    cursor: moonNode ? "pointer" : "default",
                    opacity: moonNode ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label || "Mesic"}</div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    {item.constellation_name} / {item.planet_name}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Metadata {item.metadata_fields_count} · Formula {item.calculated_fields_count} · Alerty {item.active_alerts_count}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.quality_score}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {moonsError ? <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3c7" }}>{moonsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="bonds"
        title={panels.bonds.title}
        config={panels.bonds}
        minimizedDockIndex={minimizedPanels.indexOf("bonds")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 8 }}>
          Datovy tok mezi uzly. V1 kvalita je pocitana z alertu/cyklickych poli na koncovych mesicich.
        </div>
        {bondsV1Loading ? <div style={{ fontSize: 12, color: "#9de6ff" }}>Nacitam vazby...</div> : null}
        {!bondsV1Loading && !bondsV1.length ? (
          <div style={{ fontSize: 12, opacity: 0.78 }}>Zatim nejsou dostupne vazby.</div>
        ) : null}
        {!bondsV1Loading && bondsV1.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {bondsV1.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const sourceNode = asteroidNodes.find((candidate) => candidate.id === String(item.source_id));
              const targetNode = asteroidNodes.find((candidate) => candidate.id === String(item.target_id));
              return (
                <button
                  key={`${item.bond_id}`}
                  type="button"
                  onClick={() => {
                    setSelectedBondId(String(item.bond_id));
                    patchPanel("inspector", { collapsed: false });
                    if (sourceNode) {
                      focusAsteroid({ asteroidId: sourceNode.id, cameraTarget: sourceNode.position, cameraDistance: 58 });
                    } else if (targetNode) {
                      focusAsteroid({ asteroidId: targetNode.id, cameraTarget: targetNode.position, cameraDistance: 58 });
                    }
                  }}
                  style={{
                    border: "1px solid rgba(102, 196, 227, 0.28)",
                    borderRadius: 8,
                    background: "rgba(6, 16, 30, 0.72)",
                    color: "#d8f6ff",
                    padding: "7px 8px",
                    textAlign: "left",
                    display: "grid",
                    gap: 3,
                    cursor: sourceNode || targetNode ? "pointer" : "default",
                    opacity: sourceNode || targetNode ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {item.type} · {item.directional ? "A→B" : "A↔B"}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    {item.source_label} → {item.target_label}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Alerty {item.active_alerts_count} · Cykly {item.circular_fields_count}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.quality_score}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {bondsV1Error ? <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3c7" }}>{bondsV1Error}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="inspector"
        title={panels.inspector.title}
        config={panels.inspector}
        minimizedDockIndex={minimizedPanels.indexOf("inspector")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        {selectedAsteroid ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.74 }}>MESIC / ZAZNAM</div>
              <div style={{ marginTop: 3, fontSize: 17, fontWeight: 700 }}>{valueToLabel(selectedAsteroid.value)}</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>{String(selectedAsteroid.id)}</div>
              {selectedMoonV1 ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                  V1:{" "}
                  <strong style={{ color: resolveStatusColor(selectedMoonV1.status) }}>
                    {selectedMoonV1.status}
                  </strong>{" "}
                  ({selectedMoonV1.quality_score}/100) · Alerty {selectedMoonV1.active_alerts_count}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, opacity: 0.68 }}>Bunky tezby (nerosty / suroviny)</div>
              {Object.entries(safeMetadata(selectedAsteroid.metadata))
                .filter(([key]) => !RESERVED_METADATA_KEYS.has(String(key)))
                .map(([key, value]) => (
                <label key={key} style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{key}</span>
                  <input
                    defaultValue={valueToLabel(value)}
                    onBlur={(event) => {
                      if (historicalMode) return;
                      const nextValue = event.target.value;
                      mutateAsteroid(selectedAsteroid.id, { metadata: { [key]: nextValue } }).catch((mutError) =>
                        setError(mutError.message || "Mutate failed")
                      );
                    }}
                    disabled={historicalMode}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
              <input
                value={createFieldKey}
                onChange={(event) => setCreateFieldKey(event.target.value)}
                placeholder="nazev suroviny"
                style={inputStyle}
              />
              <input
                value={createFieldValue}
                onChange={(event) => setCreateFieldValue(event.target.value)}
                placeholder="vytazena hodnota"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={historicalMode || !createFieldKey.trim() || RESERVED_METADATA_KEYS.has(createFieldKey.trim())}
                onClick={() => {
                  if (RESERVED_METADATA_KEYS.has(createFieldKey.trim())) return;
                  mutateAsteroid(selectedAsteroid.id, { metadata: { [createFieldKey.trim()]: createFieldValue } })
                    .then(() => {
                      setCreateFieldKey("");
                      setCreateFieldValue("");
                    })
                    .catch((mutError) => setError(mutError.message || "Mutate failed"));
                }}
                style={ghostButtonStyle}
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={historicalMode}
              onClick={() => extinguishAsteroid(selectedAsteroid.id).catch((extError) => setError(extError.message || "Soft delete failed"))}
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 136, 166, 0.4)", color: "#ffc6d8" }}
            >
              Zhasnout mesic (Soft Delete)
            </button>
          </div>
        ) : selectedBond ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.74 }}>VAZBA / TOK</div>
              <div style={{ marginTop: 3, fontSize: 16, fontWeight: 700 }}>
                {selectedBond.type} · {selectedBond.directional ? "A→B" : "A↔B"}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>{String(selectedBond.id)}</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.84 }}>
                {selectedBond.source_id} → {selectedBond.target_id}
              </div>
              {selectedBondV1 ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                  V1:{" "}
                  <strong style={{ color: resolveStatusColor(selectedBondV1.status) }}>
                    {selectedBondV1.status}
                  </strong>{" "}
                  ({selectedBondV1.quality_score}/100)
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, opacity: 0.68 }}>Typ vazby</div>
              <select
                value={bondEditorType}
                onChange={(event) => setBondEditorType(event.target.value)}
                disabled={historicalMode}
                style={selectStyle}
              >
                {QUICK_LINK_TYPE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.direction})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, opacity: 0.78 }}>
                {(QUICK_LINK_TYPE_OPTIONS.find((item) => item.value === bondEditorType) || QUICK_LINK_TYPE_OPTIONS[0]).description}
              </div>
            </div>

            <button
              type="button"
              disabled={historicalMode}
              onClick={() =>
                mutateBondType(selectedBond.id, bondEditorType).catch((mutError) =>
                  setError(mutError.message || "Bond mutate failed")
                )
              }
              style={ghostButtonStyle}
            >
              Ulozit typ vazby
            </button>

            <button
              type="button"
              disabled={historicalMode}
              onClick={() =>
                extinguishBond(selectedBond.id).catch((extError) =>
                  setError(extError.message || "Bond soft delete failed")
                )
              }
              style={{ ...ghostButtonStyle, borderColor: "rgba(255, 136, 166, 0.4)", color: "#ffc6d8" }}
            >
              Zhasnout vazbu (Soft Delete)
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.78 }}>
            Klikni na mesic nebo vazbu. Inspector zobrazi editor detailu objektu.
          </div>
        )}
      </FloatingPanel>

      <FloatingPanel
        id="grid"
        title={panels.grid.title}
        config={panels.grid}
        minimizedDockIndex={minimizedPanels.indexOf("grid")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 8 }}>
          LEVEL 3 / TABULKA: souhvezdi = entita, radky = mesice, bunky = nerosty/suroviny.
        </div>
        <div style={{ overflow: "auto", border: "1px solid rgba(96, 186, 220, 0.18)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
            <thead>
              <tr>
                {gridColumns.map((column) => (
                  <th
                    key={column}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(8, 16, 28, 0.95)",
                      color: "#cbeef8",
                      borderBottom: "1px solid rgba(95, 177, 207, 0.2)",
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: 11,
                    }}
                  >
                    {column === "value" ? "mesic" : column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.id}>
                  {gridColumns.map((column) => {
                    const baseline = column === "value" ? valueToLabel(row.value) : valueToLabel(safeMetadata(row.metadata)[column] ?? "");
                    const currentValue = getCellDraft(row.id, column, baseline);
                    return (
                      <td key={`${row.id}:${column}`} style={{ borderBottom: "1px solid rgba(95, 177, 207, 0.12)", padding: "5px 7px" }}>
                        <input
                          value={currentValue}
                          onFocus={() => {
                            const table = resolveTableForAsteroid(tables, row.id);
                            if (table) {
                              const tableNode = tableNodes.find((item) => item.id === String(table.table_id));
                              if (tableNode) {
                                focusTable({ tableId: tableNode.id, cameraTarget: tableNode.position, cameraDistance: 186 });
                              }
                            }
                            const asteroid = asteroidNodes.find((item) => item.id === String(row.id));
                            if (asteroid) {
                              focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 52 });
                            }
                          }}
                          onChange={(event) => {
                            const key = `${row.id}::${column}`;
                            setGridDraft((prev) => ({ ...prev, [key]: event.target.value }));
                          }}
                          onBlur={(event) => {
                            if (historicalMode) return;
                            const nextValue = event.target.value;
                            if (nextValue === baseline) {
                              const key = `${row.id}::${column}`;
                              setGridDraft((prev) => {
                                const copy = { ...prev };
                                delete copy[key];
                                return copy;
                              });
                              return;
                            }
                            const payload = column === "value" ? { value: nextValue } : { metadata: { [column]: nextValue } };
                            mutateAsteroid(row.id, payload).catch((mutError) => setError(mutError.message || "Mutate failed"));
                          }}
                          disabled={historicalMode}
                          style={inputStyle}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FloatingPanel>

      {minimizedPanelItems.length ? (
        <aside
          style={{
            position: "fixed",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 64,
            display: "grid",
            gap: 8,
            padding: 8,
            borderRadius: 12,
            border: "1px solid rgba(101, 194, 226, 0.34)",
            background: "rgba(5, 14, 25, 0.9)",
            boxShadow: "0 0 20px rgba(46, 162, 211, 0.18)",
            backdropFilter: "blur(8px)",
            maxWidth: 220,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 0.6, opacity: 0.84, color: "#d8f6ff" }}>PANELOVY DOCK</div>
          {minimizedPanelItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => patchPanel(item.id, { collapsed: false })}
              style={{
                width: "100%",
                border: "1px solid rgba(108, 208, 241, 0.36)",
                borderRadius: 9,
                background: "rgba(8, 19, 33, 0.92)",
                color: "#e2f9ff",
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {item.title}
            </button>
          ))}
        </aside>
      ) : null}

      <ContextMenu menu={contextMenu} onClose={closeContextMenu} onAction={handleContextAction} />

      {hoveredLink ? (
        <div
          style={{
            position: "fixed",
            left: (hoveredLink.x || 18) + 12,
            top: (hoveredLink.y || 18) + 12,
            zIndex: 47,
            pointerEvents: "none",
            borderRadius: 10,
            border: "1px solid rgba(112, 214, 246, 0.42)",
            background: "rgba(6, 14, 26, 0.92)",
            color: "#dcf8ff",
            fontSize: 12,
            lineHeight: 1.35,
            padding: "7px 9px",
            maxWidth: 320,
            boxShadow: "0 0 18px rgba(72, 198, 255, 0.18)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ fontWeight: 700 }}>{hoveredLink.type}</div>
          <div style={{ marginTop: 2 }}>
            {hoveredLink.sourceConstellation}/{hoveredLink.sourcePlanet} -&gt; {hoveredLink.targetConstellation}/{hoveredLink.targetPlanet}
          </div>
          <div style={{ marginTop: 2, opacity: 0.8 }}>
            Uzly: {hoveredLink.sourceLabel} -&gt; {hoveredLink.targetLabel}
          </div>
          <div style={{ marginTop: 2, opacity: 0.86 }}>
            Směr: {hoveredLink.directional ? "jednosměrný" : "obousměrný"}
          </div>
          <div style={{ marginTop: 2, opacity: 0.8 }}>Síla vazby: {hoveredLink.weight}</div>
          {hoveredLink.v1Status ? (
            <div style={{ marginTop: 2, opacity: 0.9 }}>
              V1:{" "}
              <strong style={{ color: resolveStatusColor(hoveredLink.v1Status) }}>
                {hoveredLink.v1Status}
              </strong>{" "}
              ({hoveredLink.v1Quality}/100)
            </div>
          ) : null}
          {Number.isFinite(hoveredLink.physicsStress) ? (
            <div style={{ marginTop: 2, opacity: 0.82 }}>
              Fyzika: stres {Math.round(hoveredLink.physicsStress * 100)}% · tok {Math.round((hoveredLink.physicsFlow || 0) * 100)}%
            </div>
          ) : null}
          <div style={{ marginTop: 2, opacity: 0.78 }}>{hoveredLink.description}</div>
        </div>
      ) : null}
    </main>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(112, 205, 238, 0.24)",
  background: "rgba(4, 10, 18, 0.92)",
  color: "#ddf7ff",
  padding: "7px 9px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const actionButtonStyle = {
  border: "1px solid rgba(114, 219, 252, 0.5)",
  background: "linear-gradient(120deg, #21bbea, #44d8ff)",
  color: "#072737",
  borderRadius: 9,
  padding: "8px 10px",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const guideSectionStyle = {
  marginTop: 10,
  border: "1px solid rgba(97, 186, 216, 0.28)",
  borderRadius: 10,
  background: "rgba(5, 14, 25, 0.6)",
  padding: 8,
  display: "grid",
  gap: 5,
};

const guideTitleStyle = {
  fontSize: 11,
  letterSpacing: 0.65,
  fontWeight: 700,
  color: "#bdefff",
};

const miniTitleStyle = {
  fontSize: 11,
  letterSpacing: 0.35,
  opacity: 0.82,
  fontWeight: 700,
};

const selectStyle = {
  ...inputStyle,
  padding: "6px 8px",
  appearance: "none",
};

const hudButtonStyle = {
  border: "1px solid rgba(109, 198, 228, 0.3)",
  background: "rgba(7, 16, 29, 0.85)",
  color: "#d7f7ff",
  borderRadius: 999,
  fontSize: 11,
  padding: "5px 9px",
  cursor: "pointer",
};
