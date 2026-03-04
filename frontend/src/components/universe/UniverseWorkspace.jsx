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
  buildTableContractUrl,
  buildTaskBatchPayload,
  buildSnapshotUrl,
  buildTablesUrl,
  isOccConflictError,
  normalizeBondType,
  normalizeSnapshot,
  toAsOfIso,
} from "../../lib/dataverseApi";
import { WORKSPACE_GUIDE } from "../../lib/onboarding";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import { buildHierarchyTree, normalizeEdgeSemanticType } from "../../lib/universe_viewmodel";
import { toMoonRowContract } from "../../lib/universe_contract";
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

function normalizeParserCommandInput(rawCommand) {
  const command = String(rawCommand || "").trim();
  const assignMatch = command.match(/^(.+?)\s*(?::=|=)\s*(.+)$/);
  if (!assignMatch) {
    return { command, rewritten: false };
  }

  const left = String(assignMatch[1] || "").trim();
  const right = String(assignMatch[2] || "").trim();
  if (!left || !right) {
    return { command, rewritten: false };
  }

  const hasField = left.includes(".");
  if (hasField) {
    return { command, rewritten: false };
  }
  if (left.includes("->") || left.includes("+") || left.includes(":") || left.startsWith("-")) {
    return { command, rewritten: false };
  }
  const verbPrefix = normalizeText(left).split(/\s+/g)[0];
  if (["ukaz", "najdi", "show", "find", "spocitej", "hlidej", "zhasni", "spoj"].includes(verbPrefix)) {
    return { command, rewritten: false };
  }

  return {
    command: `${left}.value := ${right}`,
    rewritten: true,
  };
}

function buildParserErrorMessage(error, originalCommand, executedCommand) {
  const fallback = error?.message || "Parser failed";
  const message = String(fallback || "").trim();
  if (!message.toLowerCase().includes("parse error")) {
    return message || "Parser failed";
  }

  const rawDetail = message.replace(/^parse error:\s*/i, "").trim();
  if (/assignment target must be in entity\.field format/i.test(rawDetail)) {
    const leftRaw = String(originalCommand || "").split(/:=|=/)[0]?.trim() || "Mesic";
    const left = leftRaw.includes(".") ? leftRaw.split(".")[0] : leftRaw;
    return `Neplatny zapis. Pouzij 'A.pole := hodnota' (napr. '${left}.role := oddeleni vyroba') nebo klasifikaci '${left} : oddeleni vyroba'.`;
  }
  if (/expected expression operand/i.test(rawDetail)) {
    return "Nedokonceny prikaz. Zkus cely tvar, napr. 'A + B', 'A : Typ' nebo 'A.pole := hodnota'.";
  }
  if (/missing closing '\)'/i.test(rawDetail)) {
    return "Chybi uzaviraci zavorka. Oprav prikaz a opakuj.";
  }

  if (executedCommand && executedCommand !== originalCommand) {
    return `Parse error: ${rawDetail}. Pozn.: prikaz byl interpretovan jako '${executedCommand}'.`;
  }
  return `Parse error: ${rawDetail}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function resolveCameraTarget(cameraState) {
  if (Array.isArray(cameraState?.target) && cameraState.target.length === 3) {
    const [x, y, z] = cameraState.target;
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return [x, y, z];
    }
  }
  return [0, 0, 0];
}

function resolveCameraDistance(cameraState, fallback = 96) {
  const position = Array.isArray(cameraState?.position) ? cameraState.position : null;
  const target = Array.isArray(cameraState?.target) ? cameraState.target : null;
  if (!position || !target || position.length !== 3 || target.length !== 3) return fallback;
  const dx = Number(position[0]) - Number(target[0]);
  const dy = Number(position[1]) - Number(target[1]);
  const dz = Number(position[2]) - Number(target[2]);
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number.isFinite(distance) && distance > 0 ? distance : fallback;
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

function buildHierarchyGraphInputs(tables, snapshot) {
  const safeTables = Array.isArray(tables) ? tables : [];
  const safeAsteroids = Array.isArray(snapshot?.asteroids) ? snapshot.asteroids : [];
  const safeBonds = Array.isArray(snapshot?.bonds) ? snapshot.bonds : [];

  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeKeys = new Set();
  const duplicateEdgeKeysWarned = new Set();

  const addNode = (node) => {
    const id = String(node?.id || "").trim();
    if (!id || nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push(node);
  };

  const addEdge = (edge) => {
    const sourceId = String(edge?.source_id || edge?.source || "").trim();
    const targetId = String(edge?.target_id || edge?.target || "").trim();
    const rawType = String(edge?.edge_type || edge?.type || "").trim();
    const normalizedType = normalizeEdgeSemanticType(rawType);
    const dedupeType = normalizedType === "UNKNOWN" ? rawType.toUpperCase() : normalizedType;
    if (!sourceId || !targetId) return;
    const key = `${dedupeType}:${sourceId}:${targetId}`;
    if (edgeKeys.has(key)) {
      if (!duplicateEdgeKeysWarned.has(key)) {
        duplicateEdgeKeysWarned.add(key);
        console.warn("[hierarchy] duplicate edge skipped", { key, edge });
      }
      return;
    }
    edgeKeys.add(key);
    edges.push(edge);
  };

  safeTables.forEach((table) => {
    const tableId = String(table?.table_id || table?.id || "").trim();
    if (!tableId) return;
    addNode({
      id: tableId,
      semantic_type: "PLANET",
      label: String(table?.planet_name || table?.name || tableId),
      ...table,
    });
  });

  safeAsteroids.forEach((asteroid) => {
    const asteroidId = String(asteroid?.id || "").trim();
    if (!asteroidId) return;
    addNode({
      id: asteroidId,
      semantic_type: "MOON",
      label: valueToLabel(asteroid?.value) || asteroidId,
      ...asteroid,
    });
    const tableId = String(asteroid?.table_id || "").trim();
    if (tableId) {
      addEdge({
        id: `inst:${asteroidId}:${tableId}`,
        edge_type: "INSTANCE_OF",
        source_id: asteroidId,
        target_id: tableId,
      });
    }
  });

  safeTables.forEach((table) => {
    const tableId = String(table?.table_id || table?.id || "").trim();
    if (!tableId) return;
    const members = Array.isArray(table?.members) ? table.members : [];
    members.forEach((member) => {
      const moonId = String(member?.id || "").trim();
      if (!moonId) return;
      addNode({
        id: moonId,
        semantic_type: "MOON",
        label: valueToLabel(member?.value) || moonId,
        ...member,
      });
      addEdge({
        id: `inst:${moonId}:${tableId}`,
        edge_type: "INSTANCE_OF",
        source_id: moonId,
        target_id: tableId,
      });
    });
  });

  safeBonds.forEach((bond) => {
    addEdge({
      id: String(bond?.id || ""),
      edge_type: String(bond?.type || "RELATION"),
      source_id: String(bond?.source_id || ""),
      target_id: String(bond?.target_id || ""),
      ...bond,
    });
  });

  return { nodes, edges };
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
    label: "Vztah",
    direction: "A ↔ B",
    description: "Obecne propojeni bez smeru. A+B je stejne jako B+A.",
  },
  {
    value: "TYPE",
    label: "Typ",
    direction: "A → B",
    description: "A patri pod typ B (zarazeni nebo klasifikace).",
  },
  {
    value: "FLOW",
    label: "Tok dat",
    direction: "A → B",
    description: "Data tecou ze zdroje A do cile B.",
  },
  {
    value: "GUARDIAN",
    label: "Kontrola",
    direction: "A → B",
    description: "A hlida nebo spousti kontrolu nad B.",
  },
];

const PARSER_OPERATOR_GUIDE = [
  {
    key: "relation",
    syntax: "A + B",
    meaning: "RELATION: obecna vazba mezi uzly (obousmerna canonical).",
    example: "Pavel + Audi",
  },
  {
    key: "type",
    syntax: "A : B",
    meaning: "TYPE: zarazeni A pod typ/tridu B.",
    example: "Sroub : SpotrebniMaterial",
  },
  {
    key: "assign",
    syntax: "Entity.field := hodnota",
    meaning: "ASSIGN: zapis bunky/metadat do cile.",
    example: "Projekt.cena := 12500",
  },
  {
    key: "flow",
    syntax: "A -> B",
    meaning: "FLOW: datovy/signalovy tok source -> target.",
    example: "Objednavka -> Faktura",
  },
  {
    key: "extinguish",
    syntax: "- A",
    meaning: "EXTINGUISH: soft delete zamer (zadny hard delete).",
    example: "- StarySroub",
  },
  {
    key: "group",
    syntax: "(A, B) : Typ",
    meaning: "GROUP: bulk operand (aplikace vazby na vice uzlu).",
    example: "(Pavel, Jana) : Zamestnanec",
  },
];

const PARSER_LEGACY_GUIDE = [
  {
    key: "show",
    syntax: "Ukaz : Target @ podminka",
    meaning: "SELECT pres resolver (ukaz/najdi/show/find).",
    example: "Ukaz : Zakaznici @ Praha",
  },
  {
    key: "spoj",
    syntax: "Spoj : A, B, C",
    meaning: "Rychly relation chain (A-B, B-C).",
    example: "Spoj : Sklad, Dodavatel, Fakturace",
  },
  {
    key: "formula",
    syntax: "Spocitej : T.field = SUM(src)",
    meaning: "SET_FORMULA nad cilem.",
    example: "Spocitej : Projekt.celkem = SUM(cena)",
  },
  {
    key: "guardian",
    syntax: "Hlidej : T.field > X -> action",
    meaning: "ADD_GUARDIAN pravidlo.",
    example: "Hlidej : Projekt.celkem > 1000 -> pulse",
  },
  {
    key: "delete",
    syntax: "Zhasni : Target",
    meaning: "Legacy EXTINGUISH alias.",
    example: "Zhasni : StaryProjekt",
  },
  {
    key: "metadata",
    syntax: "Firma (obor: IT, mesto=Praha)",
    meaning: "Legacy metadata syntax (upsert + metadata).",
    example: "Firma (obor: IT) + Produkt (cena: 500)",
  },
];

const PARSER_RUNTIME_RULES = [
  "UI posila parser_version=v2 u kazdeho prikazu (strict v2 pipeline).",
  "Legacy verby (ukaz/najdi/spocitej/hlidej/zhasni/spoj) jsou podporene i ve v2.",
  "Resolver nejdriv hleda existujici uzly v aktivnim snapshotu (branch-aware), az pak tvori nove.",
  "Delete je vzdy soft delete (EXTINGUISH), hard delete neni povolen.",
  "Historicky mod (as_of) je read-only: mutace, parser write a batch commit jsou blokovane.",
];

const CONTROL_PLAYBOOK = [
  {
    key: "start",
    title: "Start od nuly",
    steps: [
      "Cmd: +NovaGalaxie -> Enter (zalozi nove workspace).",
      "V panelu Rychle zalozeni vypln Souhvezdi, Planeta, Mesic a klikni Zalozit.",
      "Klikni na planetu (LMB), potom klikni na mesic (LMB) pro otevreni detailu.",
    ],
    commands: ["+NovaGalaxie"],
  },
  {
    key: "focus",
    title: "Rychly fokus",
    steps: [
      "Cmd: Ukaz : cil -> Enter (cil muze byt UUID nebo nazev mesice).",
      "Alternativa: v panelu Akce nad existujicim mesicem vyber Mesic a klikni Fokus.",
      "Klavesy: Ctrl+K fokus command line, Tab doplni navrzeny prikaz.",
    ],
    commands: ["Ukaz : ", ":help"],
  },
  {
    key: "grid",
    title: "Tabulka Planety",
    steps: [
      "Nejdriv vyber planetu klikem v prostoru.",
      "Cmd: /grid -> otevre tabulkovy pohled + inspector.",
      "Cmd: /3d -> zavre grid a vrati cisty 3D pohled.",
    ],
    commands: ["/grid", "/3d"],
  },
  {
    key: "safe-delete",
    title: "Bezpecne mazani",
    steps: [
      "Cmd: zhasni : Mesic -> soft delete mesice.",
      "V gridu jde radek oznacit Zhasnout/Obnovit pred batch commit.",
      "Vazby i mesice lze obnovit z timeline/branch workflow (zadny hard delete).",
    ],
    commands: ["zhasni : "],
  },
];

function formatBondTypeLabel(rawType) {
  const normalized = normalizeBondType(rawType);
  if (normalized === "RELATION") return "Vztah";
  if (normalized === "TYPE") return "Typ";
  if (normalized === "FLOW") return "Tok dat";
  if (normalized === "GUARDIAN") return "Kontrola";
  return normalized;
}

function buildBondMeaningSentence(bond, sourceLabel, targetLabel) {
  const source = sourceLabel || "zdroj";
  const target = targetLabel || "cil";
  const type = normalizeBondType(bond?.type || "RELATION");
  if (type === "RELATION") {
    return `${source} a ${target} jsou vzajemne provazane (obousmerne).`;
  }
  if (type === "TYPE") {
    return `${source} je instancni/soucastny prvek typu ${target}.`;
  }
  if (type === "FLOW") {
    return `Data tecou ze ${source} do ${target}.`;
  }
  if (type === "GUARDIAN") {
    return `${source} hlida nebo spousti kontrolu nad ${target}.`;
  }
  return `Vazba vede ze ${source} do ${target}.`;
}

function inferMineralGlyph(key, value) {
  const keyText = normalizeText(key);
  const valueText = normalizeText(valueToLabel(value));
  const numericValue = Number(value);
  if (keyText.includes("date") || keyText.includes("datum") || keyText.includes("cas") || keyText.includes("time")) return "CAL";
  if (
    keyText.includes("price") ||
    keyText.includes("cena") ||
    keyText.includes("cost") ||
    keyText.includes("amount") ||
    keyText.includes("mena") ||
    keyText.includes("money")
  ) {
    return "CUR";
  }
  if (Number.isFinite(numericValue) || /^[+-]?\d+([.,]\d+)?$/.test(valueText)) return "NUM";
  if (valueText.includes("true") || valueText.includes("false")) return "BIN";
  return "TXT";
}

function semanticEffectTone(rawSeverity) {
  const severity = String(rawSeverity || "info").trim().toLowerCase();
  if (severity === "warning") return "#ffd39d";
  if (severity === "error" || severity === "critical") return "#ffb3ca";
  return "#9fe8ff";
}

function semanticEffectOutputSummary(effect) {
  const outputs = effect && typeof effect === "object" && effect.outputs && typeof effect.outputs === "object" ? effect.outputs : {};
  const subject =
    outputs.planet_name ||
    outputs.constellation_name ||
    outputs.asteroid_id ||
    outputs.bond_id ||
    outputs.table_id ||
    "";
  if (!subject) return "";
  const text = String(subject);
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

function normalizeSemanticToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function semanticRuleMatchesValue(rule, value) {
  const normalized = normalizeSemanticToken(value);
  if (!normalized) return false;
  if (!rule || typeof rule !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(rule, "equals")) {
    return normalized === normalizeSemanticToken(rule.equals);
  }
  const list = Array.isArray(rule.in) ? rule.in : Array.isArray(rule.match_values) ? rule.match_values : [];
  if (!list.length) return false;
  const allowed = new Set(list.map((item) => normalizeSemanticToken(item)));
  return allowed.has(normalized);
}

function semanticRuleTargetTable(rule) {
  if (!rule || typeof rule !== "object") return "";
  const direct = String(rule.target_table || "").trim();
  if (direct) return direct;
  const constellation = String(rule.target_constellation || "").trim();
  const planet = String(rule.target_planet || "").trim();
  if (constellation && planet) return `${constellation} > ${planet}`;
  if (planet) return planet;
  return "";
}

function readAutoSemanticRules(contract) {
  const base = contract && typeof contract === "object" ? contract : {};
  if (Array.isArray(base.auto_semantics)) {
    return base.auto_semantics.filter((item) => item && typeof item === "object");
  }
  const schema = base.schema_registry && typeof base.schema_registry === "object" ? base.schema_registry : {};
  if (Array.isArray(schema.auto_semantics)) {
    return schema.auto_semantics.filter((item) => item && typeof item === "object");
  }
  const rulebook = base.physics_rulebook && typeof base.physics_rulebook === "object" ? base.physics_rulebook : {};
  const defaults = rulebook.defaults && typeof rulebook.defaults === "object" ? rulebook.defaults : {};
  if (Array.isArray(defaults.auto_semantics)) {
    return defaults.auto_semantics.filter((item) => item && typeof item === "object");
  }
  return [];
}

function semanticConfidenceLabel(rawConfidence) {
  const confidence = String(rawConfidence || "").trim().toLowerCase();
  if (!confidence) return "neurceno";
  if (confidence === "certain" || confidence === "high") return "jiste";
  if (confidence === "medium") return "stredni";
  return "pravdepodobne";
}

function semanticConfidenceRank(rawConfidence) {
  const confidence = String(rawConfidence || "").trim().toLowerCase();
  if (confidence === "certain" || confidence === "high") return 3;
  if (confidence === "medium") return 2;
  if (confidence === "likely") return 1;
  return 0;
}

function semanticConfidenceTone(rawConfidence) {
  const rank = semanticConfidenceRank(rawConfidence);
  if (rank >= 3) return "#8fffd5";
  if (rank === 2) return "#ffe3a6";
  if (rank === 1) return "#a7dfff";
  return "#d6eaf3";
}

const GRID_SEMANTIC_MODE_OPTIONS = [
  { value: "assign", label: "Metadata := hodnota", description: "Bezpecna editace hodnoty nebo bunky." },
  { value: "relation", label: "Vazba +", description: "Text v bunce vytvori vztah mezi mesici (RELATION)." },
  { value: "type", label: "Typ :", description: "Text v bunce vytvori typovou vazbu (TYPE)." },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUICK_GRID_ROW_HEIGHT = 42;
const QUICK_GRID_OVERSCAN = 8;

function normalizeGridSemanticMode(rawMode) {
  const normalized = String(rawMode || "")
    .trim()
    .toLowerCase();
  if (normalized === "relation" || normalized === "rel" || normalized === "+") return "relation";
  if (normalized === "type" || normalized === ":" || normalized === "classification") return "type";
  return "assign";
}

function splitSemanticTargets(rawValue) {
  return String(rawValue || "")
    .split(/[,\n;|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseGridSemanticModes(validators) {
  const modeByField = {};
  const source = Array.isArray(validators) ? validators : [];
  source.forEach((rule) => {
    if (!rule || typeof rule !== "object") return;
    const operator = String(rule.operator || "")
      .trim()
      .toLowerCase();
    if (operator !== "semantic" && operator !== "ui_semantic") return;
    const field = String(rule.field || "").trim();
    if (!field || field === "value" || RESERVED_METADATA_KEYS.has(field)) return;

    const value = rule.value;
    let mode = "assign";
    if (typeof value === "string") {
      mode = normalizeGridSemanticMode(value);
    } else if (value && typeof value === "object") {
      mode = normalizeGridSemanticMode(value.mode || value.kind || value.type);
    } else if (typeof rule.mode === "string") {
      mode = normalizeGridSemanticMode(rule.mode);
    }
    modeByField[field] = mode;
  });
  return modeByField;
}

function stripGridSemanticValidators(validators) {
  const source = Array.isArray(validators) ? validators : [];
  return source.filter((rule) => {
    if (!rule || typeof rule !== "object") return false;
    const operator = String(rule.operator || "")
      .trim()
      .toLowerCase();
    return operator !== "semantic" && operator !== "ui_semantic";
  });
}

function buildGridSemanticValidators(modeByField) {
  return Object.entries(modeByField || {})
    .filter(([field, mode]) => {
      if (!field || field === "value" || RESERVED_METADATA_KEYS.has(field)) return false;
      return normalizeGridSemanticMode(mode) !== "assign";
    })
    .map(([field, mode]) => ({
      field,
      operator: "semantic",
      value: { mode: normalizeGridSemanticMode(mode) },
    }));
}

function coerceGridNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function matchesGridExpectedType(expectedRaw, valueRaw) {
  const expected = String(expectedRaw || "")
    .trim()
    .toLowerCase();
  const value = valueRaw ?? "";
  const asText = String(value).trim();
  if (!expected || expected === "any" || expected === "json") return true;
  if (!asText) return true;
  if (expected === "string" || expected === "str" || expected === "text") return true;
  if (expected === "number" || expected === "float" || expected === "double" || expected === "decimal") {
    return coerceGridNumber(value) !== null;
  }
  if (expected === "int" || expected === "integer") {
    const number = coerceGridNumber(value);
    return number !== null && Number.isInteger(number);
  }
  if (expected === "bool" || expected === "boolean") {
    return ["true", "false", "1", "0", "yes", "no"].includes(asText.toLowerCase());
  }
  if (expected === "array" || expected === "list") {
    return asText.startsWith("[") && asText.endsWith("]");
  }
  if (expected === "object" || expected === "dict" || expected === "map") {
    return asText.startsWith("{") && asText.endsWith("}");
  }
  return true;
}

function normalizeFactValueType(rawType) {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "string" ||
    normalized === "number" ||
    normalized === "boolean" ||
    normalized === "datetime" ||
    normalized === "json" ||
    normalized === "null"
  ) {
    return normalized;
  }
  return "string";
}

function coerceGridFactInputValue(rawValue, factValueTypeRaw) {
  const rawText = String(rawValue ?? "");
  const valueType = normalizeFactValueType(factValueTypeRaw);
  if (valueType === "number") {
    const number = coerceGridNumber(rawText);
    return number === null ? rawText : number;
  }
  if (valueType === "boolean") {
    const normalized = rawText.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
    return rawText;
  }
  if (valueType === "json") {
    const text = rawText.trim();
    if (!text) return rawText;
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try {
        return JSON.parse(text);
      } catch {
        return rawText;
      }
    }
    return rawText;
  }
  if (valueType === "null") {
    return rawText.trim() ? rawText : null;
  }
  return rawText;
}

export default function UniverseWorkspace({ galaxy, onCreateGalaxy, onBackToGalaxies, onLogout }) {
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
    clearSelectedAsteroid,
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
  const [commandHistory, setCommandHistory] = useState([]);
  const [commandHistoryCursor, setCommandHistoryCursor] = useState(-1);
  const [commandHistoryDraft, setCommandHistoryDraft] = useState("");
  const [commandSuggestionCursor, setCommandSuggestionCursor] = useState(0);
  const [snapshot, setSnapshot] = useState({ asteroids: [], bonds: [] });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hoveredLink, setHoveredLink] = useState(null);
  const [createFieldKey, setCreateFieldKey] = useState("");
  const [createFieldValue, setCreateFieldValue] = useState("");
  const [gridDraft, setGridDraft] = useState({});
  const [gridEditingCell, setGridEditingCell] = useState("");
  const [gridChangeSet, setGridChangeSet] = useState({});
  const [gridPendingExtinguishIds, setGridPendingExtinguishIds] = useState({});
  const [gridSelectedRowId, setGridSelectedRowId] = useState("");
  const [gridNewRows, setGridNewRows] = useState([]);
  const [gridNewRowLabel, setGridNewRowLabel] = useState("");
  const [gridNewRowMetaKey, setGridNewRowMetaKey] = useState("");
  const [gridNewRowMetaValue, setGridNewRowMetaValue] = useState("");
  const [gridBatchBusy, setGridBatchBusy] = useState(false);
  const [gridBatchInfo, setGridBatchInfo] = useState("");
  const [gridBatchPreview, setGridBatchPreview] = useState(null);
  const [gridColumnModes, setGridColumnModes] = useState({});
  const [gridContractBase, setGridContractBase] = useState(null);
  const [gridContractBusy, setGridContractBusy] = useState(false);
  const [gridContractInfo, setGridContractInfo] = useState("");
  const [gridUndoCount, setGridUndoCount] = useState(0);
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
  const [moonDeleteHover, setMoonDeleteHover] = useState(false);
  const [pendingMoonFocusId, setPendingMoonFocusId] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [quickGridOpen, setQuickGridOpen] = useState(false);
  const [gridSearchQuery, setGridSearchQuery] = useState("");
  const [gridShowGhostRows, setGridShowGhostRows] = useState(false);
  const [gridSavingCells, setGridSavingCells] = useState({});
  const [gridDeletingRows, setGridDeletingRows] = useState({});
  const [gridRemovedRowIds, setGridRemovedRowIds] = useState({});
  const [gridGhostRows, setGridGhostRows] = useState({});
  const [gridViewport, setGridViewport] = useState({ scrollTop: 0, height: 420 });
  const [inspectorShowAllFacts, setInspectorShowAllFacts] = useState(false);
  const [shellTopOffset, setShellTopOffset] = useState(86);
  const [semanticEffects, setSemanticEffects] = useState([]);
  const [commandInputFocused, setCommandInputFocused] = useState(false);
  const [commandDockExpanded, setCommandDockExpanded] = useState(false);
  const [helpMode, setHelpMode] = useState("quick");
  const focusUiMode = true;

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });
  const streamCursorRef = useRef(null);
  const streamRefreshTimeoutRef = useRef(null);
  const tablesRef = useRef(tables);
  const commandInputRef = useRef(null);
  const navigatorShellRef = useRef(null);
  const topHudRef = useRef(null);
  const quickGridScrollRef = useRef(null);
  const gridUndoStackRef = useRef([]);
  const pendingMoonFocusStartedAtRef = useRef(0);

  const asOfIso = useMemo(() => toAsOfIso(asOfInput), [asOfInput]);
  const historicalMode = Boolean(asOfIso);
  const activeBranchId = selectedBranchId || null;
  const selectedBranch = useMemo(
    () => branches.find((item) => String(item.id) === String(selectedBranchId || "")) || null,
    [branches, selectedBranchId]
  );
  const activeWorkspaceLabel = selectedBranch ? `branch:${selectedBranch.name}` : "main";
  const hierarchyView = useMemo(() => {
    const graph = buildHierarchyGraphInputs(tables, snapshot);
    return buildHierarchyTree(graph.nodes, graph.edges);
  }, [snapshot.asteroids, snapshot.bonds, tables]);
  const commandSuggestions = useMemo(() => {
    const staticSuggestions = [
      { key: "refresh", label: ":refresh", insert: ":refresh", hint: "Obnovi snapshot a tabulky" },
      { key: "galaxie", label: ":galaxie", insert: ":galaxie", hint: "Navrat do vyberu workspace" },
      { key: "souhvezdi", label: ":souhvezdi", insert: ":souhvezdi", hint: "Navrat na uroven skupin" },
      { key: "help", label: ":help", insert: ":help", hint: "Otevre panel rozsirenych akci" },
      { key: "grid", label: "/grid", insert: "/grid", hint: "Otevre tabulkovy pohled planety" },
      { key: "space", label: "/3d", insert: "/3d", hint: "Vrati cisty 3D pohled" },
      { key: "new-galaxy", label: "+NovaGalaxie", insert: "+NovaGalaxie", hint: "Zalozeni nove galaxie" },
      { key: "focus", label: "Ukaz :", insert: "Ukaz : ", hint: "Fokus na objekt" },
      { key: "formula", label: "spocitej :", insert: "spocitej : ", hint: "Definice vypoctu" },
      { key: "guardian", label: "hlidej :", insert: "hlidej : ", hint: "Guardian pravidlo" },
      { key: "delete", label: "zhasni :", insert: "zhasni : ", hint: "Soft delete mesice" },
    ];
    const moonSuggestions = [];
    const seen = new Set();
    hierarchyView.indexes.moonById.forEach((moon) => {
      const asteroid = moon?.originalNode || {};
      const label = valueToLabel(asteroid?.value).trim();
      const normalized = normalizeText(label);
      if (!label || !normalized || seen.has(normalized)) return;
      seen.add(normalized);
      moonSuggestions.push({
        key: `moon:${normalized}`,
        label: `Ukaz : ${label}`,
        insert: `Ukaz : ${label}`,
        hint: "Fokus na existujici mesic",
      });
    });
    moonSuggestions.sort((a, b) => a.label.localeCompare(b.label));

    const source = [...staticSuggestions, ...moonSuggestions.slice(0, 10)];
    const needle = normalizeText(query).replace(/\s+/g, "");
    if (!needle) {
      return source.slice(0, 7);
    }
    return source
      .filter((item) => normalizeText(`${item.label} ${item.insert} ${item.hint}`).replace(/\s+/g, "").includes(needle))
      .slice(0, 9);
  }, [query, hierarchyView]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    setCommandSuggestionCursor(0);
  }, [query, commandSuggestions.length]);

  useEffect(() => {
    const handleGlobalCommandHotkeys = (event) => {
      const key = String(event.key || "").toLowerCase();
      const target = event.target;
      const tag = String(target?.tagName || "").toUpperCase();
      const editable = Boolean(target?.isContentEditable) || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        commandInputRef.current?.focus();
        commandInputRef.current?.select();
        return;
      }
      if (key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (editable) return;
      event.preventDefault();
      commandInputRef.current?.focus();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleGlobalCommandHotkeys);
      return () => window.removeEventListener("keydown", handleGlobalCommandHotkeys);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const recalcShellTopOffset = () => {
      const navHeight = navigatorShellRef.current?.getBoundingClientRect?.().height || 0;
      const hudHeight = topHudRef.current?.getBoundingClientRect?.().height || 0;
      const next = Math.max(86, Math.ceil(Math.max(navHeight, hudHeight) + 24));
      setShellTopOffset((prev) => (prev === next ? prev : next));
    };

    recalcShellTopOffset();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", recalcShellTopOffset);
      const raf = window.requestAnimationFrame(recalcShellTopOffset);
      return () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener("resize", recalcShellTopOffset);
      };
    }
    return undefined;
  }, [
    activeWorkspaceLabel,
    level,
    loading,
    selectedAsteroidId,
    selectedBondId,
    selectedTableId,
    streamState,
    historicalMode,
  ]);

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
    setGridDraft({});
    setGridChangeSet({});
    setGridPendingExtinguishIds({});
    setGridSelectedRowId("");
    setGridNewRows([]);
    setGridNewRowLabel("");
    setGridNewRowMetaKey("");
    setGridNewRowMetaValue("");
    setGridBatchInfo("");
    setGridBatchPreview(null);
    setGridColumnModes({});
    setGridContractBase(null);
    setGridContractBusy(false);
    setGridContractInfo("");
    gridUndoStackRef.current = [];
    setGridUndoCount(0);
    setCommandHistory([]);
    setCommandHistoryCursor(-1);
    setCommandHistoryDraft("");
    setCommandSuggestionCursor(0);
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
    const exists = hierarchyView.indexes.planetById.has(String(selectedTableId));
    if (!exists) {
      backToTables();
    }
  }, [backToTables, hierarchyView, selectedTableId]);

  const hierarchyAsteroids = useMemo(
    () =>
      [...hierarchyView.indexes.moonById.values()].map((moon) => {
        const original = moon?.originalNode;
        if (original && typeof original === "object") return original;
        return { id: moon.id, value: moon.label || moon.id, metadata: {} };
      }),
    [hierarchyView]
  );
  const asteroidById = useMemo(() => {
    const map = new Map();
    hierarchyAsteroids.forEach((asteroid) => {
      map.set(String(asteroid.id), asteroid);
    });
    return map;
  }, [hierarchyAsteroids]);
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
    hierarchyAsteroids.forEach((asteroid) => {
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
  }, [asteroidBondDensityById, hierarchyAsteroids, moonMetricsByAsteroidId]);

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
  const selectedSemantic = useMemo(
    () => splitEntityAndPlanetName(selectedTable),
    [selectedTable]
  );

  const selectedAsteroid = useMemo(
    () => asteroidById.get(String(selectedAsteroidId || "")) || null,
    [asteroidById, selectedAsteroidId]
  );
  const moonRowContractById = useMemo(() => {
    const map = new Map();
    const source = Array.isArray(snapshot?.asteroids) ? snapshot.asteroids : [];
    source.forEach((asteroid) => {
      const id = String(asteroid?.id || "");
      if (!id) return;
      map.set(id, toMoonRowContract(asteroid));
    });
    return map;
  }, [snapshot?.asteroids]);
  const selectedMoonContract = useMemo(
    () => moonRowContractById.get(String(selectedAsteroidId || "")) || null,
    [moonRowContractById, selectedAsteroidId]
  );
  const selectedAsteroidFacts = useMemo(() => {
    if (!selectedAsteroid) return [];
    if (Array.isArray(selectedMoonContract?.facts) && selectedMoonContract.facts.length) {
      return selectedMoonContract.facts;
    }
    return toMoonRowContract(selectedAsteroid).facts;
  }, [selectedAsteroid, selectedMoonContract]);
  const selectedEditableFacts = useMemo(
    () =>
      selectedAsteroidFacts.filter((fact) => {
        const key = String(fact?.key || "");
        if (!key || key === "value" || RESERVED_METADATA_KEYS.has(key)) return false;
        return String(fact?.source || "metadata") !== "calculated";
      }),
    [selectedAsteroidFacts]
  );
  const selectedCalculatedFacts = useMemo(
    () => selectedAsteroidFacts.filter((fact) => String(fact?.source || "") === "calculated"),
    [selectedAsteroidFacts]
  );
  const selectedValueFact = useMemo(
    () => selectedAsteroidFacts.find((fact) => String(fact?.key || "") === "value") || null,
    [selectedAsteroidFacts]
  );
  const selectedMoonContextLabel = useMemo(() => {
    const constellationName = String(selectedMoonContract?.constellation_name || selectedSemantic?.entityName || "").trim();
    const planetName = String(selectedMoonContract?.planet_name || selectedSemantic?.planetName || "").trim();
    if (constellationName && planetName) return `${constellationName} / ${planetName}`;
    if (planetName) return planetName;
    return "Mesic bez planety";
  }, [selectedMoonContract, selectedSemantic?.entityName, selectedSemantic?.planetName]);
  const inspectorVisibleFacts = useMemo(() => {
    if (inspectorShowAllFacts) return selectedEditableFacts;
    return selectedEditableFacts.slice(0, 6);
  }, [inspectorShowAllFacts, selectedEditableFacts]);
  const inspectorHiddenFactsCount = Math.max(selectedEditableFacts.length - inspectorVisibleFacts.length, 0);
  const selectedBond = useMemo(
    () => snapshot.bonds.find((bond) => String(bond.id) === String(selectedBondId || "")) || null,
    [selectedBondId, snapshot.bonds]
  );
  const selectedBondSource = useMemo(
    () => asteroidById.get(String(selectedBond?.source_id || "")) || null,
    [asteroidById, selectedBond]
  );
  const selectedBondTarget = useMemo(
    () => asteroidById.get(String(selectedBond?.target_id || "")) || null,
    [asteroidById, selectedBond]
  );
  const selectedBondSourceLabel = useMemo(
    () => valueToLabel(selectedBondSource?.value) || String(selectedBond?.source_id || ""),
    [selectedBond, selectedBondSource]
  );
  const selectedBondTargetLabel = useMemo(
    () => valueToLabel(selectedBondTarget?.value) || String(selectedBond?.target_id || ""),
    [selectedBond, selectedBondTarget]
  );
  const selectedBondMeaning = useMemo(
    () => buildBondMeaningSentence(selectedBond, selectedBondSourceLabel, selectedBondTargetLabel),
    [selectedBond, selectedBondSourceLabel, selectedBondTargetLabel]
  );
  const selectedMoonV1 = useMemo(
    () => moons.find((item) => String(item.asteroid_id) === String(selectedAsteroidId || "")) || null,
    [moons, selectedAsteroidId]
  );
  const selectedBondV1 = useMemo(
    () => bondsV1.find((item) => String(item.bond_id) === String(selectedBondId || "")) || null,
    [bondsV1, selectedBondId]
  );

  useEffect(() => {
    setInspectorShowAllFacts(false);
  }, [selectedAsteroidId]);

  useEffect(() => {
    if (quickGridOpen && showHelp) {
      setShowHelp(false);
    }
  }, [quickGridOpen, showHelp]);

  useEffect(() => {
    setSemanticEffects([]);
  }, [activeBranchId, galaxy?.id]);

  const moonQuickOptions = useMemo(
    () => {
      const options = [];
      hierarchyView.indexes.moonById.forEach((moon, moonId) => {
        const asteroid = moon?.originalNode || {};
        const id = String(moonId);
        const label = valueToLabel(asteroid?.value) || moon?.label || id.slice(0, 8);
        const planetId = hierarchyView.indexes.moonToPlanet.get(id);
        const planet = planetId ? hierarchyView.indexes.planetById.get(planetId) : null;
        const semantic = planet?.originalNode
          ? splitEntityAndPlanetName(planet.originalNode)
          : { entityName: "Sirotci", planetName: "Bez planety" };
        options.push({
          id,
          label: `${label} • ${semantic.entityName}/${semantic.planetName}`,
        });
      });
      return options.sort((a, b) => a.label.localeCompare(b.label));
    },
    [hierarchyView]
  );
  const asteroidNodeById = useMemo(() => new Map(asteroidNodes.map((node) => [String(node.id), node])), [asteroidNodes]);
  const hierarchyDiagnosticsSummary = useMemo(
    () => ({
      warnings: Array.isArray(hierarchyView?.diagnostics?.warnings) ? hierarchyView.diagnostics.warnings.length : 0,
      droppedEdges: Array.isArray(hierarchyView?.diagnostics?.droppedEdges) ? hierarchyView.diagnostics.droppedEdges.length : 0,
      orphans: Array.isArray(hierarchyView?.orphans) ? hierarchyView.orphans.length : 0,
    }),
    [hierarchyView]
  );
  const constellationPanelItems = useMemo(() => {
    const buckets = new Map();
    const statusRank = { GREEN: 0, YELLOW: 1, RED: 2 };
    const takeWorseStatus = (current, next) => {
      const normalizedCurrent = String(current || "GREEN").toUpperCase();
      const normalizedNext = String(next || "GREEN").toUpperCase();
      return (statusRank[normalizedNext] || 0) > (statusRank[normalizedCurrent] || 0) ? normalizedNext : normalizedCurrent;
    };
    hierarchyView.planets.forEach((planet) => {
      const tableId = String(planet.id || "");
      const semantic = splitEntityAndPlanetName(planet.originalNode);
      const key = semantic.entityName || "Uncategorized";
      const metric = planetMetricsByTableId.get(tableId) || null;
      const qualityScore = Number(metric?.quality_score ?? 100);
      const status = String(metric?.status || "GREEN").toUpperCase();
      const tableNode = tableNodeById.get(tableId) || null;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          name: key,
          planetsCount: 1,
          moonsCount: Array.isArray(planet.moons) ? planet.moons.length : 0,
          qualityTotal: Number.isFinite(qualityScore) ? qualityScore : 100,
          qualityCount: 1,
          status,
          focusNode: tableNode,
        });
        return;
      }
      existing.planetsCount += 1;
      existing.moonsCount += Array.isArray(planet.moons) ? planet.moons.length : 0;
      existing.qualityTotal += Number.isFinite(qualityScore) ? qualityScore : 100;
      existing.qualityCount += 1;
      existing.status = takeWorseStatus(existing.status, status);
      if (!existing.focusNode && tableNode) {
        existing.focusNode = tableNode;
      }
    });

    return [...buckets.values()]
      .map((item) => ({
        ...item,
        qualityScore: Math.round(item.qualityTotal / Math.max(1, item.qualityCount)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [hierarchyView, planetMetricsByTableId, tableNodeById]);
  const planetPanelItems = useMemo(
    () =>
      hierarchyView.planets
        .map((planet) => {
          const tableId = String(planet.id || "");
          const semantic = splitEntityAndPlanetName(planet.originalNode);
          const metric = planetMetricsByTableId.get(tableId) || null;
          return {
            tableId,
            name: semantic.planetName || tableId,
            constellationName: semantic.entityName || "Uncategorized",
            moonsCount: Array.isArray(planet.moons) ? planet.moons.length : 0,
            schemaFieldsCount: Number(metric?.schema_fields_count ?? 0),
            formulaFieldsCount: Number(metric?.formula_fields_count ?? 0),
            bondCount: Number(metric?.internal_bonds_count ?? 0) + Number(metric?.external_bonds_count ?? 0),
            sectorMode: String(metric?.sector_mode || "graph"),
            qualityScore: Number(metric?.quality_score ?? 100),
            status: String(metric?.status || "GREEN").toUpperCase(),
            tableNode: tableNodeById.get(tableId) || null,
          };
        })
        .sort((a, b) => `${a.constellationName}/${a.name}`.localeCompare(`${b.constellationName}/${b.name}`)),
    [hierarchyView, planetMetricsByTableId, tableNodeById]
  );
  const moonPanelItems = useMemo(
    () =>
      [...hierarchyView.indexes.moonById.values()]
        .map((moon) => {
          const moonId = String(moon.id || "");
          const asteroid = moon?.originalNode && typeof moon.originalNode === "object" ? moon.originalNode : { id: moonId, metadata: {} };
          const planetId = hierarchyView.indexes.moonToPlanet.get(moonId);
          const planet = planetId ? hierarchyView.indexes.planetById.get(planetId) : null;
          const semantic = planet?.originalNode
            ? splitEntityAndPlanetName(planet.originalNode)
            : { entityName: "Sirotci", planetName: "Bez planety" };
          const metric = moonMetricsByAsteroidId.get(moonId) || null;
          const contractFacts = moonRowContractById.get(moonId)?.facts || [];
          const metadataCount =
            contractFacts.filter((fact) => {
              const key = String(fact?.key || "");
              if (!key || key === "value" || RESERVED_METADATA_KEYS.has(key)) return false;
              return String(fact?.source || "metadata") !== "calculated";
            }).length ||
            Object.keys(safeMetadata(asteroid?.metadata)).filter((field) => !RESERVED_METADATA_KEYS.has(String(field))).length;
          const calculatedCount =
            contractFacts.filter((fact) => String(fact?.source || "") === "calculated").length ||
            Object.keys(
              asteroid?.calculated_values && typeof asteroid.calculated_values === "object" ? asteroid.calculated_values : {}
            ).length;
          const alertsCount = Array.isArray(asteroid?.active_alerts)
            ? asteroid.active_alerts.length
            : Number(metric?.active_alerts_count ?? 0);
          return {
            asteroidId: moonId,
            label: valueToLabel(asteroid?.value) || moon?.label || moonId,
            constellationName: semantic.entityName,
            planetName: semantic.planetName,
            tableId: planetId || "",
            metadataFieldsCount: Number(metric?.metadata_fields_count ?? metadataCount),
            calculatedFieldsCount: Number(metric?.calculated_fields_count ?? calculatedCount),
            activeAlertsCount: Number(metric?.active_alerts_count ?? alertsCount),
            qualityScore: Number(metric?.quality_score ?? 100),
            status: String(metric?.status || "GREEN").toUpperCase(),
            tableNode: planetId ? tableNodeById.get(String(planetId)) || null : null,
            moonNode: asteroidNodeById.get(moonId) || null,
            isOrphan: !planetId,
          };
        })
        .sort((a, b) => {
          if (a.isOrphan !== b.isOrphan) return a.isOrphan ? -1 : 1;
          return `${a.constellationName}/${a.planetName}/${a.label}`.localeCompare(
            `${b.constellationName}/${b.planetName}/${b.label}`
          );
        }),
    [asteroidNodeById, hierarchyView, moonMetricsByAsteroidId, moonRowContractById, tableNodeById]
  );
  const selectedQuickLinkTypeOption = useMemo(
    () => QUICK_LINK_TYPE_OPTIONS.find((item) => item.value === quickLinkType) || QUICK_LINK_TYPE_OPTIONS[0],
    [quickLinkType]
  );

  const selectBondInInspector = useCallback(
    (bondId) => {
      const normalizedBondId = String(bondId || "").trim();
      if (!normalizedBondId) return;
      clearSelectedAsteroid();
      setSelectedBondId(normalizedBondId);
      patchPanel("inspector", { collapsed: false });
    },
    [clearSelectedAsteroid, patchPanel]
  );
  const focusMoonAcrossContext = useCallback(
    (moonId, { showOrphanHint = false } = {}) => {
      const normalizedMoonId = String(moonId || "").trim();
      if (!normalizedMoonId) return false;

      const moon = asteroidById.get(normalizedMoonId);
      if (!moon) return false;

      const planetId = String(hierarchyView.indexes.moonToPlanet.get(normalizedMoonId) || "");
      const directMoonNode = asteroidNodeById.get(normalizedMoonId) || null;
      const tableNode = planetId ? tableNodeById.get(planetId) || null : null;

      setSelectedBondId("");
      patchPanel("moons", { collapsed: false });
      patchPanel("inspector", { collapsed: false });

      if (tableNode) {
        focusTable({ tableId: tableNode.id, cameraTarget: tableNode.position, cameraDistance: 198 });
        pendingMoonFocusStartedAtRef.current = Date.now();
        setPendingMoonFocusId(normalizedMoonId);
        return true;
      }

      if (directMoonNode) {
        focusAsteroid({ asteroidId: directMoonNode.id, cameraTarget: directMoonNode.position, cameraDistance: 56 });
      } else {
        const fallbackTarget = resolveCameraTarget(camera);
        const fallbackDistance = clamp(resolveCameraDistance(camera, 96), 52, 220);
        focusAsteroid({ asteroidId: normalizedMoonId, cameraTarget: fallbackTarget, cameraDistance: fallbackDistance });
      }

      if (showOrphanHint && !planetId) {
        setError("Mesic je SIROTEK (bez planety). Nejdriv ho prirad k planete.");
      }
      return true;
    },
    [asteroidById, asteroidNodeById, camera, focusAsteroid, focusTable, hierarchyView, patchPanel, tableNodeById]
  );
  const focusFirstOrphanMoon = useCallback(() => {
    const orphan = moonPanelItems.find((item) => item.isOrphan);
    if (!orphan) {
      setError("Sirotci nejsou dostupni.");
      return;
    }
    focusMoonAcrossContext(orphan.asteroidId, { showOrphanHint: true });
  }, [focusMoonAcrossContext, moonPanelItems]);

  useEffect(() => {
    if (!pendingMoonFocusId) return;
    const moonId = String(pendingMoonFocusId);
    const moonNode = asteroidNodeById.get(moonId);
    if (!moonNode) {
      if (!asteroidById.has(moonId)) {
        pendingMoonFocusStartedAtRef.current = 0;
        setPendingMoonFocusId("");
        setError("Fokus selhal: Mesic uz neni dostupny.");
        return;
      }
      const startedAt = pendingMoonFocusStartedAtRef.current || Date.now();
      pendingMoonFocusStartedAtRef.current = startedAt;
      if (Date.now() - startedAt < 1200) return;
      const fallbackTarget = resolveCameraTarget(camera);
      const fallbackDistance = clamp(resolveCameraDistance(camera, 96), 52, 220);
      focusAsteroid({ asteroidId: moonId, cameraTarget: fallbackTarget, cameraDistance: fallbackDistance });
      patchPanel("inspector", { collapsed: false });
      pendingMoonFocusStartedAtRef.current = 0;
      setPendingMoonFocusId("");
      setError("Fokus mesice trval prilis dlouho. Otevren fallback detail bez prepnuti planety.");
      return;
    }
    focusAsteroid({ asteroidId: moonNode.id, cameraTarget: moonNode.position, cameraDistance: 56 });
    patchPanel("inspector", { collapsed: false });
    pendingMoonFocusStartedAtRef.current = 0;
    setPendingMoonFocusId("");
  }, [asteroidById, asteroidNodeById, camera, focusAsteroid, patchPanel, pendingMoonFocusId]);

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
    if (!selectedTableId) return [];
    const planet = hierarchyView.indexes.planetById.get(String(selectedTableId));
    if (!planet) return [];
    return [...(Array.isArray(planet.moons) ? planet.moons : [])]
      .map((moon) => {
        const moonId = String(moon?.id || "");
        const asteroid = moon?.originalNode;
        const base =
          asteroid && typeof asteroid === "object" ? asteroid : { id: moonId, value: moon.label || moonId, metadata: {} };
        const contract = moonRowContractById.get(moonId) || toMoonRowContract(base);
        return {
          ...base,
          id: base.id || moonId,
          facts: Array.isArray(contract?.facts) ? contract.facts : [],
          current_event_seq: Number.isInteger(base?.current_event_seq) ? base.current_event_seq : Number(contract?.current_event_seq || 0),
        };
      })
      .sort((a, b) => valueToLabel(a.value).localeCompare(valueToLabel(b.value)));
  }, [hierarchyView, moonRowContractById, selectedTableId]);

  const focusFirstMoonInSelectedTable = useCallback(() => {
    if (!tableRows.length) return false;
    const firstMoon = tableRows[0];
    const moonNode = asteroidNodes.find((item) => String(item.id) === String(firstMoon.id));
    if (!moonNode) return false;
    setSelectedBondId("");
    focusAsteroid({ asteroidId: moonNode.id, cameraTarget: moonNode.position, cameraDistance: 54 });
    patchPanel("inspector", { collapsed: false });
    patchPanel("moons", { collapsed: false });
    return true;
  }, [asteroidNodes, focusAsteroid, patchPanel, tableRows]);

  const autoFocusedTableRef = useRef("");
  useEffect(() => {
    if (!selectedTableId) {
      autoFocusedTableRef.current = "";
      return;
    }
    if (selectedAsteroidId) return;
    if (autoFocusedTableRef.current === String(selectedTableId)) return;
    const focused = focusFirstMoonInSelectedTable();
    if (focused) {
      autoFocusedTableRef.current = String(selectedTableId);
    }
  }, [focusFirstMoonInSelectedTable, selectedAsteroidId, selectedTableId]);

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
      const facts = Array.isArray(row?.facts) ? row.facts : [];
      facts.forEach((fact) => {
        const field = String(fact?.key || "");
        if (!field || field === "value") return;
        if (String(fact?.source || "metadata") === "calculated") return;
        if (RESERVED_METADATA_KEYS.has(field)) return;
        set.add(field);
      });
      if (!facts.length) {
        Object.keys(safeMetadata(row.metadata)).forEach((field) => {
          if (!RESERVED_METADATA_KEYS.has(String(field))) {
            set.add(field);
          }
        });
      }
    });
    return [...set];
  }, [selectedTable, tableRows]);
  const getRowBaselineValue = useCallback((row, column) => {
    const normalizedColumn = String(column || "");
    const facts = Array.isArray(row?.facts) ? row.facts : [];
    if (normalizedColumn === "value") {
      const fact = facts.find((item) => String(item?.key || "") === "value");
      if (fact) return valueToLabel(fact.typed_value);
      return valueToLabel(row?.value);
    }
    const fact = facts.find((item) => {
      if (String(item?.key || "") !== normalizedColumn) return false;
      return String(item?.source || "metadata") !== "calculated";
    });
    if (fact) return valueToLabel(fact.typed_value);
    return valueToLabel(safeMetadata(row?.metadata)[normalizedColumn] ?? "");
  }, []);
  const getCalculatedBaselineValue = useCallback((row, column) => {
    const normalizedColumn = String(column || "");
    if (!normalizedColumn) return "";
    const facts = Array.isArray(row?.facts) ? row.facts : [];
    const fact = facts.find((item) => {
      if (String(item?.key || "") !== normalizedColumn) return false;
      return String(item?.source || "").toLowerCase() === "calculated";
    });
    if (fact) return valueToLabel(fact.typed_value);
    const calculated =
      row?.calculated_values && typeof row.calculated_values === "object" && !Array.isArray(row.calculated_values)
        ? row.calculated_values
        : {};
    return valueToLabel(calculated[normalizedColumn] ?? "");
  }, []);
  const gridCalculatedColumns = useMemo(() => {
    const set = new Set();
    tableRows.forEach((row) => {
      const facts = Array.isArray(row?.facts) ? row.facts : [];
      facts.forEach((fact) => {
        const key = String(fact?.key || "").trim();
        if (!key || key === "value" || RESERVED_METADATA_KEYS.has(key)) return;
        if (String(fact?.source || "").toLowerCase() !== "calculated") return;
        set.add(key);
      });
    });
    return [...set];
  }, [tableRows]);
  const gridDisplayColumns = useMemo(() => {
    const ordered = [...gridColumns];
    gridCalculatedColumns.forEach((column) => {
      if (!ordered.includes(column)) ordered.push(column);
    });
    return ordered;
  }, [gridCalculatedColumns, gridColumns]);
  const gridCalculatedColumnSet = useMemo(() => new Set(gridCalculatedColumns), [gridCalculatedColumns]);
  const gridFilteredRows = useMemo(() => {
    const needle = normalizeText(gridSearchQuery);
    const activeRows = tableRows.filter((row) => {
      const rowId = String(row?.id || "");
      if (!gridShowGhostRows && gridRemovedRowIds[rowId]) return false;
      return true;
    });

    const activeRowIds = new Set(activeRows.map((row) => String(row?.id || "")));
    const ghostRows = gridShowGhostRows
      ? Object.values(gridGhostRows).filter((row) => {
          const rowId = String(row?.id || "");
          return rowId && !activeRowIds.has(rowId);
        })
      : [];

    return [...activeRows, ...ghostRows].filter((row) => {
      const rowId = String(row?.id || "");
      const rowLabel = valueToLabel(row?.value);
      if (!needle) return true;
      const parts = [rowLabel];
      gridDisplayColumns.forEach((column) => {
        const cellId = `${rowId}::${column}`;
        const value = gridCalculatedColumnSet.has(column)
          ? getCalculatedBaselineValue(row, column)
          : Object.prototype.hasOwnProperty.call(gridDraft, cellId)
            ? gridDraft[cellId]
            : getRowBaselineValue(row, column);
        parts.push(value);
      });
      return normalizeText(parts.join(" ")).includes(needle);
    });
  }, [
    getCalculatedBaselineValue,
    getRowBaselineValue,
    gridDraft,
    gridCalculatedColumnSet,
    gridDisplayColumns,
    gridGhostRows,
    gridRemovedRowIds,
    gridSearchQuery,
    gridShowGhostRows,
    tableRows,
  ]);
  const gridVirtualWindow = useMemo(() => {
    const total = gridFilteredRows.length;
    const viewportHeight = Math.max(180, Number(gridViewport?.height || 0));
    const scrollTop = Math.max(0, Number(gridViewport?.scrollTop || 0));
    const start = Math.max(0, Math.floor(scrollTop / QUICK_GRID_ROW_HEIGHT) - QUICK_GRID_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / QUICK_GRID_ROW_HEIGHT) + QUICK_GRID_OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      topPad: start * QUICK_GRID_ROW_HEIGHT,
      bottomPad: Math.max(0, (total - end) * QUICK_GRID_ROW_HEIGHT),
      total,
    };
  }, [gridFilteredRows.length, gridViewport?.height, gridViewport?.scrollTop]);
  const gridVirtualRows = useMemo(
    () => gridFilteredRows.slice(gridVirtualWindow.start, gridVirtualWindow.end),
    [gridFilteredRows, gridVirtualWindow.end, gridVirtualWindow.start]
  );

  const getGridColumnMode = useCallback(
    (column) => {
      if (column === "value") return "assign";
      return normalizeGridSemanticMode(gridColumnModes[column]);
    },
    [gridColumnModes]
  );

  const savedGridColumnModes = useMemo(
    () => parseGridSemanticModes(gridContractBase?.validators),
    [gridContractBase]
  );

  const gridSemanticDirty = useMemo(() => {
    const keys = new Set(
      gridColumns
        .filter((column) => column !== "value")
        .map((column) => String(column))
    );
    for (const key of Object.keys(savedGridColumnModes)) keys.add(key);
    for (const key of Object.keys(gridColumnModes)) keys.add(key);
    for (const key of keys) {
      const current = normalizeGridSemanticMode(gridColumnModes[key]);
      const saved = normalizeGridSemanticMode(savedGridColumnModes[key]);
      if (current !== saved) return true;
    }
    return false;
  }, [gridColumns, gridColumnModes, savedGridColumnModes]);

  const handleGridColumnModeChange = useCallback((column, nextMode) => {
    const key = String(column || "").trim();
    if (!key || key === "value" || RESERVED_METADATA_KEYS.has(key)) return;
    const mode = normalizeGridSemanticMode(nextMode);
    setGridColumnModes((previous) => ({ ...previous, [key]: mode }));
    setGridContractInfo("");
  }, []);

  const loadGridContract = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedTableId || !galaxy?.id) return;
      setGridContractBusy(true);
      if (!silent) {
        setGridContractInfo("");
      }
      try {
        const response = await apiFetch(buildTableContractUrl(API_BASE, selectedTableId, galaxy.id));
        if (response.status === 404) {
          setGridContractBase({
            required_fields: [],
            field_types: {},
            unique_rules: [],
            validators: [],
          });
          setGridColumnModes({});
          if (!silent) {
            setGridContractInfo("Kontrakt pro planetu jeste neexistuje. Rezim je default :=.");
          }
          return;
        }
        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response, "Table contract load failed");
          throw apiError;
        }
        const body = await response.json();
        setGridContractBase(body);
        setGridColumnModes(parseGridSemanticModes(body?.validators));
        if (!silent) {
          setGridContractInfo("Kontrakt nacten.");
        }
      } catch (loadError) {
        if (!silent) {
          setError(loadError.message || "Table contract load failed");
        }
      } finally {
        setGridContractBusy(false);
      }
    },
    [galaxy?.id, selectedTableId]
  );

  const saveGridContract = useCallback(async () => {
    if (historicalMode) {
      setError("Historicky mod je pouze pro cteni.");
      return;
    }
    if (!selectedTableId) {
      setError("Nejdriv vyber planetu/tabulku.");
      return;
    }
    if (!galaxy?.id) {
      setError("Chybi aktivni galaxie.");
      return;
    }

    const base = gridContractBase && typeof gridContractBase === "object" ? gridContractBase : {};
    const requiredFields = Array.isArray(base.required_fields) ? base.required_fields : [];
    const fieldTypes =
      base.field_types && typeof base.field_types === "object" && !Array.isArray(base.field_types) ? base.field_types : {};
    const uniqueRules = Array.isArray(base.unique_rules) ? base.unique_rules.filter((item) => item && typeof item === "object") : [];
    const baseValidators = Array.isArray(base.validators) ? base.validators : [];
    const autoSemantics = readAutoSemanticRules(base);
    const formulaRegistry = Array.isArray(base.formula_registry) ? base.formula_registry.filter((item) => item && typeof item === "object") : [];
    const physicsRulebook =
      base.physics_rulebook && typeof base.physics_rulebook === "object" && !Array.isArray(base.physics_rulebook)
        ? base.physics_rulebook
        : {};

    const validators = [
      ...stripGridSemanticValidators(baseValidators),
      ...buildGridSemanticValidators(gridColumnModes),
    ];

    setGridContractBusy(true);
    setGridContractInfo("");
    setError("");
    try {
      const response = await apiFetch(buildTableContractUrl(API_BASE, selectedTableId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galaxy_id: galaxy.id,
          required_fields: requiredFields,
          field_types: fieldTypes,
          unique_rules: uniqueRules,
          validators,
          auto_semantics: autoSemantics,
          formula_registry: formulaRegistry,
          physics_rulebook: physicsRulebook,
        }),
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Table contract save failed");
        throw apiError;
      }
      const body = await response.json();
      setGridContractBase(body);
      setGridColumnModes(parseGridSemanticModes(body?.validators));
      setGridContractInfo("Semantika sloupcu ulozena.");
    } catch (saveError) {
      setError(saveError.message || "Table contract save failed");
    } finally {
      setGridContractBusy(false);
    }
  }, [galaxy?.id, gridColumnModes, gridContractBase, historicalMode, selectedTableId]);

  const getCellDraft = useCallback(
    (rowId, field, baseline) => {
      const key = `${rowId}::${field}`;
      if (Object.prototype.hasOwnProperty.call(gridDraft, key)) return gridDraft[key];
      return baseline;
    },
    [gridDraft]
  );

  const focusGridRow = useCallback(
    (rowId) => {
      const normalizedRowId = String(rowId || "").trim();
      if (!normalizedRowId) return;
      setGridSelectedRowId(normalizedRowId);
      const focused = focusMoonAcrossContext(normalizedRowId);
      if (!focused) {
        setError("Fokus selhal: vybrany Mesic uz neexistuje.");
      }
    },
    [focusMoonAcrossContext]
  );

  const captureGridStageSnapshot = useCallback(
    () => ({
      gridDraft: { ...gridDraft },
      gridChangeSet: Object.fromEntries(
        Object.entries(gridChangeSet).map(([key, value]) => [key, value && typeof value === "object" ? { ...value } : value])
      ),
      gridPendingExtinguishIds: { ...gridPendingExtinguishIds },
      gridSelectedRowId: String(gridSelectedRowId || ""),
      gridNewRows: gridNewRows.map((item) => ({
        ...item,
        metadata: { ...(item?.metadata || {}) },
      })),
      gridNewRowLabel,
      gridNewRowMetaKey,
      gridNewRowMetaValue,
      gridBatchInfo,
      gridBatchPreview,
    }),
    [
      gridBatchInfo,
      gridBatchPreview,
      gridChangeSet,
      gridDraft,
      gridNewRowLabel,
      gridNewRowMetaKey,
      gridNewRowMetaValue,
      gridNewRows,
      gridPendingExtinguishIds,
      gridSelectedRowId,
    ]
  );

  const restoreGridStageSnapshot = useCallback((snapshotState) => {
    const snap = snapshotState && typeof snapshotState === "object" ? snapshotState : {};
    setGridDraft(snap.gridDraft && typeof snap.gridDraft === "object" ? snap.gridDraft : {});
    setGridChangeSet(snap.gridChangeSet && typeof snap.gridChangeSet === "object" ? snap.gridChangeSet : {});
    setGridPendingExtinguishIds(
      snap.gridPendingExtinguishIds && typeof snap.gridPendingExtinguishIds === "object" ? snap.gridPendingExtinguishIds : {}
    );
    setGridSelectedRowId(String(snap.gridSelectedRowId || ""));
    setGridNewRows(Array.isArray(snap.gridNewRows) ? snap.gridNewRows : []);
    setGridNewRowLabel(String(snap.gridNewRowLabel || ""));
    setGridNewRowMetaKey(String(snap.gridNewRowMetaKey || ""));
    setGridNewRowMetaValue(String(snap.gridNewRowMetaValue || ""));
    setGridBatchInfo(String(snap.gridBatchInfo || ""));
    setGridBatchPreview(snap.gridBatchPreview ?? null);
  }, []);

  const pushGridUndoSnapshot = useCallback(() => {
    gridUndoStackRef.current.push(captureGridStageSnapshot());
    setGridUndoCount(gridUndoStackRef.current.length);
  }, [captureGridStageSnapshot]);

  const handleUndoGridStage = useCallback(() => {
    const stack = gridUndoStackRef.current;
    if (!stack.length) return;
    const snapshotState = stack.pop();
    restoreGridStageSnapshot(snapshotState);
    setGridUndoCount(stack.length);
    setError("");
  }, [restoreGridStageSnapshot]);

  const stageGridCellChange = useCallback((rowId, column, baseline, nextValueRaw) => {
    const cellId = `${rowId}::${column}`;
    const nextValue = String(nextValueRaw ?? "");
    const baselineValue = String(baseline ?? "");
    const hadDraft = Object.prototype.hasOwnProperty.call(gridDraft, cellId);
    const hadChange = Object.prototype.hasOwnProperty.call(gridChangeSet, cellId);
    if (nextValue === baselineValue && !hadDraft && !hadChange) return;
    pushGridUndoSnapshot();
    setGridDraft((prev) => {
      if (nextValue === baselineValue) {
        if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
        const copy = { ...prev };
        delete copy[cellId];
        return copy;
      }
      return { ...prev, [cellId]: nextValue };
    });
    setGridChangeSet((prev) => {
      if (nextValue === baselineValue) {
        if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
        const copy = { ...prev };
        delete copy[cellId];
        return copy;
      }
      return {
        ...prev,
        [cellId]: {
          rowId: String(rowId),
          column: String(column),
          baseline: baselineValue,
          nextValue,
        },
      };
    });
    setGridBatchPreview(null);
    setGridBatchInfo("");
  }, [gridChangeSet, gridDraft, pushGridUndoSnapshot]);

  const clearGridUndoHistory = useCallback(() => {
    gridUndoStackRef.current = [];
    setGridUndoCount(0);
  }, []);

  const clearGridChangeSet = useCallback(({ resetUndo = false, pushUndo = true } = {}) => {
    const hasStagedWork = Boolean(
      Object.keys(gridChangeSet).length || gridNewRows.length || Object.keys(gridPendingExtinguishIds).length
    );
    if (hasStagedWork && pushUndo && !resetUndo) {
      pushGridUndoSnapshot();
    }
    setGridDraft({});
    setGridChangeSet({});
    setGridPendingExtinguishIds({});
    setGridSelectedRowId("");
    setGridNewRows([]);
    setGridNewRowLabel("");
    setGridNewRowMetaKey("");
    setGridNewRowMetaValue("");
    setGridBatchPreview(null);
    setGridBatchInfo("");
    if (resetUndo) {
      clearGridUndoHistory();
    }
  }, [clearGridUndoHistory, gridChangeSet, gridNewRows, gridPendingExtinguishIds, pushGridUndoSnapshot]);

  const handleAddGridNewRow = useCallback(() => {
    const label = gridNewRowLabel.trim();
    if (!label) {
      setError("Zadej nazev mesice pro novy radek.");
      return;
    }
    if (!selectedTable) {
      setError("Nejdriv vyber planetu/tabulku.");
      return;
    }
    const metadata = {};
    const field = gridNewRowMetaKey.trim();
    if (field) {
      metadata[field] = gridNewRowMetaValue.trim() || "1";
    }
    pushGridUndoSnapshot();
    setGridNewRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        label,
        metadata,
      },
    ]);
    setGridNewRowLabel("");
    setGridNewRowMetaKey("");
    setGridNewRowMetaValue("");
    setGridBatchPreview(null);
    setGridBatchInfo("");
    setError("");
  }, [gridNewRowLabel, gridNewRowMetaKey, gridNewRowMetaValue, pushGridUndoSnapshot, selectedTable]);

  const handleRemoveGridNewRow = useCallback((rowId) => {
    pushGridUndoSnapshot();
    setGridNewRows((prev) => prev.filter((item) => String(item.id) !== String(rowId)));
    setGridBatchPreview(null);
    setGridBatchInfo("");
  }, [pushGridUndoSnapshot]);

  const toggleGridPendingExtinguish = useCallback(
    (rowId) => {
      const normalizedRowId = String(rowId || "");
      if (!normalizedRowId || historicalMode) return;
      pushGridUndoSnapshot();
      setGridSelectedRowId(normalizedRowId);
      setGridPendingExtinguishIds((previous) => {
        const next = { ...previous };
        if (next[normalizedRowId]) {
          delete next[normalizedRowId];
        } else {
          next[normalizedRowId] = true;
        }
        return next;
      });
      setGridDraft((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => !key.startsWith(`${normalizedRowId}::`))
        )
      );
      setGridChangeSet((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([, change]) => String(change?.rowId || "") !== normalizedRowId)
        )
      );
      setGridBatchPreview(null);
      setGridBatchInfo("");
    },
    [historicalMode, pushGridUndoSnapshot]
  );

  const tableRowById = useMemo(
    () => new Map(tableRows.map((row) => [String(row.id), row])),
    [tableRows]
  );
  const rowFactIndexByRowId = useMemo(() => {
    const map = new Map();
    tableRows.forEach((row) => {
      const rowId = String(row?.id || "");
      if (!rowId) return;
      const facts = Array.isArray(row?.facts) ? row.facts : [];
      const factMap = new Map();
      facts.forEach((fact) => {
        const key = String(fact?.key || "").trim();
        if (!key) return;
        factMap.set(key, fact);
      });
      map.set(rowId, factMap);
    });
    return map;
  }, [tableRows]);
  const asteroidRowById = useMemo(
    () => new Map([...asteroidById.entries()]),
    [asteroidById]
  );
  const asteroidIdsByNormalizedLabel = useMemo(() => {
    const map = new Map();
    asteroidById.forEach((asteroid) => {
      const key = normalizeText(valueToLabel(asteroid.value));
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(String(asteroid.id));
    });
    return map;
  }, [asteroidById]);
  const gridChangeCount = useMemo(() => Object.keys(gridChangeSet).length, [gridChangeSet]);
  const gridExtinguishCount = useMemo(
    () => Object.keys(gridPendingExtinguishIds).length,
    [gridPendingExtinguishIds]
  );
  const gridHasStagedWork = gridChangeCount > 0 || gridNewRows.length > 0 || gridExtinguishCount > 0;
  const gridFieldTypes = useMemo(() => {
    const raw = gridContractBase?.field_types;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).map(([field, expected]) => [
        String(field),
        String(expected || "")
          .trim()
          .toLowerCase(),
      ])
    );
  }, [gridContractBase]);
  const gridValidation = useMemo(() => {
    const errorsByCell = {};
    const issues = [];

    const pushIssue = ({ cellId = "", message = "", kind = "VALIDATION", blocking = false, confidence = "likely" }) => {
      const text = String(message || "").trim();
      if (!text) return;
      const issue = {
        id: `${String(kind)}:${cellId || issues.length}:${text}`,
        cellId: String(cellId || ""),
        kind: String(kind || "VALIDATION"),
        message: text,
        blocking: Boolean(blocking),
        confidence: String(confidence || "likely"),
      };
      issues.push(issue);
      if (issue.cellId) {
        errorsByCell[issue.cellId] = issue.message;
      }
    };

    Object.values(gridChangeSet).forEach((change) => {
      const rowId = String(change?.rowId || "");
      const column = String(change?.column || "");
      if (!rowId || !column || column === "value") return;
      if (gridPendingExtinguishIds[rowId]) return;
      if (getGridColumnMode(column) !== "assign") return;
      const expected = gridFieldTypes[column];
      if (!expected) return;
      if (matchesGridExpectedType(expected, change.nextValue)) return;
      const cellId = `${rowId}::${column}`;
      const row = tableRowById.get(rowId);
      const rowLabel = valueToLabel(row?.value) || rowId;
      const message = `Hologram: '${column}' u '${rowLabel}' ceká ${expected}, ale je '${String(change.nextValue || "").trim() || "∅"}'.`;
      pushIssue({
        cellId,
        message,
        kind: "CONTRACT_FIELD_TYPE",
        blocking: true,
        confidence: "certain",
      });
    });

    gridNewRows.forEach((row) => {
      const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
      Object.entries(metadata).forEach(([field, nextValue]) => {
        const expected = gridFieldTypes[String(field)];
        if (!expected) return;
        if (matchesGridExpectedType(expected, nextValue)) return;
        pushIssue({
          message: `Hologram: novy radek '${row.label}' ma pole '${field}' v neplatnem typu (ceká ${expected}).`,
          kind: "CONTRACT_NEW_ROW_TYPE",
          blocking: true,
          confidence: "certain",
        });
      });
    });

    const blockingIssues = issues.filter(
      (issue) => issue.blocking && String(issue.confidence || "").toLowerCase() === "certain"
    );
    const warningIssues = issues.filter((issue) => !blockingIssues.includes(issue));

    return {
      errorsByCell,
      issues,
      messages: issues.map((issue) => issue.message),
      count: issues.length,
      blockingIssues,
      blockingCount: blockingIssues.length,
      warningCount: warningIssues.length,
    };
  }, [getGridColumnMode, gridChangeSet, gridFieldTypes, gridNewRows, gridPendingExtinguishIds, tableRowById]);

  useEffect(() => {
    const handleGridHotkeys = (event) => {
      if (historicalMode) return;
      const key = String(event.key || "");
      const tag = String(event.target?.tagName || "").toUpperCase();
      const editable =
        Boolean(event.target?.isContentEditable) || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!editable && (key === "Delete" || key === "Backspace") && gridSelectedRowId) {
        event.preventDefault();
        toggleGridPendingExtinguish(gridSelectedRowId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key.toLowerCase() === "z" && !editable) {
        event.preventDefault();
        handleUndoGridStage();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleGridHotkeys);
      return () => window.removeEventListener("keydown", handleGridHotkeys);
    }
    return undefined;
  }, [gridSelectedRowId, handleUndoGridStage, historicalMode, toggleGridPendingExtinguish]);

  useEffect(() => {
    if (!gridSelectedRowId) return;
    if (!tableRowById.has(String(gridSelectedRowId))) {
      setGridSelectedRowId("");
    }
  }, [gridSelectedRowId, tableRowById]);

  useEffect(() => {
    const rowIds = new Set([
      ...tableRows.map((row) => String(row.id)),
      ...Object.keys(gridGhostRows).map((id) => String(id)),
    ]);
    setGridDeletingRows((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([rowId]) => rowIds.has(String(rowId))));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [gridGhostRows, tableRows]);

  const resolveGridSemanticTarget = useCallback(
    (rawTarget) => {
      const candidate = String(rawTarget || "").trim();
      if (!candidate) return { id: null, error: "cil je prazdny" };

      if (UUID_RE.test(candidate)) {
        const byId = asteroidRowById.get(candidate);
        if (!byId) {
          return { id: null, error: `cil '${candidate}' neexistuje` };
        }
        return { id: String(byId.id), asteroid: byId };
      }

      const key = normalizeText(candidate);
      if (!key) return { id: null, error: "cil je prazdny" };
      const ids = asteroidIdsByNormalizedLabel.get(key) || [];
      if (!ids.length) {
        return { id: null, error: `cil '${candidate}' nebyl nalezen` };
      }
      if (ids.length > 1) {
        return {
          id: null,
          error: `cil '${candidate}' je nejednoznacny (${ids.length}x). Pouzij UUID.`,
        };
      }
      const asteroid = asteroidRowById.get(ids[0]) || null;
      return { id: ids[0], asteroid };
    },
    [asteroidIdsByNormalizedLabel, asteroidRowById]
  );

  const buildGridBatchTasks = useCallback(() => {
    const updatesByRow = new Map();
    const linkTasks = [];
    const linkKeys = new Set();
    const errors = [];
    const pendingExtinguishSet = new Set(Object.keys(gridPendingExtinguishIds));

    Object.values(gridChangeSet).forEach((change) => {
      const rowId = String(change?.rowId || "");
      const column = String(change?.column || "");
      if (!rowId || !column) return;
      if (pendingExtinguishSet.has(rowId)) return;
      const row = tableRowById.get(rowId);
      const semanticMode = column === "value" ? "assign" : getGridColumnMode(column);

      if (semanticMode !== "assign") {
        const bondType = semanticMode === "type" ? "TYPE" : "RELATION";
        const targets = splitSemanticTargets(change.nextValue);
        if (!targets.length) {
          errors.push(`Radek '${valueToLabel(row?.value) || rowId}', sloupec '${column}': chybi cil vazby.`);
          return;
        }
        targets.forEach((targetToken) => {
          const resolved = resolveGridSemanticTarget(targetToken);
          if (!resolved.id) {
            errors.push(`Radek '${valueToLabel(row?.value) || rowId}', sloupec '${column}': ${resolved.error}.`);
            return;
          }
          const sourceId = rowId;
          const targetId = String(resolved.id);
          if (sourceId === targetId) {
            errors.push(`Radek '${valueToLabel(row?.value) || rowId}', sloupec '${column}': nelze vazat mesic sam na sebe.`);
            return;
          }
          const key =
            bondType === "RELATION"
              ? `${bondType}:${[sourceId, targetId].sort().join("::")}`
              : `${bondType}:${sourceId}::${targetId}`;
          if (linkKeys.has(key)) return;
          linkKeys.add(key);
          linkTasks.push({
            action: "LINK",
            params: {
              source_id: sourceId,
              target_id: targetId,
              type: bondType,
            },
          });
        });
        return;
      }

      if (!updatesByRow.has(rowId)) {
        updatesByRow.set(rowId, {
          action: "UPDATE_ASTEROID",
          params: {
            asteroid_id: rowId,
            metadata: {},
            ...(Number.isInteger(row?.current_event_seq) ? { expected_event_seq: row.current_event_seq } : {}),
          },
        });
      }
      const item = updatesByRow.get(rowId);
      if (!item) return;
      const factIndex = rowFactIndexByRowId.get(rowId) || null;
      const fact = factIndex ? factIndex.get(column) || null : null;
      const factSource = String(fact?.source || (column === "value" ? "value" : "metadata"))
        .trim()
        .toLowerCase();
      if (factSource === "calculated") {
        errors.push(`Radek '${valueToLabel(row?.value) || rowId}', sloupec '${column}': vypocitane pole je jen pro cteni.`);
        return;
      }
      const coercedValue = coerceGridFactInputValue(change.nextValue, fact?.value_type);
      if (factSource === "value") {
        item.params.value = coercedValue;
        return;
      }
      item.params.metadata[column] = coercedValue;
    });

    const updateTasks = [...updatesByRow.values()].map((task) => {
      const metadata = task.params.metadata && Object.keys(task.params.metadata).length ? task.params.metadata : undefined;
      const nextParams = { ...task.params };
      if (!metadata) {
        delete nextParams.metadata;
      }
      return { ...task, params: nextParams };
    });

    const entityName = selectedSemantic?.entityName || "Souhvezdi";
    const planetName = selectedSemantic?.planetName || "Planeta";
    const selectedTableName = String(selectedTable?.name || "").trim();
    const targetTableName = selectedTableName || `${entityName} > ${planetName}`;
    const createTasks = gridNewRows.map((item) => ({
      action: "INGEST",
      params: {
        value: item.label,
        metadata: {
          ...(item.metadata || {}),
          table: targetTableName,
          table_name: targetTableName,
          table_id: String(selectedTableId || ""),
        },
      },
    }));

    const extinguishTasks = [...pendingExtinguishSet]
      .map((rowId) => {
        const row = tableRowById.get(String(rowId)) || asteroidRowById.get(String(rowId));
        if (!row) return null;
        return {
          action: "EXTINGUISH",
          params: {
            asteroid_id: String(rowId),
            ...(Number.isInteger(row?.current_event_seq) ? { expected_event_seq: row.current_event_seq } : {}),
          },
        };
      })
      .filter(Boolean);

    return {
      tasks: [...updateTasks, ...createTasks, ...linkTasks, ...extinguishTasks],
      errors,
    };
  }, [
    asteroidRowById,
    getGridColumnMode,
    gridChangeSet,
    gridNewRows,
    gridPendingExtinguishIds,
    rowFactIndexByRowId,
    resolveGridSemanticTarget,
    selectedTable,
    selectedTableId,
    selectedSemantic,
    tableRowById,
  ]);

  const gridSemanticLivePreview = useMemo(() => {
    const draft = buildGridBatchTasks();
    const tasks = Array.isArray(draft?.tasks) ? draft.tasks : [];
    const errors = Array.isArray(draft?.errors) ? draft.errors : [];
    const effects = [];
    const effectKeys = new Set();
    const knownTableNames = new Set(
      (Array.isArray(tables) ? tables : [])
        .map((table) => String(table?.name || "").trim())
        .filter(Boolean)
        .map((name) => normalizeSemanticToken(name))
    );
    const predictedTableNames = new Set();
    const autoSemanticRules = readAutoSemanticRules(gridContractBase);

    const pushEffect = (
      code,
      taskAction,
      reason,
      outputs = {},
      {
        severity = "info",
        confidence = "likely",
        because = "",
      } = {}
    ) => {
      const stableOutputs = outputs && typeof outputs === "object" ? outputs : {};
      const dedupeKey = `${String(code || "")}|${String(taskAction || "")}|${JSON.stringify(stableOutputs)}`;
      if (effectKeys.has(dedupeKey)) return;
      effectKeys.add(dedupeKey);
      effects.push({
        id: `local:${effects.length + 1}:${dedupeKey}`,
        timestamp: new Date().toISOString(),
        code: String(code || "").trim().toUpperCase(),
        severity,
        rule_id: "sem.preview.local",
        reason: String(reason || "").trim(),
        task_action: String(taskAction || "").trim().toUpperCase(),
        confidence: String(confidence || "likely"),
        because: String(because || "").trim(),
        outputs: stableOutputs,
      });
    };

    const markPotentialPlanet = (tableName, taskAction, reasonPrefix) => {
      const normalizedTableName = String(tableName || "").trim();
      if (!normalizedTableName) return;
      const key = normalizeSemanticToken(normalizedTableName);
      if (!key || knownTableNames.has(key) || predictedTableNames.has(key)) return;
      predictedTableNames.add(key);
      const semantic = splitEntityAndPlanetName({ name: normalizedTableName });
      pushEffect(
        "PLANET_INFERRED",
        taskAction,
        `${reasonPrefix} vznikne nova planeta '${semantic.planetName}'.`,
        {
          table_name: normalizedTableName,
          constellation_name: semantic.entityName,
          planet_name: semantic.planetName,
        },
        {
          confidence: "likely",
          because: "Tabulka zatim neni ve snapshotu nactena jako existujici planeta.",
        }
      );
    };

    const applyAutoSemantics = ({ value, metadata, asteroidId, taskAction }) => {
      let nextMetadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
      let currentTableName = deriveTableNameFromEvent(value, nextMetadata);
      let guard = 0;
      while (guard < 4) {
        guard += 1;
        let changed = false;
        for (const rule of autoSemanticRules) {
          if (!rule || typeof rule !== "object") continue;
          if (!Boolean(rule.enabled ?? true)) continue;
          if (normalizeSemanticToken(rule.kind) !== "bucket_by_metadata_value") continue;
          const field = String(rule.field || "").trim();
          if (!field) continue;
          const fieldValue = field === "value" ? value : nextMetadata[field];
          if (!semanticRuleMatchesValue(rule, fieldValue)) continue;
          const targetTableName = semanticRuleTargetTable(rule);
          if (!targetTableName) continue;
          if (normalizeSemanticToken(targetTableName) === normalizeSemanticToken(currentTableName)) continue;

          const fromTableName = currentTableName;
          nextMetadata = { ...nextMetadata, table: targetTableName, table_name: targetTableName };
          currentTableName = targetTableName;
          const semantic = splitEntityAndPlanetName({ name: targetTableName });
          pushEffect(
            "MOON_RECLASSIFIED",
            taskAction,
            `Predikce: pravidlo '${String(rule.id || field)}' presune radek do planety '${semantic.planetName}'.`,
            {
              asteroid_id: String(asteroidId || ""),
              from_table_name: fromTableName,
              to_table_name: targetTableName,
              constellation_name: semantic.entityName,
              planet_name: semantic.planetName,
            },
            {
              confidence: "likely",
              because: `Auto-semantika: pole '${field}' odpovida pravidlu bucket_by_metadata_value.`,
            }
          );
          markPotentialPlanet(
            targetTableName,
            taskAction,
            "Predikce auto-semantiky:"
          );
          changed = true;
          break;
        }
        if (!changed) break;
      }
      return { metadata: nextMetadata, tableName: currentTableName };
    };

    tasks.forEach((task) => {
      const action = String(task?.action || "").trim().toUpperCase();
      const params = task?.params && typeof task.params === "object" ? task.params : {};

      if (action === "INGEST") {
        const value = params.value;
        const metadata = params.metadata && typeof params.metadata === "object" ? params.metadata : {};
        const baseTableName = deriveTableNameFromEvent(value, metadata);
        pushEffect(
          "MOON_UPSERTED",
          action,
          `Predikce: vznikne nebo se synchronizuje radek '${valueToLabel(value)}'.`,
          { table_name: baseTableName },
          {
            confidence: "likely",
            because: "INGEST dela upsert; bez DB lock checku nelze lokalne odlisit create/reuse.",
          }
        );
        markPotentialPlanet(baseTableName, action, "Predikce:");
        applyAutoSemantics({ value, metadata, asteroidId: "", taskAction: action });
        return;
      }

      if (action === "UPDATE_ASTEROID") {
        const asteroidId = String(params.asteroid_id || "").trim();
        if (!asteroidId) return;
        const currentRow = tableRowById.get(asteroidId) || asteroidRowById.get(asteroidId) || null;
        const currentValue = Object.prototype.hasOwnProperty.call(params, "value")
          ? params.value
          : currentRow?.value;
        const currentMetadata = {
          ...safeMetadata(currentRow?.metadata),
          ...(params.metadata && typeof params.metadata === "object" ? params.metadata : {}),
        };
        const beforeTableName = deriveTableNameFromEvent(currentRow?.value, safeMetadata(currentRow?.metadata));
        const directNextTableName = deriveTableNameFromEvent(currentValue, currentMetadata);

        pushEffect("MOON_UPDATED", action, "Predikce: zmeni se data radku.", { asteroid_id: asteroidId }, {
          confidence: "certain",
          because: "Batch obsahuje explicitni UPDATE_ASTEROID task.",
        });
        if (normalizeSemanticToken(beforeTableName) !== normalizeSemanticToken(directNextTableName)) {
          const semantic = splitEntityAndPlanetName({ name: directNextTableName });
          pushEffect(
            "MOON_RECLASSIFIED",
            action,
            `Predikce: radek se presune do planety '${semantic.planetName}'.`,
            {
              asteroid_id: asteroidId,
              from_table_name: beforeTableName,
              to_table_name: directNextTableName,
              constellation_name: semantic.entityName,
              planet_name: semantic.planetName,
            },
            {
              confidence: "certain",
              because: "Zmena table/table_name je primo ve staged datech.",
            }
          );
          markPotentialPlanet(directNextTableName, action, "Predikce:");
        }
        applyAutoSemantics({
          value: currentValue,
          metadata: currentMetadata,
          asteroidId,
          taskAction: action,
        });
        return;
      }

      if (action === "LINK") {
        pushEffect(
          "BOND_CREATED",
          action,
          "Predikce: vznikne nova vazba nebo se pouzije existujici.",
          {
            source_id: String(params.source_id || ""),
            target_id: String(params.target_id || ""),
            type: String(params.type || "RELATION").toUpperCase(),
          },
          {
            confidence: "likely",
            because: "Executor muze nalezt uz existujici vazbu a jen ji reuse.",
          }
        );
        return;
      }

      if (action === "EXTINGUISH") {
        pushEffect(
          "MOON_EXTINGUISHED",
          action,
          "Predikce: radek bude zhasnut (soft delete).",
          { asteroid_id: String(params.asteroid_id || "") },
          {
            confidence: "certain",
            because: "Batch obsahuje explicitni EXTINGUISH task.",
          }
        );
      }
    });

    const summaryByCode = {};
    effects.forEach((effect) => {
      const code = String(effect?.code || "SEMANTIC_EFFECT");
      const current = summaryByCode[code] || { count: 0, confidence: "", topRank: -1 };
      const rank = semanticConfidenceRank(effect?.confidence);
      summaryByCode[code] = {
        count: Number(current.count || 0) + 1,
        confidence: rank > Number(current.topRank || -1) ? String(effect?.confidence || "") : String(current.confidence || ""),
        topRank: Math.max(Number(current.topRank || -1), rank),
      };
    });
    const summaryEntries = Object.entries(summaryByCode).map(([code, data]) => ({
      code,
      count: Number(data?.count || 0),
      confidence: String(data?.confidence || ""),
    }));

    return {
      tasksCount: tasks.length,
      errors,
      effects,
      summaryByCode,
      summaryEntries,
    };
  }, [asteroidRowById, buildGridBatchTasks, gridContractBase, tableRowById, tables]);

  const executeGridBatch = useCallback(async (mode) => {
    const normalizedMode = String(mode || "preview").toLowerCase();
    const isCommit = normalizedMode === "commit";
    if (isCommit && gridValidation.blockingCount) {
      const head = gridValidation.blockingIssues.slice(0, 2).map((item) => item.message).join(" | ");
      const suffix =
        gridValidation.blockingCount > 2 ? ` (+${gridValidation.blockingCount - 2} dalsi)` : "";
      setError(`Commit blokovan jistou kontraktovou chybou: ${head}${suffix}`);
      return;
    }
    const { tasks, errors } = buildGridBatchTasks();
    if (errors.length) {
      const detail = errors.slice(0, 2).join(" | ");
      const suffix = errors.length > 2 ? ` (+${errors.length - 2} dalsi)` : "";
      setError(`Grid semantic chyby: ${detail}${suffix}`);
      return;
    }
    if (!tasks.length) {
      setError("Changeset je prazdny. Uprav bunky, pridej radek nebo oznac radek ke zhasnuti.");
      return;
    }
    if (!galaxy?.id) {
      setError("Chybi aktivni galaxie.");
      return;
    }

    setGridBatchBusy(true);
    setError("");
    setGridBatchInfo("");
    try {
      const response = await apiFetch(`${API_BASE}/tasks/execute-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildTaskBatchPayload({
            tasks,
            mode: normalizedMode,
            galaxyId: galaxy.id,
            branchId: activeBranchId,
          })
        ),
      });
      if (!response.ok) {
        const apiError = await apiErrorFromResponse(response, "Batch execute failed");
        throw apiError;
      }
      const body = await response.json();
      const result = body?.result || {};
      const effects = Array.isArray(result?.semantic_effects) ? result.semantic_effects : [];
      setSemanticEffects(effects);
      setGridBatchPreview({
        mode: normalizedMode,
        tasks: Array.isArray(result.tasks) ? result.tasks.length : tasks.length,
        asteroids: Array.isArray(result.asteroids) ? result.asteroids.length : 0,
        bonds: Array.isArray(result.bonds) ? result.bonds.length : 0,
        semanticEffects: effects.length,
        semanticCodes: Object.entries(
          effects.reduce((acc, effect) => {
            const code = String(effect?.code || "SEMANTIC_EFFECT");
            acc[code] = Number(acc[code] || 0) + 1;
            return acc;
          }, {})
        )
          .map(([code, count]) => `${code} ${count}`)
          .slice(0, 4),
      });
      if (normalizedMode === "commit") {
        clearGridChangeSet({ resetUndo: true, pushUndo: false });
        await loadUniverse();
        setGridBatchInfo(`Commit OK: ${tasks.length} tasku zapsano atomicky.`);
      } else {
        setGridBatchInfo(`Preview OK: ${tasks.length} tasku je validnich pro commit.`);
      }
    } catch (batchError) {
      setError(batchError.message || "Batch execute failed");
    } finally {
      setGridBatchBusy(false);
    }
  }, [activeBranchId, buildGridBatchTasks, clearGridChangeSet, galaxy?.id, gridValidation, loadUniverse]);

  useEffect(() => {
    setGridBatchPreview(null);
  }, [gridChangeSet, gridNewRows, gridPendingExtinguishIds, selectedTableId]);

  useEffect(() => {
    if (!selectedTableId || !galaxy?.id) {
      setGridContractBase(null);
      setGridColumnModes({});
      setGridContractBusy(false);
      setGridContractInfo("");
      return;
    }
    loadGridContract({ silent: true });
  }, [galaxy?.id, loadGridContract, selectedTableId]);

  useEffect(() => {
    setGridDraft({});
    setGridChangeSet({});
    setGridPendingExtinguishIds({});
    setGridRemovedRowIds({});
    setGridDeletingRows({});
    setGridSavingCells({});
    setGridSearchQuery("");
    setGridShowGhostRows(false);
    setGridGhostRows({});
    setGridViewport({ scrollTop: 0, height: 420 });
    setGridSelectedRowId("");
    setGridNewRows([]);
    setGridNewRowLabel("");
    setGridNewRowMetaKey("");
    setGridNewRowMetaValue("");
    setGridBatchInfo("");
    setGridBatchPreview(null);
    setGridColumnModes({});
    setGridContractBase(null);
    setGridContractBusy(false);
    setGridContractInfo("");
    gridUndoStackRef.current = [];
    setGridUndoCount(0);
  }, [selectedTableId]);

  useEffect(() => {
    if (!quickGridOpen) return undefined;
    const node = quickGridScrollRef.current;
    if (!node) return undefined;

    const syncViewport = () => {
      setGridViewport({
        scrollTop: node.scrollTop,
        height: node.clientHeight,
      });
    };
    syncViewport();
    node.addEventListener("scroll", syncViewport, { passive: true });
    if (typeof window !== "undefined") {
      window.addEventListener("resize", syncViewport);
    }
    return () => {
      node.removeEventListener("scroll", syncViewport);
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", syncViewport);
      }
    };
  }, [quickGridOpen, tableRows.length, gridDisplayColumns.length]);

  const focusByTarget = useCallback(
    (targetRaw) => {
      const targetText = normalizeText(targetRaw);
      if (!targetText) return false;

      const foundAsteroid = [...asteroidById.values()].find(
        (asteroid) => normalizeText(String(asteroid.id)) === targetText || normalizeText(valueToLabel(asteroid.value)) === targetText
      );
      if (foundAsteroid) {
        return focusMoonAcrossContext(foundAsteroid.id);
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
          setSelectedBondId("");
          focusTable({ tableId: node.id, cameraTarget: node.position, cameraDistance: 220 });
          return true;
        }
      }

      return false;
    },
    [asteroidById, focusMoonAcrossContext, focusTable, tableNodes, tables]
  );

  const executeParserCommand = useCallback(
    async (raw, { clearInput = false } = {}) => {
      const normalized = String(raw || "").trim();
      if (!normalized || busy) return false;
      if (historicalMode) {
        setError("Historicky mod je jen pro cteni.");
        return false;
      }
      const prepared = normalizeParserCommandInput(normalized);
      const command = prepared.command;

      setBusy(true);
      setError("");
      try {
        const response = await apiFetch(`${API_BASE}/parser/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildParserPayload(command, galaxy.id, activeBranchId)),
        });
        if (!response.ok) {
          const apiError = await apiErrorFromResponse(response, "Parser failed");
          if (isOccConflictError(apiError)) {
            await loadUniverse();
            throw new Error(buildOccConflictMessage(apiError, "parser execute"));
          }
          throw apiError;
        }
        const body = await response.json();
        const effects = Array.isArray(body?.semantic_effects) ? body.semantic_effects : [];
        setSemanticEffects(effects);
        if (clearInput) {
          setQuery("");
        }
        await loadUniverse();
        return true;
      } catch (commandError) {
        setError(buildParserErrorMessage(commandError, normalized, command));
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

  const commitGridCellLive = useCallback(
    async ({ row, column, nextValueRaw }) => {
      if (historicalMode) return;
      const rowId = String(row?.id || "").trim();
      const field = String(column || "").trim();
      if (!rowId || !field) return;
      if (gridCalculatedColumnSet.has(field)) {
        setError(`Pole '${field}' je vypoctene (ƒ) a je jen pro cteni.`);
        return;
      }

      const baseline = getRowBaselineValue(row, field);
      const nextValue = String(nextValueRaw ?? "");
      const baselineValue = String(baseline ?? "");
      const cellId = `${rowId}::${field}`;
      if (nextValue === baselineValue) {
        setGridDraft((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
        setGridChangeSet((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
        return;
      }

      const factIndex = rowFactIndexByRowId.get(rowId) || null;
      const fact = factIndex ? factIndex.get(field) || null : null;
      const factSource = String(fact?.source || (field === "value" ? "value" : "metadata"))
        .trim()
        .toLowerCase();
      if (factSource === "calculated") {
        setError(`Pole '${field}' je vypoctene (ƒ) a je jen pro cteni.`);
        return;
      }

      const coercedValue = coerceGridFactInputValue(nextValue, fact?.value_type);
      setGridDraft((prev) => ({ ...prev, [cellId]: nextValue }));
      setGridSavingCells((prev) => ({ ...prev, [cellId]: true }));
      setError("");
      try {
        if (factSource === "value" || field === "value") {
          await mutateAsteroid(rowId, { value: coercedValue });
        } else {
          await mutateAsteroid(rowId, { metadata: { [field]: coercedValue } });
        }
        setGridDraft((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
        setGridChangeSet((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
      } catch (cellError) {
        setGridDraft((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
        setError(cellError.message || "Ulozeni bunky selhalo.");
      } finally {
        setGridSavingCells((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
          const copy = { ...prev };
          delete copy[cellId];
          return copy;
        });
      }
    },
    [getRowBaselineValue, gridCalculatedColumnSet, historicalMode, mutateAsteroid, rowFactIndexByRowId]
  );

  const commitInspectorFact = useCallback(
    async ({ factKey, nextValueRaw, valueType }) => {
      if (historicalMode) return;
      const asteroidId = String(selectedAsteroid?.id || "").trim();
      const key = String(factKey || "").trim();
      if (!asteroidId || !key || RESERVED_METADATA_KEYS.has(key)) return;
      const coercedValue = coerceGridFactInputValue(nextValueRaw, valueType);
      setError("");
      try {
        if (key === "value") {
          await mutateAsteroid(asteroidId, { value: coercedValue });
        } else {
          await mutateAsteroid(asteroidId, { metadata: { [key]: coercedValue } });
        }
      } catch (inspectorError) {
        setError(inspectorError.message || "Ulozeni hodnoty selhalo.");
      }
    },
    [historicalMode, mutateAsteroid, selectedAsteroid]
  );

  const extinguishGridRowLive = useCallback(
    async (rowIdRaw) => {
      if (historicalMode) return;
      const rowId = String(rowIdRaw || "").trim();
      if (!rowId) return;
      const row = tableRowById.get(rowId);
      if (!row) return;
      const ghostSnapshot = {
        ...row,
        __ghost: true,
        deleted_at: new Date().toISOString(),
      };
      setGridGhostRows((prev) => ({ ...prev, [rowId]: ghostSnapshot }));
      setGridPendingExtinguishIds((prev) => ({ ...prev, [rowId]: true }));
      setGridDeletingRows((prev) => ({ ...prev, [rowId]: true }));
      setTimeout(() => {
        setGridRemovedRowIds((prev) => ({ ...prev, [rowId]: true }));
      }, 520);
      try {
        await extinguishAsteroid(rowId);
      } catch (rowError) {
        setGridPendingExtinguishIds((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, rowId)) return prev;
          const copy = { ...prev };
          delete copy[rowId];
          return copy;
        });
        setGridRemovedRowIds((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, rowId)) return prev;
          const copy = { ...prev };
          delete copy[rowId];
          return copy;
        });
        setGridGhostRows((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, rowId)) return prev;
          const copy = { ...prev };
          delete copy[rowId];
          return copy;
        });
        setError(rowError.message || "Zhasnuti radku selhalo.");
      } finally {
        setGridDeletingRows((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, rowId)) return prev;
          const copy = { ...prev };
          delete copy[rowId];
          return copy;
        });
      }
    },
    [extinguishAsteroid, historicalMode, tableRowById]
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
      selectBondInInspector(body?.id);
      await loadUniverse();
    },
    [activeBranchId, galaxy.id, loadUniverse, selectBondInInspector, snapshot.bonds]
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

  const pushCommandHistory = useCallback((rawCommand) => {
    const normalized = String(rawCommand || "").trim();
    if (!normalized) return;
    setCommandHistory((previous) => {
      if (previous.length && previous[previous.length - 1] === normalized) return previous;
      return [...previous, normalized].slice(-40);
    });
    setCommandHistoryCursor(-1);
    setCommandHistoryDraft("");
  }, []);

  const handleCommandInputChange = useCallback((event) => {
    setQuery(event.target.value);
    setCommandHistoryCursor(-1);
  }, []);

  const insertCommandExample = useCallback(
    (nextCommand) => {
      const normalized = String(nextCommand || "").trim();
      if (!normalized) return;
      setQuery(normalized);
      setError("");
      patchPanel("command", { collapsed: false });
      commandInputRef.current?.focus();
    },
    [patchPanel]
  );

  const handleCommandInputKeyDown = useCallback(
    (event) => {
      if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (!commandSuggestions.length) return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setCommandSuggestionCursor((prev) => {
          const max = commandSuggestions.length - 1;
          if (max < 0) return 0;
          const next = prev + direction;
          if (next < 0) return max;
          if (next > max) return 0;
          return next;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        if (!commandHistory.length) return;
        event.preventDefault();
        if (commandHistoryCursor === -1) {
          setCommandHistoryDraft(query);
          const nextIndex = commandHistory.length - 1;
          setCommandHistoryCursor(nextIndex);
          setQuery(commandHistory[nextIndex]);
          return;
        }
        const nextIndex = Math.max(0, commandHistoryCursor - 1);
        setCommandHistoryCursor(nextIndex);
        setQuery(commandHistory[nextIndex]);
        return;
      }
      if (event.key === "ArrowDown") {
        if (!commandHistory.length || commandHistoryCursor === -1) return;
        event.preventDefault();
        if (commandHistoryCursor >= commandHistory.length - 1) {
          setCommandHistoryCursor(-1);
          setQuery(commandHistoryDraft);
          return;
        }
        const nextIndex = commandHistoryCursor + 1;
        setCommandHistoryCursor(nextIndex);
        setQuery(commandHistory[nextIndex]);
        return;
      }
      if (event.key === "Tab") {
        if (!commandSuggestions.length) return;
        event.preventDefault();
        const safeIndex = Math.min(commandSuggestionCursor, commandSuggestions.length - 1);
        const suggestion = commandSuggestions[safeIndex];
        if (!suggestion) return;
        setQuery(suggestion.insert);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (query) {
          setQuery("");
          setCommandHistoryCursor(-1);
          setCommandHistoryDraft("");
          setCommandSuggestionCursor(0);
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        commandInputRef.current?.blur();
      }
    },
    [commandHistory, commandHistoryCursor, commandHistoryDraft, commandSuggestionCursor, commandSuggestions, query, showHelp]
  );

  const handleCommand = useCallback(
    async (event) => {
      event.preventDefault();
      const raw = query.trim();
      if (!raw || busy) return;

      const focusMatch = raw.match(/^(ukaz|ukaž|najdi)\s*:\s*(.+)$/i);
      if (focusMatch) {
        if (focusByTarget(focusMatch[2])) {
          pushCommandHistory(raw);
          setQuery("");
          return;
        }
        setError(`Nenalezeno: ${focusMatch[2]}`);
        return;
      }

      const quickToken = normalizeText(raw).replace(/\s+/g, "");
      if (quickToken === ":refresh") {
        await loadUniverse();
        pushCommandHistory(raw);
        setQuery("");
        return;
      }
      if (quickToken === ":galaxie" || quickToken === ":workspaces") {
        pushCommandHistory(raw);
        onBackToGalaxies?.();
        setQuery("");
        return;
      }
      if (quickToken === ":souhvezdi" || quickToken === ":back") {
        pushCommandHistory(raw);
        backToTables();
        setQuery("");
        return;
      }
      if (quickToken === ":help" || quickToken === "/help") {
        pushCommandHistory(raw);
        setHelpMode("quick");
        setShowHelp((prev) => !prev);
        setQuery("");
        return;
      }
      if (quickToken === "/grid") {
        if (!selectedTableId) {
          setError("Nejdriv vyber planetu/tabulku, pak otevri /grid.");
          return;
        }
        setQuickGridOpen(true);
        if (level >= 3 && !selectedAsteroidId) {
          focusFirstMoonInSelectedTable();
        }
        pushCommandHistory(raw);
        setQuery("");
        return;
      }
      if (quickToken === "/3d") {
        setQuickGridOpen(false);
        pushCommandHistory(raw);
        setQuery("");
        return;
      }

      if (historicalMode) {
        setError("Historicky mod je jen pro cteni.");
        return;
      }

      if (quickToken === "+novagalaxie" || quickToken === "+newgalaxy") {
        const suggestedName = `Nova galaxie ${new Date().toLocaleTimeString()}`;
        const enteredName =
          typeof window !== "undefined"
            ? window.prompt("Nazev nove galaxie:", suggestedName)
            : suggestedName;
        const name = String(enteredName || "").trim();
        if (!name) return;
        try {
          if (typeof onCreateGalaxy !== "function") {
            throw new Error("Vytvareni galaxie neni dostupne.");
          }
          await onCreateGalaxy(name);
          pushCommandHistory(raw);
          onBackToGalaxies?.();
          setQuery("");
        } catch (createError) {
          setError(createError.message || "Create galaxy failed");
        }
        return;
      }

      const success = await executeParserCommand(raw);
      if (success) {
        pushCommandHistory(raw);
        setQuery("");
      }
    },
    [
      backToTables,
      busy,
      executeParserCommand,
      focusByTarget,
      focusFirstMoonInSelectedTable,
      historicalMode,
      level,
      loadUniverse,
      onBackToGalaxies,
      onCreateGalaxy,
      pushCommandHistory,
      query,
      selectedAsteroidId,
      selectedTableId,
    ]
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
        selectBondInInspector(body?.id);
        await loadUniverse();
      } catch (linkError) {
        setError(linkError.message || "Link creation failed");
      }
    },
    [activeBranchId, galaxy.id, historicalMode, loadUniverse, selectBondInInspector, snapshot.asteroids]
  );

  const handleQuickCreate = useCallback(async () => {
    const entity = draftEntityName.trim();
    const planet = draftPlanetName.trim();
    const moon = draftMoonLabel.trim();
    if (!entity || !planet || !moon) {
      setError("Pro zalozeni vypln Souhvezdi, Planetu a Mesic.");
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
            setSelectedBondId("");
            focusTable({ tableId: table.id, cameraTarget: table.position, cameraDistance: 190 });
          }
        } else {
          const asteroid = asteroidNodes.find((node) => node.id === menu.id);
          if (asteroid) {
            setSelectedBondId("");
            focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 54 });
          }
        }
        return;
      }

      if (action === "back") {
        setSelectedBondId("");
        backToTables();
        return;
      }

      if (action === "edit") {
        const asteroid = asteroidNodes.find((node) => node.id === menu.id);
        if (asteroid) {
          setSelectedBondId("");
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

  const levelLabel = level >= 3 ? "L3: Mesice a Nerosty" : "L2: Souhvezdi a Planety";
  const selectedMoonLabel = selectedAsteroid ? valueToLabel(selectedAsteroid.value) : "";
  const selectedBondLabel = selectedBond ? `${formatBondTypeLabel(selectedBond.type)} ${selectedBond.directional ? "->" : "<->"}` : "";
  const hasAnyPlanet = hierarchyView.planets.length > 0;
  const hasAnyMoon = hierarchyView.indexes.moonById.size > 0;
  const hasMoonsInSelectedPlanet = tableRows.length > 0;
  const hasHierarchyIssues =
    hierarchyDiagnosticsSummary.orphans > 0 ||
    hierarchyDiagnosticsSummary.warnings > 0 ||
    hierarchyDiagnosticsSummary.droppedEdges > 0;
  const nextStepHint = hierarchyDiagnosticsSummary.orphans > 0
    ? `Mas ${hierarchyDiagnosticsSummary.orphans} sirotku bez planety. Nejdriv je oprav.`
    : !hasAnyPlanet
      ? "Zacni zalozenim prvni planety (tabulky)."
      : !selectedTableId
        ? "Vyber planetu kliknutim v prostoru nebo v panelu Planety."
        : !hasMoonsInSelectedPlanet
          ? "Tato planeta je prazdna. Zaloz prvni mesic (radek)."
          : !selectedAsteroid
            ? "Vyber mesic. Otevre se detail a editace bunek."
            : "Mas vybrany mesic. Pokracuj editaci v detailu nebo v tabulce.";
  const onboardingProgress = selectedAsteroid ? 3 : hasAnyMoon ? 2 : hasAnyPlanet ? 1 : 0;
  const primaryGuideAction = hierarchyDiagnosticsSummary.orphans > 0
    ? { key: "fix-orphans", label: "Opravit sirotky", helper: "Fokus na prvni sirotek" }
    : !hasAnyPlanet
      ? { key: "open-setup", label: "1) Otevrit setup", helper: "Panel Akce + sekce Rychle zalozeni" }
      : !selectedTableId
        ? { key: "pick-planet", label: "1) Vybrat planetu", helper: "Fokus na prvni planetu" }
        : !hasMoonsInSelectedPlanet
          ? { key: "open-setup", label: "2) Zalozit prvni mesic", helper: "Rychle zalozeni v panelu Akce" }
          : !selectedAsteroid
            ? { key: "pick-moon", label: "2) Vybrat prvni mesic", helper: "Autofokus v planete" }
            : { key: "open-grid", label: "3) Otevrit tabulku", helper: "Editace bunek in-place" };
  const focusCommandInput = useCallback(
    ({ selectAll = false } = {}) => {
      const input = commandInputRef.current;
      if (!input) return;
      input.focus();
      if (selectAll && typeof input.select === "function") {
        input.select();
      }
    },
    []
  );
  const handlePrimaryGuideAction = useCallback(() => {
    if (primaryGuideAction.key === "fix-orphans") {
      focusFirstOrphanMoon();
      return;
    }
    if (primaryGuideAction.key === "open-setup") {
      focusCommandInput();
      return;
    }
    if (primaryGuideAction.key === "pick-planet") {
      const firstTable = tableNodes[0];
      if (!firstTable) {
        patchPanel("planets", { collapsed: false });
        return;
      }
      setSelectedBondId("");
      focusTable({ tableId: firstTable.id, cameraTarget: firstTable.position, cameraDistance: 210 });
      return;
    }
    if (primaryGuideAction.key === "pick-moon") {
      focusFirstMoonInSelectedTable();
      return;
    }
    if (primaryGuideAction.key === "open-grid") {
      setQuery("/grid");
      focusCommandInput();
    }
  }, [focusCommandInput, focusFirstMoonInSelectedTable, focusFirstOrphanMoon, focusTable, patchPanel, primaryGuideAction.key, tableNodes]);
  const smartActions = useMemo(() => {
    return [
      { id: "next", label: primaryGuideAction.label, hint: primaryGuideAction.helper },
      { id: "command", label: "Prikaz", hint: "Otevre command line" },
      { id: "refresh", label: "Obnovit", hint: "Nacist data znovu" },
    ];
  }, [primaryGuideAction.helper, primaryGuideAction.label]);
  const runSmartAction = useCallback(
    async (actionId) => {
      if (actionId === "next") {
        handlePrimaryGuideAction();
        return;
      }
      if (actionId === "command") {
        focusCommandInput();
        return;
      }
      if (actionId === "refresh") {
        try {
          await loadUniverse();
        } catch (loadError) {
          setError(loadError.message || "Refresh failed");
        }
        return;
      }
    },
    [focusCommandInput, handlePrimaryGuideAction, loadUniverse]
  );
  useEffect(() => {
    const handleSmartActionHotkeys = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = String(event.key || "").toLowerCase();
      if (key !== "1" && key !== "2" && key !== "3") return;
      const target = event.target;
      const tag = String(target?.tagName || "").toUpperCase();
      const editable = Boolean(target?.isContentEditable) || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (editable) return;
      const index = Number(key) - 1;
      const selectedAction = smartActions[index];
      if (!selectedAction) return;
      event.preventDefault();
      void runSmartAction(selectedAction.id);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleSmartActionHotkeys);
      return () => window.removeEventListener("keydown", handleSmartActionHotkeys);
    }
    return undefined;
  }, [runSmartAction, smartActions]);
  const breadcrumbItems = [
    { key: "workspace", label: "Galaxie", value: galaxy?.name || "My Galaxy" },
    { key: "oblast", label: "Souhvezdi", value: selectedSemantic?.entityName || "Uncategorized" },
    { key: "planeta", label: "Planeta", value: selectedSemantic?.planetName || "Uncategorized" },
    ...(selectedMoonLabel ? [{ key: "mesic", label: "Mesic", value: selectedMoonLabel }] : []),
  ];
  const modelPrimer = "Model: Galaxie=workspace · Souhvezdi=skupiny · Planeta=tabulka · Mesic=radek · Nerost=bunka";
  const hierarchyStatusLabel = hasHierarchyIssues
    ? `${hierarchyDiagnosticsSummary.orphans} sirotku · ${hierarchyDiagnosticsSummary.warnings} varovani`
    : "Hierarchie OK";
  const hierarchyStatusColor = hasHierarchyIssues ? "#ffd2a1" : "#9ef5d7";
  const showGuidePanel = !quickGridOpen && (!selectedAsteroid && !selectedBond || hasHierarchyIssues || onboardingProgress < 3);
  const showDetailPanel = !quickGridOpen && (Boolean(selectedAsteroid) || Boolean(selectedBond) || onboardingProgress < 2 || hasHierarchyIssues);
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
  const semanticEffectsPreview = semanticEffects.slice(-6).reverse();
  const shellSurfaceStyle = {
    border: "1px solid rgba(96, 189, 223, 0.32)",
    background: "rgba(5, 13, 24, 0.82)",
    color: "#d9f8ff",
    backdropFilter: "blur(12px)",
    boxShadow: "0 0 24px rgba(34, 132, 182, 0.2)",
  };
  const shellHeaderPanelStyle = {
    ...shellSurfaceStyle,
    borderRadius: 14,
    padding: "10px 12px",
    display: "grid",
    gap: 8,
  };
  const shellSidePanelStyle = {
    ...shellSurfaceStyle,
    borderRadius: 12,
    padding: "10px 10px",
    display: "grid",
    gap: 10,
  };
  const quickActionCardStyle = {
    width: "100%",
    border: "1px solid rgba(111, 211, 243, 0.34)",
    borderRadius: 10,
    background: "rgba(8, 20, 34, 0.88)",
    color: "#e1f9ff",
    padding: "7px 9px",
    display: "grid",
    gap: 3,
    textAlign: "left",
    cursor: "pointer",
    transition: "border-color 160ms ease, background-color 160ms ease",
  };

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
        hideMouseGuide={focusUiMode}
        onSelectTable={(tableId) => {
          const table = tableNodes.find((node) => node.id === tableId);
          if (table) {
            setSelectedBondId("");
            focusTable({ tableId: table.id, cameraTarget: table.position, cameraDistance: 210 });
          }
        }}
        onSelectAsteroid={(asteroidId) => {
          const asteroid = asteroidNodes.find((node) => node.id === asteroidId);
          if (asteroid) {
            setSelectedBondId("");
            focusAsteroid({ asteroidId: asteroid.id, cameraTarget: asteroid.position, cameraDistance: 56 });
            patchPanel("inspector", { collapsed: false });
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
          selectBondInInspector(bondId);
        }}
      />

      <section
        ref={navigatorShellRef}
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 39,
          ...shellHeaderPanelStyle,
          width: "clamp(320px, calc(100vw - 560px), 820px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.86 }}>AXIOM NAVIGATOR</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={hudBadgeStyle}>{levelLabel}</span>
            <span style={{ ...hudBadgeStyle, color: hierarchyStatusColor }}>{hierarchyStatusLabel}</span>
            {loading ? <span style={{ ...hudBadgeStyle, color: "#9de7ff" }}>Nacitam...</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {breadcrumbItems.map((item, index) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
              }}
            >
              <span style={{ ...hudBadgeStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.label}: <strong>{item.value}</strong>
              </span>
              {index < breadcrumbItems.length - 1 ? (
                <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.5 }}>/</span>
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
          <span>Dalsi krok: {nextStepHint}</span>
          {selectedBondLabel ? <span>Vybrana vazba: {selectedBondLabel}</span> : null}
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>{modelPrimer}</div>
      </section>

      <div
        ref={topHudRef}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 39,
          ...shellHeaderPanelStyle,
          borderRadius: 12,
          padding: "7px 9px",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "flex-end",
          maxWidth: "min(520px, calc(100vw - 30px))",
        }}
      >
        <span style={hudBadgeStyle}>
          Workspace: <strong style={{ color: activeBranchId ? "#8affde" : "#d9f8ff" }}>{activeWorkspaceLabel}</strong>
        </span>
        {!historicalMode ? (
          <span
            style={{
              ...hudBadgeStyle,
              color: streamState === "LIVE" ? "#9affd7" : streamState === "RETRY" ? "#ffd58f" : "#9ec9ff",
            }}
          >
            Stream: {streamState}
          </span>
        ) : (
          <span style={{ ...hudBadgeStyle, color: "#ffd9a4" }}>Historicky rezim</span>
        )}
        <button type="button" onClick={() => focusCommandInput({ selectAll: true })} style={hudButtonStyle}>
          Prikaz
        </button>
        <button type="button" onClick={onBackToGalaxies} style={hudButtonStyle}>
          Galaxie
        </button>
        <button
          type="button"
          onClick={() =>
            setShowHelp((prev) => {
              const next = !prev;
              if (next) setHelpMode("quick");
              return next;
            })
          }
          style={hudButtonStyle}
        >
          Navod
        </button>
        <button
          type="button"
          onClick={onLogout}
          style={{ ...hudButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
        >
          Logout
        </button>
      </div>

      {showGuidePanel ? (
        <aside
          style={{
            position: "fixed",
            right: 14,
            top: shellTopOffset,
            zIndex: 43,
            width: "min(290px, calc(100vw - 26px))",
            maxHeight: `calc(100vh - ${shellTopOffset + 94}px)`,
            overflow: "auto",
            ...shellSidePanelStyle,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84, color: "#bdefff" }}>
            DALSI KROK
          </div>
          <button
            type="button"
            onClick={handlePrimaryGuideAction}
            style={{
              ...actionButtonStyle,
              width: "100%",
              textAlign: "left",
              background:
                primaryGuideAction.key === "fix-orphans"
                  ? "linear-gradient(120deg, #ffad67, #ffd7a8)"
                  : "linear-gradient(120deg, #53d6ff, #8be7ff)",
              color: "#04111f",
            }}
          >
            {primaryGuideAction.label}
          </button>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>{primaryGuideAction.helper}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              type="button"
              onClick={() => void runSmartAction("command")}
              style={quickActionCardStyle}
            >
              <span style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>2. Prikaz</span>
              <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>Otevri command line</span>
            </button>
            <button
              type="button"
              onClick={() => void runSmartAction("refresh")}
              style={quickActionCardStyle}
            >
              <span style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>3. Obnovit</span>
              <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>Nacti data znovu</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setHelpMode("quick");
              setShowHelp(true);
            }}
            style={{ ...ghostButtonStyle, width: "100%" }}
          >
            Otevrit navod
          </button>
        </aside>
      ) : null}

      {showDetailPanel ? (
        <aside
          style={{
            position: "fixed",
            left: 14,
            top: shellTopOffset,
            zIndex: 43,
            width: "min(430px, calc(100vw - 26px))",
            maxHeight: `calc(100vh - ${shellTopOffset + 94}px)`,
            ...shellSidePanelStyle,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84, color: "#bdefff" }}>
              DETAIL
            </div>
            {selectedAsteroid ? (
              <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>
                Nerosty {selectedEditableFacts.length}
              </span>
            ) : null}
          </div>

          {selectedAsteroid ? (
            <div style={{ display: "grid", gap: 8, minHeight: 0, overflow: "auto", paddingRight: 2 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: "var(--dv-fs-md)", fontWeight: 700 }}>{valueToLabel(selectedAsteroid.value) || "Mesic"}</div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>{selectedMoonContextLabel}</div>
                {selectedMoonV1 ? (
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                    Stav:{" "}
                    <strong style={{ color: resolveStatusColor(selectedMoonV1.status) }}>{selectedMoonV1.status}</strong>{" "}
                    ({selectedMoonV1.quality_score}/100)
                  </div>
                ) : null}
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.66, letterSpacing: "var(--dv-tr-wide)" }}>MESIC (NAZEV RADKU)</span>
                <input
                  key={`inspector:value:${selectedAsteroid.id}:${valueToLabel(selectedValueFact?.typed_value)}`}
                  defaultValue={valueToLabel(selectedValueFact?.typed_value ?? selectedAsteroid.value)}
                  onBlur={(event) =>
                    void commitInspectorFact({
                      factKey: "value",
                      nextValueRaw: event.target.value,
                      valueType: selectedValueFact?.value_type,
                    })
                  }
                  disabled={historicalMode}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.66, letterSpacing: "var(--dv-tr-wide)" }}>NEROSTY (BUNKY)</div>
                {inspectorVisibleFacts.map((fact) => {
                  const key = String(fact?.key || "");
                  const typedValue = fact?.typed_value;
                  return (
                    <label key={`inspector:${selectedAsteroid.id}:${key}`} style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>
                        {inferMineralGlyph(key, typedValue)} · {key}
                      </span>
                      <input
                        key={`inspector:value:${selectedAsteroid.id}:${key}:${valueToLabel(typedValue)}`}
                        defaultValue={valueToLabel(typedValue)}
                        onBlur={(event) =>
                          void commitInspectorFact({
                            factKey: key,
                            nextValueRaw: event.target.value,
                            valueType: fact?.value_type,
                          })
                        }
                        disabled={historicalMode}
                        style={inputStyle}
                      />
                    </label>
                  );
                })}
                {!selectedEditableFacts.length ? (
                  <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Mesic zatim nema editovatelne nerosty.</div>
                ) : null}
                {inspectorHiddenFactsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setInspectorShowAllFacts((prev) => !prev)}
                    style={ghostButtonStyle}
                  >
                    {inspectorShowAllFacts ? "Zobrazit mene" : `Zobrazit dalsi (${inspectorHiddenFactsCount})`}
                  </button>
                ) : null}
              </div>

              {selectedCalculatedFacts.length ? (
                <div
                  style={{
                    border: "1px solid rgba(97, 185, 218, 0.22)",
                    borderRadius: 8,
                    background: "rgba(8, 19, 34, 0.62)",
                    padding: "6px 7px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>ƒ VYPOCET (READ-ONLY)</div>
                  {selectedCalculatedFacts.slice(0, 3).map((fact) => (
                    <div key={`inspector:calc:${fact.key}`} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                      {fact.key}: {valueToLabel(fact.typed_value) || "—"}
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setQuickGridOpen(true)} style={ghostButtonStyle}>
                  Otevrit tabulku (/grid)
                </button>
                <button
                  type="button"
                  disabled={historicalMode}
                  onMouseEnter={() => setMoonDeleteHover(true)}
                  onMouseLeave={() => setMoonDeleteHover(false)}
                  onClick={() => extinguishAsteroid(selectedAsteroid.id).catch((extError) => setError(extError.message || "Soft delete failed"))}
                  style={{
                    ...ghostButtonStyle,
                    borderColor: moonDeleteHover ? "rgba(255, 116, 148, 0.58)" : "rgba(111, 192, 220, 0.28)",
                    color: moonDeleteHover ? "#ffd3df" : "#d7f6ff",
                    background: moonDeleteHover ? "rgba(68, 16, 28, 0.82)" : "rgba(7, 18, 32, 0.78)",
                  }}
                >
                  Zhasnout mesic
                </button>
              </div>
            </div>
          ) : selectedBond ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: "var(--dv-fs-md)", fontWeight: 700 }}>
                  Vazba {formatBondTypeLabel(selectedBond.type)} {selectedBond.directional ? "A→B" : "A↔B"}
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>
                  {selectedBondSourceLabel} → {selectedBondTargetLabel}
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84, color: "#9fe8ff" }}>{selectedBondMeaning}</div>
                {selectedBondV1 ? (
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                    Stav:{" "}
                    <strong style={{ color: resolveStatusColor(selectedBondV1.status) }}>{selectedBondV1.status}</strong>{" "}
                    ({selectedBondV1.quality_score}/100)
                  </div>
                ) : null}
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.66, letterSpacing: "var(--dv-tr-wide)" }}>TYP VAZBY</span>
                <select
                  value={bondEditorType}
                  onChange={(event) => setBondEditorType(event.target.value)}
                  disabled={historicalMode}
                  style={selectStyle}
                >
                  {QUICK_LINK_TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={historicalMode}
                  onClick={() => mutateBondType(selectedBond.id, bondEditorType).catch((mutError) => setError(mutError.message || "Bond mutate failed"))}
                  style={ghostButtonStyle}
                >
                  Ulozit typ
                </button>
                <button
                  type="button"
                  disabled={historicalMode}
                  onClick={() => extinguishBond(selectedBond.id).catch((extError) => setError(extError.message || "Bond soft delete failed"))}
                  style={{ ...ghostButtonStyle, borderColor: "rgba(255, 136, 166, 0.4)", color: "#ffc6d8" }}
                >
                  Zhasnout vazbu
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6, fontSize: "var(--dv-fs-sm)", opacity: 0.84 }}>
              <div>Klikni na Mesic nebo Vazbu.</div>
              <div>Mesic = radek tabulky, Nerost = bunka.</div>
              <div>Podrobnosti a editace se zobrazi tady.</div>
            </div>
          )}
        </aside>
      ) : null}

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 16,
          transform: "translateX(-50%)",
          zIndex: 42,
          width: "min(980px, calc(100vw - 26px))",
          ...shellHeaderPanelStyle,
          borderRadius: 14,
          padding: "10px 12px",
          display: "grid",
          gap: 8,
        }}
      >
        <form onSubmit={handleCommand} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 8, alignItems: "center" }}>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)", padding: "5px 8px" }}>&gt; cmd</span>
          <input
            ref={commandInputRef}
            value={query}
            onChange={handleCommandInputChange}
            onKeyDown={handleCommandInputKeyDown}
            onFocus={() => setCommandInputFocused(true)}
            onBlur={() => setCommandInputFocused(false)}
            disabled={busy}
            placeholder='Prikaz: /grid | /3d | :refresh | Ukaz : "Srouby"'
            style={{ ...inputStyle, fontSize: "var(--dv-fs-md)", padding: "8px 10px" }}
          />
          <button type="submit" disabled={busy} style={actionButtonStyle}>
            {busy ? "..." : "Run"}
          </button>
          <button type="button" onClick={() => setQuery("")} style={ghostButtonStyle}>X</button>
          <button type="button" onClick={() => setCommandDockExpanded((prev) => !prev)} style={ghostButtonStyle}>
            {commandDockExpanded ? "Mene" : "Vice"}
          </button>
        </form>
        {(commandInputFocused || Boolean(query.trim())) && commandSuggestions.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {commandSuggestions.slice(0, 6).map((item, index) => {
              const active = index === commandSuggestionCursor;
              return (
                <button
                  key={`cmd-suggestion:${item.key}`}
                  type="button"
                  onClick={() => {
                    setCommandSuggestionCursor(index);
                    insertCommandExample(item.insert);
                  }}
                  style={{
                    ...ghostButtonStyle,
                    padding: "4px 8px",
                    borderColor: active ? "rgba(120, 218, 251, 0.62)" : "rgba(107, 192, 223, 0.3)",
                    background: active ? "rgba(14, 42, 64, 0.92)" : "rgba(7, 18, 32, 0.9)",
                    color: active ? "#e4fbff" : "#cceef9",
                  }}
                  title={item.hint}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {commandDockExpanded ? (
          <div
            style={{
              fontSize: "var(--dv-fs-xs)",
              opacity: 0.82,
              borderTop: "1px solid rgba(96, 181, 211, 0.2)",
              paddingTop: 6,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>Mikro: Ctrl+K · / · Esc · Alt+↑/↓ · Tab</span>
            <span>
              Semantika: <strong>+</strong> vztah · <strong>:</strong> typ · <strong>:=</strong> hodnota · <strong>-&gt;</strong> tok · <strong>-</strong> soft delete
            </span>
          </div>
        ) : (
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>
            Enter = vykonat prikaz. Esc = vycistit / zavrit napovedu.
          </div>
        )}
        {error ? (
          <div
            style={{
              fontSize: "var(--dv-fs-sm)",
              color: "#ffb7c9",
              borderTop: "1px solid rgba(255, 134, 170, 0.22)",
              paddingTop: 6,
              lineHeight: "var(--dv-lh-base)",
            }}
          >
            {error}
          </div>
        ) : null}
        {semanticEffectsPreview.length ? (
          <div
            style={{
              borderTop: "1px solid rgba(96, 181, 211, 0.2)",
              paddingTop: 7,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.86 }}>
                PROC SE TO STALO
              </div>
              <button type="button" onClick={() => setSemanticEffects([])} style={{ ...ghostButtonStyle, padding: "4px 8px" }}>
                Vycistit
              </button>
            </div>
            <div style={{ display: "grid", gap: 5, maxHeight: 180, overflow: "auto", paddingRight: 2 }}>
              {semanticEffectsPreview.map((effect) => {
                const tone = semanticEffectTone(effect?.severity);
                const confidenceTone = semanticConfidenceTone(effect?.confidence);
                const confidenceLabel = semanticConfidenceLabel(effect?.confidence);
                const outputSummary = semanticEffectOutputSummary(effect);
                return (
                  <div
                    key={String(effect?.id || `${effect?.code}:${effect?.timestamp || ""}`)}
                    style={{
                      border: "1px solid rgba(108, 194, 225, 0.24)",
                      borderRadius: 9,
                      background: "rgba(7, 18, 32, 0.82)",
                      padding: "6px 7px",
                      display: "grid",
                      gap: 3,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ ...hudBadgeStyle, color: tone }}>{String(effect?.code || "SEMANTIC_EFFECT")}</span>
                      <span
                        style={{
                          ...hudBadgeStyle,
                          color: confidenceTone,
                          borderColor: "rgba(118, 205, 234, 0.38)",
                          background: "rgba(8, 22, 37, 0.92)",
                        }}
                      >
                        {confidenceLabel}
                      </span>
                      <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>{String(effect?.task_action || "")}</span>
                      {outputSummary ? (
                        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>{"->"} {outputSummary}</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>{String(effect?.reason || "")}</div>
                    {effect?.because ? (
                      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>proc: {String(effect.because)}</div>
                    ) : null}
                    {effect?.rule_id ? (
                      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.66 }}>rule: {String(effect.rule_id)}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {quickGridOpen ? (
        <section
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 58,
            width: "min(1320px, calc(100vw - 20px))",
            height: "min(84vh, 920px)",
            borderRadius: 14,
            border: "1px solid rgba(101, 194, 227, 0.38)",
            background: "rgba(4, 12, 24, 0.92)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 30px rgba(34, 136, 188, 0.24)",
            padding: 12,
            display: "grid",
            gridTemplateRows: "auto auto auto 1fr",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.7, letterSpacing: "var(--dv-tr-wide)" }}>
                Planeta / Tabulka
              </div>
              <div style={{ fontSize: "var(--dv-fs-xl)", fontWeight: 700 }}>{selectedSemantic?.planetName || "Tabulka"}</div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
                Kontext: {selectedSemantic?.entityName || "Uncategorized"} · radky {gridFilteredRows.length}/{tableRows.length}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" style={{ ...hudButtonStyle, background: "rgba(14, 40, 62, 0.92)" }}>
                Grid
              </button>
              <button type="button" onClick={() => setQuickGridOpen(false)} style={ghostButtonStyle}>
                3D Vesmír
              </button>
              <button type="button" disabled style={{ ...ghostButtonStyle, opacity: 0.52, cursor: "not-allowed" }}>
                Kanban (soon)
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: 8,
              alignItems: "center",
              border: "1px solid rgba(96, 186, 220, 0.22)",
              borderRadius: 10,
              background: "rgba(6, 18, 30, 0.52)",
              padding: "7px 8px",
            }}
          >
            <input
              value={gridSearchQuery}
              onChange={(event) => setGridSearchQuery(event.target.value)}
              placeholder="Filtr radku a bunek..."
              style={inputStyle}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
              <input
                type="checkbox"
                checked={gridShowGhostRows}
                onChange={(event) => setGridShowGhostRows(event.target.checked)}
              />
              Zobrazit duchy
            </label>
            <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              ƒ calc: {gridCalculatedColumns.length}
            </span>
            <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              live edit
            </span>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={gridNewRowLabel}
              onChange={(event) => setGridNewRowLabel(event.target.value)}
              placeholder="Novy mesic (radek)"
              disabled={historicalMode || gridBatchBusy}
              style={{ ...inputStyle, maxWidth: 280 }}
            />
            <input
              value={gridNewRowMetaKey}
              onChange={(event) => setGridNewRowMetaKey(event.target.value)}
              placeholder="Pole"
              disabled={historicalMode || gridBatchBusy}
              style={{ ...inputStyle, maxWidth: 180 }}
            />
            <input
              value={gridNewRowMetaValue}
              onChange={(event) => setGridNewRowMetaValue(event.target.value)}
              placeholder="Hodnota"
              disabled={historicalMode || gridBatchBusy}
              style={{ ...inputStyle, maxWidth: 220 }}
            />
            <button type="button" onClick={handleAddGridNewRow} disabled={historicalMode || gridBatchBusy} style={ghostButtonStyle}>
              + Radek
            </button>
            <button
              type="button"
              onClick={() => executeGridBatch("preview")}
              disabled={historicalMode || gridBatchBusy || !gridHasStagedWork}
              style={hudButtonStyle}
            >
              Preview batch
            </button>
            <button
              type="button"
              onClick={() => executeGridBatch("commit")}
              disabled={historicalMode || gridBatchBusy || !gridHasStagedWork || gridValidation.blockingCount > 0}
              style={actionButtonStyle}
            >
              Commit batch
            </button>
            <button type="button" onClick={handleUndoGridStage} disabled={gridBatchBusy || !gridUndoCount} style={ghostButtonStyle}>
              Undo
            </button>
            <button type="button" onClick={() => setQuickGridOpen(false)} style={ghostButtonStyle}>
              Zavrit (/3d)
            </button>
          </div>

          {gridBatchInfo ? <div style={{ fontSize: "var(--dv-fs-xs)", color: "#9ee8ff" }}>{gridBatchInfo}</div> : null}
          {gridHasStagedWork ? (
            <div
              style={{
                border: "1px solid rgba(104, 194, 226, 0.24)",
                borderRadius: 9,
                background: "rgba(8, 20, 34, 0.52)",
                padding: "6px 8px",
                display: "grid",
                gap: 5,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88, letterSpacing: "var(--dv-tr-medium)" }}>
                Semanticky plan (lokalni predikce)
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>
                Tasky: {gridSemanticLivePreview.tasksCount} · Efekty: {gridSemanticLivePreview.effects.length}
              </div>
              {gridValidation.count ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                  Validace: blokuje {gridValidation.blockingCount} · varovani {gridValidation.warningCount}
                </div>
              ) : null}
              {gridSemanticLivePreview.errors.length ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffbfd2", opacity: 0.92 }}>
                  Blokace: {gridSemanticLivePreview.errors.slice(0, 2).join(" | ")}
                  {gridSemanticLivePreview.errors.length > 2 ? ` (+${gridSemanticLivePreview.errors.length - 2})` : ""}
                </div>
              ) : null}
              {gridSemanticLivePreview.effects.length ? (
                <div style={{ display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(Array.isArray(gridSemanticLivePreview.summaryEntries) ? gridSemanticLivePreview.summaryEntries : [])
                    .slice(0, 6)
                    .map((entry) => (
                      <span
                        key={`live-preview:${entry.code}`}
                        style={{
                          ...hudBadgeStyle,
                          fontSize: "var(--dv-fs-2xs)",
                          borderColor: "rgba(121, 204, 234, 0.42)",
                          color: semanticConfidenceTone(entry.confidence),
                          background: "rgba(8, 23, 38, 0.9)",
                        }}
                      >
                        {entry.code} {entry.count} · {semanticConfidenceLabel(entry.confidence)}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 4, maxHeight: 72, overflow: "auto", paddingRight: 2 }}>
                    {gridSemanticLivePreview.effects.slice(0, 2).map((effect) => (
                      <div key={`quick-live:${effect.id}`} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>{effect.code}</span>
                        <span
                          style={{
                            ...hudBadgeStyle,
                            fontSize: "var(--dv-fs-2xs)",
                            color: semanticConfidenceTone(effect.confidence),
                            borderColor: "rgba(121, 204, 234, 0.42)",
                            background: "rgba(8, 23, 38, 0.9)",
                          }}
                        >
                          {semanticConfidenceLabel(effect.confidence)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>
                  Zatim pouze technicke zmeny bez semantickeho dopadu.
                </div>
              )}
            </div>
          ) : null}

          <div
            ref={quickGridScrollRef}
            style={{
              overflow: "auto",
              minHeight: 240,
              border: "1px solid rgba(96, 186, 220, 0.26)",
              borderRadius: 8,
              background: "rgba(5, 15, 27, 0.58)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 820 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      top: 0,
                      zIndex: 6,
                      width: 112,
                      background: "rgba(8, 18, 32, 0.98)",
                      color: "#cbeef8",
                      borderBottom: "1px solid rgba(95, 177, 207, 0.32)",
                      padding: "7px 8px",
                      textAlign: "left",
                      fontSize: "var(--dv-fs-2xs)",
                      letterSpacing: "var(--dv-tr-medium)",
                    }}
                  >
                    stav
                  </th>
                  {gridDisplayColumns.map((column) => (
                    <th
                      key={column}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: column === "value" ? 112 : undefined,
                        zIndex: column === "value" ? 5 : 4,
                        background: "rgba(8, 18, 32, 0.98)",
                        color: "#cbeef8",
                        borderBottom: "1px solid rgba(95, 177, 207, 0.32)",
                        padding: "7px 8px",
                        textAlign: "left",
                        fontSize: "var(--dv-fs-2xs)",
                        letterSpacing: "var(--dv-tr-medium)",
                        minWidth: column === "value" ? 220 : 160,
                      }}
                    >
                      {column === "value" ? "mesic" : column}
                      {gridCalculatedColumnSet.has(column) ? (
                        <span style={{ marginLeft: 6, opacity: 0.76, color: "#9ccbe0" }}>ƒ</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridVirtualWindow.topPad > 0 ? (
                  <tr>
                    <td colSpan={1 + gridDisplayColumns.length} style={{ height: gridVirtualWindow.topPad, border: "none", padding: 0 }} />
                  </tr>
                ) : null}
                {gridVirtualRows.map((row) => {
                  const rowId = String(row.id);
                  const rowPendingExtinguish = Boolean(gridPendingExtinguishIds[rowId]);
                  const rowDeleting = Boolean(gridDeletingRows[rowId]);
                  const rowSelected = String(gridSelectedRowId || "") === rowId;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        height: QUICK_GRID_ROW_HEIGHT,
                        outline: rowSelected ? "1px solid rgba(114, 214, 245, 0.45)" : "none",
                        background: rowPendingExtinguish ? "rgba(53, 20, 34, 0.36)" : "transparent",
                      }}
                    >
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                          background: rowPendingExtinguish ? "rgba(45, 18, 31, 0.95)" : "rgba(6, 18, 30, 0.95)",
                          padding: "4px 7px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            focusGridRow(row.id);
                            void extinguishGridRowLive(row.id);
                          }}
                          disabled={historicalMode || rowDeleting || rowPendingExtinguish}
                          style={{
                            ...ghostButtonStyle,
                            width: "100%",
                            padding: "4px 7px",
                            fontSize: "var(--dv-fs-2xs)",
                            borderColor: rowPendingExtinguish ? "rgba(255, 143, 171, 0.6)" : "rgba(108, 203, 236, 0.3)",
                            color: rowPendingExtinguish ? "#ffd2df" : "#cdefff",
                            background: rowPendingExtinguish ? "rgba(56, 17, 30, 0.9)" : "rgba(7, 18, 32, 0.9)",
                          }}
                        >
                          {rowPendingExtinguish ? (rowDeleting ? "Zhasina..." : "Duch") : "Zhasnout"}
                        </button>
                      </td>
                      {gridDisplayColumns.map((column) => {
                        const cellId = `${row.id}::${column}`;
                        const isCalculated = gridCalculatedColumnSet.has(column);
                        const baseline = isCalculated ? getCalculatedBaselineValue(row, column) : getRowBaselineValue(row, column);
                        const cellValue = isCalculated ? baseline : getCellDraft(row.id, column, baseline);
                        const isEditing = gridEditingCell === cellId && !isCalculated && !rowPendingExtinguish;
                        const isSaving = Boolean(gridSavingCells[cellId]);
                        const isStaged = Boolean(gridChangeSet[cellId]);
                        const isInvalid = Boolean(gridValidation.errorsByCell[cellId]);
                        return (
                          <td
                            key={`${row.id}:${column}`}
                            title={gridValidation.errorsByCell[cellId] || ""}
                            style={{
                              position: column === "value" ? "sticky" : "relative",
                              left: column === "value" ? 112 : undefined,
                              zIndex: column === "value" ? 2 : 1,
                              borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                              padding: "4px 7px",
                              background: rowPendingExtinguish
                                ? column === "value"
                                  ? "rgba(46, 18, 31, 0.95)"
                                  : "rgba(55, 18, 30, 0.38)"
                                : isCalculated
                                  ? column === "value"
                                    ? "rgba(8, 20, 34, 0.95)"
                                    : "rgba(19, 30, 44, 0.5)"
                                  : isInvalid
                                    ? "rgba(54, 131, 176, 0.26)"
                                    : isStaged
                                      ? "rgba(64, 161, 198, 0.16)"
                                      : column === "value"
                                        ? "rgba(7, 18, 30, 0.95)"
                                        : "transparent",
                            }}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                value={cellValue}
                                onFocus={() => focusGridRow(row.id)}
                                onChange={(event) => {
                                  const nextText = event.target.value;
                                  setGridDraft((prev) => ({ ...prev, [cellId]: nextText }));
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    setGridEditingCell("");
                                    setGridDraft((prev) => {
                                      const copy = { ...prev };
                                      delete copy[cellId];
                                      return copy;
                                    });
                                  }
                                  if (event.key === "Enter") event.currentTarget.blur();
                                }}
                                onBlur={(event) => {
                                  setGridEditingCell("");
                                  void commitGridCellLive({ row, column, nextValueRaw: event.target.value });
                                }}
                                disabled={historicalMode || rowPendingExtinguish || isSaving}
                                style={{
                                  width: "100%",
                                  border: isInvalid ? "1px solid rgba(120, 206, 247, 0.7)" : "1px solid rgba(106, 192, 223, 0.35)",
                                  background: "rgba(7, 18, 32, 0.9)",
                                  color: "#e0f8ff",
                                  borderRadius: 6,
                                  padding: "4px 6px",
                                  fontSize: "var(--dv-fs-sm)",
                                  boxSizing: "border-box",
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  focusGridRow(row.id);
                                  if (historicalMode || rowPendingExtinguish || isCalculated) return;
                                  setGridEditingCell(cellId);
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: rowPendingExtinguish ? "rgba(223, 248, 255, 0.58)" : isCalculated ? "#b7c9d8" : "#dff8ff",
                                  width: "100%",
                                  textAlign: "left",
                                  fontSize: "var(--dv-fs-sm)",
                                  padding: "3px 2px",
                                  cursor: historicalMode || rowPendingExtinguish || isCalculated ? "default" : "text",
                                  textDecoration: rowPendingExtinguish ? "line-through" : "none",
                                  opacity: rowPendingExtinguish ? 0.72 : 1,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {isCalculated ? <span style={{ opacity: 0.72 }}>ƒ</span> : null}
                                <span>{cellValue || "—"}</span>
                                {isSaving ? <span style={{ opacity: 0.7, fontSize: "var(--dv-fs-2xs)" }}>sync...</span> : null}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {gridVirtualWindow.bottomPad > 0 ? (
                  <tr>
                    <td colSpan={1 + gridDisplayColumns.length} style={{ height: gridVirtualWindow.bottomPad, border: "none", padding: 0 }} />
                  </tr>
                ) : null}
                {!gridFilteredRows.length ? (
                  <tr>
                    <td
                      colSpan={1 + gridDisplayColumns.length}
                      style={{
                        padding: "14px 10px",
                        color: "#b8d7e5",
                        fontSize: "var(--dv-fs-sm)",
                        opacity: 0.86,
                      }}
                    >
                      Žádné řádky pro aktuální filtr.
                    </td>
                  </tr>
                ) : null}
                {gridNewRows.map((item) => (
                  <tr key={item.id} style={{ background: "rgba(61, 151, 188, 0.14)" }}>
                    <td
                      style={{
                        borderBottom: "1px dashed rgba(108, 196, 227, 0.32)",
                        padding: "4px 7px",
                        fontSize: "var(--dv-fs-2xs)",
                        opacity: 0.88,
                      }}
                    >
                      nový
                    </td>
                    {gridDisplayColumns.map((column) => {
                      const value =
                        column === "value" ? item.label : valueToLabel(item.metadata?.[column] ?? "");
                      return (
                        <td
                          key={`${item.id}:${column}`}
                          style={{
                            borderBottom: "1px dashed rgba(108, 196, 227, 0.32)",
                            padding: "4px 7px",
                            color: "#cbecf8",
                            fontSize: "var(--dv-fs-sm)",
                            opacity: 0.9,
                          }}
                        >
                          {value || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showHelp ? (
        <section
          style={{
            position: "fixed",
            right: 14,
            top: shellTopOffset,
            zIndex: 59,
            width: "min(520px, calc(100vw - 26px))",
            maxHeight: `calc(100vh - ${shellTopOffset + 34}px)`,
            overflow: "auto",
            ...shellHeaderPanelStyle,
            borderRadius: 14,
            padding: 12,
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "var(--dv-fs-md)", fontWeight: 700 }}>Navod k ovladani</div>
            <button type="button" onClick={() => setShowHelp(false)} style={ghostButtonStyle}>Zavrit</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setHelpMode("quick")}
              style={{
                ...ghostButtonStyle,
                borderColor: helpMode === "quick" ? "rgba(120, 218, 251, 0.62)" : ghostButtonStyle.borderColor,
                background: helpMode === "quick" ? "rgba(14, 42, 64, 0.92)" : ghostButtonStyle.background,
              }}
            >
              Rychly navod
            </button>
            <button
              type="button"
              onClick={() => setHelpMode("full")}
              style={{
                ...ghostButtonStyle,
                borderColor: helpMode === "full" ? "rgba(120, 218, 251, 0.62)" : ghostButtonStyle.borderColor,
                background: helpMode === "full" ? "rgba(14, 42, 64, 0.92)" : ghostButtonStyle.background,
              }}
            >
              Kompletni navod
            </button>
          </div>

          {helpMode === "quick" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  border: "1px solid rgba(99, 189, 220, 0.23)",
                  borderRadius: 10,
                  background: "rgba(5, 15, 27, 0.58)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>1) Dalsi krok</div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>{primaryGuideAction.helper}</div>
                <button type="button" onClick={handlePrimaryGuideAction} style={actionButtonStyle}>
                  {primaryGuideAction.label}
                </button>
              </div>

              <div
                style={{
                  border: "1px solid rgba(99, 189, 220, 0.23)",
                  borderRadius: 10,
                  background: "rgba(5, 15, 27, 0.56)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>2) Zakladni prikazy</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { label: ":refresh", insert: ":refresh" },
                    { label: "/grid", insert: "/grid" },
                    { label: "/3d", insert: "/3d" },
                    { label: "Ukaz :", insert: "Ukaz : " },
                    { label: "+NovaGalaxie", insert: "+NovaGalaxie" },
                  ].map((item) => (
                    <button key={`help:quick:${item.label}`} type="button" onClick={() => insertCommandExample(item.insert)} style={ghostButtonStyle}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(99, 189, 220, 0.23)",
                  borderRadius: 10,
                  background: "rgba(5, 15, 27, 0.54)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 5,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>3) Semantika v kostce</div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
                  <strong>A + B</strong> vztah · <strong>A : Typ</strong> klasifikace · <strong>A.pole := hodnota</strong> zapis
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
                  <strong>A -&gt; B</strong> tok · <strong>- A</strong> soft delete
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 7 }}>
              <details open>
                <summary style={{ cursor: "pointer", fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Operator syntax (v2)</summary>
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {PARSER_OPERATOR_GUIDE.map((item) => (
                    <div key={item.key} style={{ border: "1px solid rgba(99, 189, 220, 0.23)", borderRadius: 8, padding: "6px 7px", background: "rgba(5, 15, 27, 0.58)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9fe8ff" }}>{item.syntax}</div>
                        <button type="button" onClick={() => insertCommandExample(item.example)} style={ghostButtonStyle}>Vlozit</button>
                      </div>
                      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{item.meaning}</div>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Legacy verby</summary>
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {PARSER_LEGACY_GUIDE.map((item) => (
                    <div key={item.key} style={{ border: "1px solid rgba(99, 189, 220, 0.2)", borderRadius: 8, padding: "6px 7px", background: "rgba(5, 15, 27, 0.52)" }}>
                      <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9fe8ff" }}>{item.syntax}</div>
                      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{item.meaning}</div>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Ovladaci playbook</summary>
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {CONTROL_PLAYBOOK.map((item) => (
                    <div key={item.key} style={{ border: "1px solid rgba(99, 189, 220, 0.2)", borderRadius: 8, padding: "6px 7px", background: "rgba(5, 15, 27, 0.5)", display: "grid", gap: 3 }}>
                      <div style={{ fontSize: "var(--dv-fs-xs)", fontWeight: 700 }}>{item.title}</div>
                      {item.steps.map((step) => (
                        <div key={`${item.key}:${step}`} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{step}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Workspace guide</summary>
                <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                  {WORKSPACE_GUIDE.map((item) => (
                    <div key={item} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{item}</div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </section>
      ) : null}

      {!focusUiMode ? (
        <>
      <FloatingPanel
        id="command"
        title={panels.command.title}
        config={panels.command}
        minimizedDockIndex={minimizedPanels.indexOf("command")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.8, marginBottom: 7 }}>
          Rozsirene akce. Hlavni prikazy zadavej do plovouci command line dole uprostred.
          Aliasy: <strong>:refresh</strong>, <strong>:galaxie</strong>, <strong>+NovaGalaxie</strong>, <strong>/grid</strong>, <strong>/3d</strong>.
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 7, flexWrap: "wrap" }}>
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
          <div style={guideTitleStyle}>PRVNI KROK (DOPORUCENO)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handlePrimaryGuideAction}
              style={{
                ...actionButtonStyle,
                background:
                  primaryGuideAction.key === "fix-orphans"
                    ? "linear-gradient(120deg, #ffad67, #ffd7a8)"
                    : "linear-gradient(120deg, #53d6ff, #8be7ff)",
                color: "#04111f",
              }}
            >
              {primaryGuideAction.label}
            </button>
            <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>{primaryGuideAction.helper}</span>
          </div>
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>SEMANTICKA DIAGNOSTIKA</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84, lineHeight: "var(--dv-lh-base)" }}>
            Jednoducha kontrola: kazdy Mesic ma patrit pod jednu Planetu. Kdyz ne, UI to ukaze jako SIROTEK.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={hudBadgeStyle}>Planety: {hierarchyView.planets.length}</span>
            <span style={hudBadgeStyle}>Mesice: {hierarchyView.indexes.moonById.size}</span>
            <span
              style={{
                ...hudBadgeStyle,
                color: hierarchyDiagnosticsSummary.orphans ? "#ffd2a1" : "#9fe8ff",
                borderColor: hierarchyDiagnosticsSummary.orphans ? "rgba(255, 176, 115, 0.5)" : hudBadgeStyle.borderColor,
              }}
            >
              Sirotci: {hierarchyDiagnosticsSummary.orphans}
            </span>
            <span
              style={{
                ...hudBadgeStyle,
                color: hierarchyDiagnosticsSummary.warnings ? "#ffd2a1" : "#9fe8ff",
                borderColor: hierarchyDiagnosticsSummary.warnings ? "rgba(255, 176, 115, 0.5)" : hudBadgeStyle.borderColor,
              }}
            >
              Varovani: {hierarchyDiagnosticsSummary.warnings}
            </span>
            <span
              style={{
                ...hudBadgeStyle,
                color: hierarchyDiagnosticsSummary.droppedEdges ? "#ffd2a1" : "#9fe8ff",
                borderColor: hierarchyDiagnosticsSummary.droppedEdges ? "rgba(255, 176, 115, 0.5)" : hudBadgeStyle.borderColor,
              }}
            >
              Ignorovane vazby: {hierarchyDiagnosticsSummary.droppedEdges}
            </span>
          </div>
          {hierarchyDiagnosticsSummary.orphans > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={focusFirstOrphanMoon} style={ghostButtonStyle}>
                Fokus prvni sirotek
              </button>
              <button type="button" onClick={() => patchPanel("moons", { collapsed: false })} style={ghostButtonStyle}>
                Otevrit panel Mesice
              </button>
            </div>
          ) : null}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>PARSER + SEMANTIKA (V2)</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84, lineHeight: "var(--dv-lh-base)" }}>
            Prakticka pravidla parseru a resolveru, ktera plati pro tento UI.
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {PARSER_RUNTIME_RULES.map((item) => (
              <div key={item} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86, lineHeight: "var(--dv-lh-base)" }}>
                - {item}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
            <div style={miniTitleStyle}>Operator syntax (native v2)</div>
            {PARSER_OPERATOR_GUIDE.map((item) => (
              <div
                key={item.key}
                style={{
                  border: "1px solid rgba(101, 193, 224, 0.22)",
                  borderRadius: 8,
                  background: "rgba(6, 17, 30, 0.58)",
                  padding: "6px 7px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ fontSize: "var(--dv-fs-sm)", color: "#9fe8ff" }}>{item.syntax}</code>
                  <button type="button" onClick={() => insertCommandExample(item.example)} style={ghostButtonStyle}>
                    Vlozit priklad
                  </button>
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{item.meaning}</div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>
                  Priklad: <code style={{ color: "#dff9ff" }}>{item.example}</code>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
            <div style={miniTitleStyle}>Legacy verby (kompatibilni ve v2)</div>
            {PARSER_LEGACY_GUIDE.map((item) => (
              <div
                key={item.key}
                style={{
                  border: "1px solid rgba(101, 193, 224, 0.2)",
                  borderRadius: 8,
                  background: "rgba(5, 15, 26, 0.54)",
                  padding: "6px 7px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ fontSize: "var(--dv-fs-sm)", color: "#9fe8ff" }}>{item.syntax}</code>
                  <button type="button" onClick={() => insertCommandExample(item.example)} style={ghostButtonStyle}>
                    Vlozit priklad
                  </button>
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>{item.meaning}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>PRESNE OVLADANI (klik + cmd)</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84, lineHeight: "var(--dv-lh-base)" }}>
            Jednoduche playbooky pro bezchybne ovladani od prvniho kroku.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {CONTROL_PLAYBOOK.map((item) => (
              <div
                key={item.key}
                style={{
                  border: "1px solid rgba(99, 189, 220, 0.23)",
                  borderRadius: 8,
                  background: "rgba(5, 15, 27, 0.58)",
                  padding: "6px 7px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", fontWeight: 700, letterSpacing: "var(--dv-tr-medium)", color: "#bdefff" }}>
                  {item.title}
                </div>
                {item.steps.map((step) => (
                  <div key={`${item.key}:${step}`} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86, lineHeight: "var(--dv-lh-base)" }}>
                    - {step}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {item.commands.map((command) => (
                    <button key={`${item.key}:${command}`} type="button" onClick={() => insertCommandExample(command)} style={ghostButtonStyle}>
                      {command}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>BRANCH / STAGING WORKFLOW</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8, lineHeight: "var(--dv-lh-base)" }}>
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
            {historicalMode ? <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.75 }}>Promote je v historical modu uzamcen.</div> : null}
          </div>
          {branchesLoading ? <div style={{ fontSize: "var(--dv-fs-xs)", color: "#9de7ff" }}>Nacitam branche...</div> : null}
          {branchesError ? <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffb7c9" }}>{branchesError}</div> : null}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>CSV IMPORT (PREVIEW / COMMIT)</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8, lineHeight: "var(--dv-lh-base)" }}>
            1) Vyber CSV soubor. 2) Zvol preview (bez zapisu) nebo commit (zapis). 3) Strict urcuje stop na prvni chybe.
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setImportFile(event.target.files?.[0] || null)}
            disabled={importDisabled}
            style={{ ...inputStyle, padding: "6px 8px", fontSize: "var(--dv-fs-sm)" }}
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
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--dv-fs-sm)", opacity: 0.88 }}>
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
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
              Soubor: <strong>{importFile.name}</strong>
            </div>
          ) : (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>Soubor zatim neni vybran.</div>
          )}
          {importInfo ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9de7ff" }}>{importInfo}</div> : null}
          {lastImportJob ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
              Job {lastImportJob.id} · mode {lastImportJob.mode} · status {lastImportJob.status}
            </div>
          ) : null}
          {importErrors.length ? (
            <div style={{ display: "grid", gap: 4 }}>
              {importErrors.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: "var(--dv-fs-xs)",
                    border: "1px solid rgba(255, 148, 176, 0.28)",
                    borderRadius: 8,
                    background: "rgba(42, 9, 19, 0.45)",
                    color: "#ffd4e0",
                    padding: "5px 7px",
                    lineHeight: "var(--dv-lh-base)",
                  }}
                >
                  Radek {item.row_number}: {item.message}
                </div>
              ))}
              {importErrors.length > 6 ? (
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>Zobrazeno 6/{importErrors.length} chyb.</div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>KDE CO UDELAS (bez vahani)</div>
          {WORKSPACE_GUIDE.map((item, index) => (
            <div key={item} style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.9, lineHeight: "var(--dv-lh-relaxed)" }}>
              {index + 1}) {item}
            </div>
          ))}
        </div>
        <div style={guideSectionStyle}>
          <div style={guideTitleStyle}>RYCHLE ZALOZENI (nove souhvezdi/planeta/mesic)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              value={draftEntityName}
              onChange={(event) => setDraftEntityName(event.target.value)}
              placeholder="Souhvezdi (oblast)"
              style={inputStyle}
              disabled={busy || historicalMode}
            />
            <input
              value={draftPlanetName}
              onChange={(event) => setDraftPlanetName(event.target.value)}
              placeholder="Planeta (tabulka)"
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
                  `${draftMoonLabel.trim() || "NovyMesic"} (table: ${draftEntityName.trim() || "Souhvezdi"} > ${
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
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78, marginBottom: 6 }}>
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
            <div style={miniTitleStyle}>Rychla vazba (Vztah / Typ / Tok dat / Kontrola)</div>
            <select value={quickLinkType} onChange={(event) => setQuickLinkType(event.target.value)} style={selectStyle}>
              {QUICK_LINK_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.direction})
                </option>
              ))}
            </select>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>{selectedQuickLinkTypeOption.description}</div>
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
        {error ? <div style={{ marginTop: 8, fontSize: "var(--dv-fs-sm)", color: "#ffb7c9" }}>{error}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="constellations"
        title={panels.constellations.title}
        config={panels.constellations}
        minimizedDockIndex={minimizedPanels.indexOf("constellations")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.82, marginBottom: 8 }}>
          Skupiny (Souhvezdi): oddeleni/oblasti jako Sklad, QA, Finance. Klikni a vstup do skupiny.
        </div>
        {constellationsLoading && !constellationPanelItems.length ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9de6ff" }}>Nacitam souhvezdi...</div>
        ) : null}
        {!constellationsLoading && !constellationPanelItems.length ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Zatim nejsou dostupna data souhvezdi.</div>
        ) : null}
        {!constellationsLoading && constellationPanelItems.length ? (
          <div style={{ display: "grid", gap: 7 }}>
            {constellationPanelItems.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    const node = item.focusNode;
                    if (!node) return;
                    setSelectedBondId("");
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
                  <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Planety {item.planetsCount} · Mesice {item.moonsCount}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.qualityScore}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {constellationsError ? <div style={{ marginTop: 8, fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{constellationsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="planets"
        title={panels.planets.title}
        config={panels.planets}
        minimizedDockIndex={minimizedPanels.indexOf("planets")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.82, marginBottom: 8 }}>
          Planety = tabulky. Klikni planetu a zobrazi se jeji mesice (radky).
        </div>
        {planetsLoading && !planetPanelItems.length ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9de6ff" }}>Nacitam planety...</div> : null}
        {!planetsLoading && !planetPanelItems.length ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Zatim nejsou dostupna data planet.</div>
        ) : null}
        {!planetsLoading && planetPanelItems.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {planetPanelItems.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const tableNode = item.tableNode;
              return (
                <button
                  key={`${item.tableId}`}
                  type="button"
                  onClick={() => {
                    if (!tableNode) return;
                    setSelectedBondId("");
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
                  <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    {item.constellationName} · Mesice {item.moonsCount} · Schema {item.schemaFieldsCount}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Formula {item.formulaFieldsCount} · Vazby {item.bondCount} · Rezim {item.sectorMode}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.qualityScore}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {planetsError ? <div style={{ marginTop: 8, fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{planetsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="moons"
        title={panels.moons.title}
        config={panels.moons}
        minimizedDockIndex={minimizedPanels.indexOf("moons")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.82, marginBottom: 8 }}>
          Mesice = radky tabulek. Oranzovy zaznam SIROTEK nema prirazenu planetu.
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74, marginBottom: 8 }}>
          Tip: klik na Mesic = fokus + otevreni detailu. Nejdriv oprav SIROTKY, pak teprve vazby.
        </div>
        {moonsLoading && !moonPanelItems.length ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9de6ff" }}>Nacitam mesice...</div> : null}
        {!moonsLoading && !moonPanelItems.length ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Zatim nejsou dostupna data mesicu.</div>
        ) : null}
        {!moonsLoading && moonPanelItems.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {moonPanelItems.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const canFocusMoon = asteroidById.has(String(item.asteroidId || ""));
              return (
                <button
                  key={`${item.asteroidId}`}
                  type="button"
                  onClick={() => {
                    setSelectedBondId("");
                    const focused = focusMoonAcrossContext(item.asteroidId, { showOrphanHint: item.isOrphan });
                    if (!focused) {
                      setError("Fokus selhal: Mesic neni dostupny v aktualnim snapshotu.");
                    }
                  }}
                  style={{
                    border: item.isOrphan ? "1px solid rgba(255, 176, 116, 0.45)" : "1px solid rgba(102, 196, 227, 0.28)",
                    borderRadius: 8,
                    background: item.isOrphan ? "rgba(41, 21, 8, 0.6)" : "rgba(6, 16, 30, 0.72)",
                    color: "#d8f6ff",
                    padding: "7px 8px",
                    textAlign: "left",
                    display: "grid",
                    gap: 3,
                    cursor: canFocusMoon ? "pointer" : "default",
                    opacity: canFocusMoon ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>
                    {item.label || "Mesic"} {item.isOrphan ? "• SIROTEK" : ""}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    {item.constellationName} / {item.planetName}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Metadata {item.metadataFieldsCount} · Formula {item.calculatedFieldsCount} · Alerty {item.activeAlertsCount}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.qualityScore}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {moonsError ? <div style={{ marginTop: 8, fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{moonsError}</div> : null}
      </FloatingPanel>

      <FloatingPanel
        id="bonds"
        title={panels.bonds.title}
        config={panels.bonds}
        minimizedDockIndex={minimizedPanels.indexOf("bonds")}
        hideCollapsedHandle
        onPatch={(panelId, patch) => patchPanel(panelId, patch)}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.82, marginBottom: 8 }}>
          Datovy tok mezi uzly. V1 kvalita je pocitana z alertu/cyklickych poli na koncovych mesicich.
        </div>
        {bondsV1Loading ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9de6ff" }}>Nacitam vazby...</div> : null}
        {!bondsV1Loading && !bondsV1.length ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Zatim nejsou dostupne vazby.</div>
        ) : null}
        {!bondsV1Loading && bondsV1.length ? (
          <div style={{ display: "grid", gap: 7, maxHeight: 290, overflowY: "auto", paddingRight: 2 }}>
            {bondsV1.map((item) => {
              const statusColor = resolveStatusColor(item.status);
              const sourceId = String(item.source_id || "");
              const targetId = String(item.target_id || "");
              const canFocusSource = asteroidById.has(sourceId);
              const canFocusTarget = asteroidById.has(targetId);
              const canFocusAny = canFocusSource || canFocusTarget;
              return (
                <button
                  key={`${item.bond_id}`}
                  type="button"
                  onClick={() => {
                    setSelectedBondId("");
                    const focused =
                      (canFocusSource && focusMoonAcrossContext(sourceId)) || (canFocusTarget && focusMoonAcrossContext(targetId));
                    if (!focused) {
                      setError("Fokus vazby selhal: zdroj ani cil neni dostupny v aktualnim snapshotu.");
                    }
                    selectBondInInspector(item.bond_id);
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
                    cursor: canFocusAny ? "pointer" : "default",
                    opacity: canFocusAny ? 1 : 0.7,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>
                    {formatBondTypeLabel(item.type)} · {item.directional ? "A→B" : "A↔B"}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    {item.source_label} → {item.target_label}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Alerty {item.active_alerts_count} · Cykly {item.circular_fields_count}
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                    Kvalita <strong style={{ color: statusColor }}>{item.status}</strong> ({item.quality_score}/100)
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        {bondsV1Error ? <div style={{ marginTop: 8, fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{bondsV1Error}</div> : null}
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
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>MESIC / ZAZNAM</div>
              <div style={{ marginTop: 3, fontSize: "var(--dv-fs-3xl)", fontWeight: 700 }}>{valueToLabel(selectedAsteroid.value)}</div>
              <div style={{ marginTop: 4, fontSize: "var(--dv-fs-sm)", opacity: 0.72 }}>{String(selectedAsteroid.id)}</div>
              {selectedMoonV1 ? (
                <div style={{ marginTop: 6, fontSize: "var(--dv-fs-sm)", opacity: 0.9 }}>
                  V1:{" "}
                  <strong style={{ color: resolveStatusColor(selectedMoonV1.status) }}>
                    {selectedMoonV1.status}
                  </strong>{" "}
                  ({selectedMoonV1.quality_score}/100) · Alerty {selectedMoonV1.active_alerts_count}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.62, letterSpacing: "var(--dv-tr-wide)" }}>BUNKY TEZBY (NEROSTY / SUROVINY)</div>
              {selectedEditableFacts.map((fact) => {
                const key = String(fact?.key || "");
                const value = fact?.typed_value;
                return (
                  <label
                    key={key}
                    style={{
                      display: "grid",
                      gap: 4,
                      borderBottom: "1px solid rgba(100, 184, 214, 0.24)",
                      paddingBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.62, letterSpacing: "var(--dv-tr-wide)" }}>
                      {inferMineralGlyph(key, value)} · {key}
                    </span>
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
                      style={{
                        border: "none",
                        borderBottom: "1px solid rgba(98, 177, 204, 0.32)",
                        borderRadius: 0,
                        background: "rgba(0, 0, 0, 0)",
                        color: "#ddf7ff",
                        padding: "5px 2px",
                        fontSize: "var(--dv-fs-md)",
                        outline: "none",
                      }}
                    />
                  </label>
                );
              })}
              {!selectedEditableFacts.length ? (
                <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.74 }}>Mesic zatim nema editovatelne fakty.</div>
              ) : null}
            </div>

            {selectedCalculatedFacts.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.62, letterSpacing: "var(--dv-tr-wide)" }}>
                  VYPOCTENE FAKTY (READ-ONLY)
                </div>
                {selectedCalculatedFacts.map((fact) => (
                  <div
                    key={`calc:${fact.key}`}
                    style={{
                      display: "grid",
                      gap: 2,
                      borderBottom: "1px solid rgba(100, 184, 214, 0.2)",
                      paddingBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.64, letterSpacing: "var(--dv-tr-wide)" }}>
                      ∑ · {fact.key}
                    </span>
                    <div style={{ fontSize: "var(--dv-fs-sm)", color: "#cfefff" }}>{valueToLabel(fact.typed_value) || "—"}</div>
                  </div>
                ))}
              </div>
            ) : null}

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
              onMouseEnter={() => setMoonDeleteHover(true)}
              onMouseLeave={() => setMoonDeleteHover(false)}
              onClick={() => extinguishAsteroid(selectedAsteroid.id).catch((extError) => setError(extError.message || "Soft delete failed"))}
              style={{
                ...ghostButtonStyle,
                borderColor: moonDeleteHover ? "rgba(255, 116, 148, 0.58)" : "rgba(111, 192, 220, 0.28)",
                color: moonDeleteHover ? "#ffd3df" : "#d7f6ff",
                background: moonDeleteHover ? "rgba(68, 16, 28, 0.82)" : "rgba(7, 18, 32, 0.78)",
                boxShadow: moonDeleteHover ? "0 0 16px rgba(240, 91, 131, 0.3)" : "none",
              }}
            >
              Zhasnout mesic (Soft Delete)
            </button>
          </div>
        ) : selectedBond ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>VAZBA / TOK</div>
              <div style={{ marginTop: 3, fontSize: "var(--dv-fs-2xl)", fontWeight: 700 }}>
                {formatBondTypeLabel(selectedBond.type)} · {selectedBond.directional ? "A→B" : "A↔B"}
              </div>
              <div style={{ marginTop: 4, fontSize: "var(--dv-fs-sm)", opacity: 0.72 }}>{String(selectedBond.id)}</div>
              <div style={{ marginTop: 4, fontSize: "var(--dv-fs-sm)", opacity: 0.84 }}>
                {selectedBondSourceLabel} → {selectedBondTargetLabel}
              </div>
              <div style={{ marginTop: 5, fontSize: "var(--dv-fs-sm)", opacity: 0.92, color: "#9fe8ff", lineHeight: "var(--dv-lh-base)" }}>
                Vyklad: {selectedBondMeaning}
              </div>
              {selectedBondV1 ? (
                <div style={{ marginTop: 6, fontSize: "var(--dv-fs-sm)", opacity: 0.9 }}>
                  V1:{" "}
                  <strong style={{ color: resolveStatusColor(selectedBondV1.status) }}>
                    {selectedBondV1.status}
                  </strong>{" "}
                  ({selectedBondV1.quality_score}/100)
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.68 }}>Typ vazby</div>
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
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>
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
          <div style={{ fontSize: "var(--dv-fs-md)", opacity: 0.78 }}>
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
        <div style={{ fontSize: "var(--dv-fs-lg)", fontWeight: 700, letterSpacing: "var(--dv-tr-medium)", marginBottom: 8 }}>
          {selectedSemantic?.planetName || "Planeta"}
        </div>
        <div
          style={{
            display: "grid",
            gap: 7,
            marginBottom: 8,
            border: "1px solid rgba(94, 178, 208, 0.24)",
            borderRadius: 8,
            background: "rgba(6, 17, 28, 0.52)",
            padding: 8,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(98, 182, 214, 0.26)",
              borderRadius: 8,
              background: "rgba(7, 18, 32, 0.5)",
              padding: 7,
              display: "grid",
              gap: 7,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.85, letterSpacing: "var(--dv-tr-medium)" }}>
                Semantika sloupcu: vyber, zda bunka upravuje hodnotu nebo vytvari vazbu.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={saveGridContract}
                  disabled={historicalMode || gridContractBusy || !selectedTableId || !gridSemanticDirty}
                  style={ghostButtonStyle}
                >
                  {gridContractBusy ? "..." : "Ulozit semantiku"}
                </button>
                <button
                  type="button"
                  onClick={() => loadGridContract({ silent: false })}
                  disabled={gridContractBusy || !selectedTableId}
                  style={hudButtonStyle}
                >
                  {gridContractBusy ? "..." : "Nacist kontrakt"}
                </button>
              </div>
            </div>

            {gridColumns.filter((column) => column !== "value").length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6 }}>
                {gridColumns
                  .filter((column) => column !== "value")
                  .map((column) => {
                    const mode = getGridColumnMode(column);
                    const modeMeta =
                      GRID_SEMANTIC_MODE_OPTIONS.find((item) => item.value === mode) || GRID_SEMANTIC_MODE_OPTIONS[0];
                    return (
                      <label key={`semantic:${column}`} style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>{column}</span>
                        <select
                          value={mode}
                          onChange={(event) => handleGridColumnModeChange(column, event.target.value)}
                          disabled={historicalMode || gridContractBusy}
                          style={selectStyle}
                        >
                          {GRID_SEMANTIC_MODE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.64 }}>{modeMeta.description}</span>
                      </label>
                    );
                  })}
              </div>
            ) : (
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.66 }}>Planeta zatim nema metadata sloupce.</div>
            )}
            {gridContractInfo ? <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86, color: "#9ee8ff" }}>{gridContractInfo}</div> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6 }}>
            <input
              value={gridNewRowLabel}
              onChange={(event) => setGridNewRowLabel(event.target.value)}
              placeholder="Novy mesic (radek)"
              disabled={historicalMode || gridBatchBusy}
              style={inputStyle}
            />
            <input
              value={gridNewRowMetaKey}
              onChange={(event) => setGridNewRowMetaKey(event.target.value)}
              placeholder="Pole (volitelne)"
              disabled={historicalMode || gridBatchBusy}
              style={inputStyle}
            />
            <input
              value={gridNewRowMetaValue}
              onChange={(event) => setGridNewRowMetaValue(event.target.value)}
              placeholder="Hodnota"
              disabled={historicalMode || gridBatchBusy}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handleAddGridNewRow}
              disabled={historicalMode || gridBatchBusy}
              style={ghostButtonStyle}
            >
              + Radek
            </button>
          </div>
          {gridNewRows.length ? (
            <div style={{ display: "grid", gap: 4 }}>
              {gridNewRows.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 6,
                    alignItems: "center",
                    border: "1px solid rgba(100, 182, 212, 0.2)",
                    borderRadius: 7,
                    background: "rgba(8, 20, 33, 0.62)",
                    padding: "4px 6px",
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.92 }}>
                    {item.label}
                    {Object.keys(item.metadata || {}).length ? ` (${Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""}
                  </div>
                  <button type="button" onClick={() => handleRemoveGridNewRow(item.id)} style={ghostButtonStyle}>
                    Odebrat
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
              Change Set: upravy bunek <strong>{gridChangeCount}</strong> · nove radky <strong>{gridNewRows.length}</strong> · staged zhasnuti <strong>{gridExtinguishCount}</strong> · undo <strong>{gridUndoCount}</strong>
            </span>
            <button
              type="button"
              onClick={() => executeGridBatch("preview")}
              disabled={historicalMode || gridBatchBusy || !gridHasStagedWork}
              style={hudButtonStyle}
            >
              {gridBatchBusy ? "..." : "Preview batch"}
            </button>
            <button
              type="button"
              onClick={() => executeGridBatch("commit")}
              disabled={historicalMode || gridBatchBusy || !gridHasStagedWork || gridValidation.blockingCount > 0}
              style={actionButtonStyle}
            >
              {gridBatchBusy ? "..." : "Commit batch"}
            </button>
            <button
              type="button"
              onClick={handleUndoGridStage}
              disabled={gridBatchBusy || !gridUndoCount}
              style={ghostButtonStyle}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => clearGridChangeSet()}
              disabled={gridBatchBusy || !gridHasStagedWork}
              style={ghostButtonStyle}
            >
              Zrusit lokalni zmeny
            </button>
          </div>
          {gridBatchInfo ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9ee8ff" }}>{gridBatchInfo}</div> : null}
          {gridValidation.count ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", color: "#86d9ff", opacity: 0.94 }}>
              Hologramy: {gridValidation.count} · blokuje {gridValidation.blockingCount} · varovani {gridValidation.warningCount}
              {gridValidation.messages[0] ? ` · ${gridValidation.messages[0]}` : ""}
            </div>
          ) : null}
          {gridHasStagedWork ? (
            <div
              style={{
                border: "1px solid rgba(103, 195, 228, 0.24)",
                borderRadius: 8,
                background: "rgba(7, 19, 33, 0.52)",
                padding: "6px 7px",
                display: "grid",
                gap: 5,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86, letterSpacing: "var(--dv-tr-medium)" }}>
                Semanticky plan (lokalni predikce)
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                Tasky: {gridSemanticLivePreview.tasksCount} · Efekty: {gridSemanticLivePreview.effects.length}
              </div>
              {gridValidation.count ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                  Validace: blokuje {gridValidation.blockingCount} · varovani {gridValidation.warningCount}
                </div>
              ) : null}
              {gridSemanticLivePreview.errors.length ? (
                <div style={{ fontSize: "var(--dv-fs-2xs)", color: "#ffbfd2" }}>
                  Blokace: {gridSemanticLivePreview.errors[0]}
                </div>
              ) : null}
              {gridSemanticLivePreview.effects.length ? (
                <div style={{ display: "grid", gap: 4, maxHeight: 110, overflow: "auto", paddingRight: 2 }}>
                  {gridSemanticLivePreview.effects.slice(0, 4).map((effect) => (
                    <div key={effect.id} style={{ display: "grid", gap: 2 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-2xs)" }}>{effect.code}</span>
                        <span
                          style={{
                            ...hudBadgeStyle,
                            fontSize: "var(--dv-fs-2xs)",
                            color: semanticConfidenceTone(effect.confidence),
                            borderColor: "rgba(121, 204, 234, 0.42)",
                            background: "rgba(8, 23, 38, 0.9)",
                          }}
                        >
                          {semanticConfidenceLabel(effect.confidence)}
                        </span>
                      </div>
                      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.86 }}>
                        {effect.reason}
                        {effect.because ? ` (${effect.because})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Bez semantickeho dopadu.</div>
              )}
            </div>
          ) : null}
          {gridBatchPreview ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
              Preview: tasks {gridBatchPreview.tasks} · asteroidy {gridBatchPreview.asteroids} · vazby {gridBatchPreview.bonds} · efekty{" "}
              {Number(gridBatchPreview.semanticEffects || 0)}
              {Array.isArray(gridBatchPreview.semanticCodes) && gridBatchPreview.semanticCodes.length
                ? ` (${gridBatchPreview.semanticCodes.join(", ")})`
                : ""}
            </div>
          ) : null}
        </div>
        <div
          style={{
            overflow: "auto",
            border: "1px solid rgba(96, 186, 220, 0.2)",
            borderRadius: 8,
            background: "rgba(6, 18, 30, 0.42)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
            <thead>
              <tr>
                <th
                  key="grid-status"
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "rgba(8, 18, 32, 0.58)",
                    color: "#cbeef8",
                    borderBottom: "1px solid rgba(95, 177, 207, 0.28)",
                    padding: "6px 8px",
                    textAlign: "left",
                    fontSize: "var(--dv-fs-2xs)",
                    letterSpacing: "var(--dv-tr-medium)",
                    width: 116,
                  }}
                >
                  stav
                </th>
                {gridColumns.map((column) => (
                  <th
                    key={column}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(8, 18, 32, 0.58)",
                      color: "#cbeef8",
                      borderBottom: "1px solid rgba(95, 177, 207, 0.28)",
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: "var(--dv-fs-2xs)",
                      letterSpacing: "var(--dv-tr-medium)",
                    }}
                  >
                    {column === "value" ? "mesic" : column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const rowId = String(row.id);
                const rowPendingExtinguish = Boolean(gridPendingExtinguishIds[rowId]);
                const rowSelected = String(gridSelectedRowId || "") === rowId;
                return (
                <tr
                  key={row.id}
                  style={{
                    outline: rowSelected ? "1px solid rgba(114, 214, 245, 0.55)" : "none",
                    background: rowPendingExtinguish ? "rgba(46, 15, 27, 0.28)" : "transparent",
                  }}
                >
                  <td
                    style={{
                      borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                      padding: "4px 7px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        focusGridRow(row.id);
                        toggleGridPendingExtinguish(row.id);
                      }}
                      disabled={historicalMode || gridBatchBusy}
                      style={{
                        ...ghostButtonStyle,
                        padding: "4px 8px",
                        fontSize: "var(--dv-fs-2xs)",
                        borderColor: rowPendingExtinguish ? "rgba(255, 132, 162, 0.56)" : "rgba(108, 203, 236, 0.28)",
                        color: rowPendingExtinguish ? "#ffd3df" : "#cdefff",
                        background: rowPendingExtinguish ? "rgba(56, 17, 30, 0.82)" : "rgba(7, 18, 32, 0.86)",
                      }}
                    >
                      {rowPendingExtinguish ? "Obnovit" : "Zhasnout"}
                    </button>
                  </td>
                  {gridColumns.map((column) => {
                    const cellId = `${row.id}::${column}`;
                    const isEditing = gridEditingCell === cellId;
                    const isStaged = Boolean(gridChangeSet[cellId]);
                    const isInvalid = Boolean(gridValidation.errorsByCell[cellId]);
                    const baseline = getRowBaselineValue(row, column);
                    const currentValue = getCellDraft(row.id, column, baseline);
                    return (
                      <td
                        key={`${row.id}:${column}`}
                        title={gridValidation.errorsByCell[cellId] || ""}
                        style={{
                          borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                          padding: "4px 7px",
                          background: rowPendingExtinguish
                            ? "rgba(55, 18, 30, 0.35)"
                            : isInvalid
                              ? "rgba(54, 131, 176, 0.26)"
                              : isStaged
                                ? "rgba(64, 161, 198, 0.16)"
                                : "transparent",
                        }}
                      >
                        {isEditing && !rowPendingExtinguish ? (
                          <input
                            autoFocus
                            value={currentValue}
                            onFocus={() => focusGridRow(row.id)}
                            onChange={(event) => {
                              setGridDraft((prev) => ({ ...prev, [cellId]: event.target.value }));
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setGridEditingCell("");
                                setGridDraft((prev) => {
                                  const copy = { ...prev };
                                  delete copy[cellId];
                                  return copy;
                                });
                                setGridChangeSet((prev) => {
                                  if (!Object.prototype.hasOwnProperty.call(prev, cellId)) return prev;
                                  const copy = { ...prev };
                                  delete copy[cellId];
                                  return copy;
                                });
                              }
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            onBlur={(event) => {
                              const nextValue = event.target.value;
                              setGridEditingCell("");
                              if (historicalMode) return;
                              stageGridCellChange(row.id, column, baseline, nextValue);
                            }}
                            disabled={historicalMode || rowPendingExtinguish}
                            style={{
                              width: "100%",
                              border: isInvalid ? "1px solid rgba(120, 206, 247, 0.7)" : "1px solid rgba(106, 192, 223, 0.35)",
                              background: isInvalid ? "rgba(12, 44, 66, 0.92)" : "rgba(7, 18, 32, 0.88)",
                              color: "#e0f8ff",
                              borderRadius: 6,
                              padding: "4px 6px",
                              fontSize: "var(--dv-fs-sm)",
                              boxShadow: isStaged ? "0 0 0 1px rgba(107, 210, 241, 0.35)" : "none",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (historicalMode || rowPendingExtinguish) return;
                              focusGridRow(row.id);
                              setGridEditingCell(cellId);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: rowPendingExtinguish ? "rgba(223, 248, 255, 0.58)" : "#dff8ff",
                              width: "100%",
                              textAlign: "left",
                              fontSize: "var(--dv-fs-sm)",
                              padding: "3px 2px",
                              cursor: historicalMode || rowPendingExtinguish ? "default" : "text",
                              textDecoration: rowPendingExtinguish ? "line-through" : "none",
                              opacity: rowPendingExtinguish ? 0.72 : 1,
                            }}
                          >
                            {currentValue || "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
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
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84, color: "#d8f6ff" }}>PANELOVY DOCK</div>
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
                fontSize: "var(--dv-fs-sm)",
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
        </>
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
            fontSize: "var(--dv-fs-sm)",
            lineHeight: "var(--dv-lh-base)",
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
  borderRadius: 9,
  border: "1px solid rgba(112, 205, 238, 0.24)",
  background: "rgba(4, 10, 18, 0.92)",
  color: "#ddf7ff",
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
};

const actionButtonStyle = {
  border: "1px solid rgba(114, 219, 252, 0.5)",
  background: "linear-gradient(120deg, #21bbea, #44d8ff)",
  color: "#072737",
  borderRadius: 10,
  padding: "8px 11px",
  fontWeight: 700,
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  boxShadow: "0 0 14px rgba(55, 178, 224, 0.2)",
  transition: "transform 120ms ease, box-shadow 180ms ease, filter 180ms ease",
};

const ghostButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease",
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
  fontSize: "var(--dv-fs-xs)",
  letterSpacing: "var(--dv-tr-wide)",
  fontWeight: 700,
  color: "#bdefff",
};

const miniTitleStyle = {
  fontSize: "var(--dv-fs-xs)",
  letterSpacing: "var(--dv-tr-medium)",
  opacity: 0.82,
  fontWeight: 700,
};

const selectStyle = {
  ...inputStyle,
  padding: "6px 8px",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(181, 236, 255, 0.78) 50%), linear-gradient(135deg, rgba(181, 236, 255, 0.78) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  paddingRight: 24,
};

const hudBadgeStyle = {
  border: "1px solid rgba(101, 191, 223, 0.3)",
  background: "rgba(8, 18, 31, 0.85)",
  color: "#d8f6ff",
  borderRadius: 999,
  padding: "4px 9px",
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  lineHeight: "var(--dv-lh-compact)",
};

const hudButtonStyle = {
  border: "1px solid rgba(109, 198, 228, 0.3)",
  background: "rgba(7, 16, 29, 0.85)",
  color: "#d7f7ff",
  borderRadius: 999,
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  padding: "5px 10px",
  cursor: "pointer",
  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease",
};
