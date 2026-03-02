import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE, apiFetch } from "./lib/dataverseApi";
import LandingDashboard from "./components/screens/LandingDashboard";
import GalaxySelector3D from "./components/screens/GalaxySelector3D";
import UniverseWorkspace from "./components/universe/UniverseWorkspace";
import { useAuth } from "./context/AuthContext.jsx";
import {
  GALAXY_CREATION_PRESETS,
  GALAXY_PURPOSE_OPTIONS,
  GALAXY_REGION_OPTIONS,
  GALAXY_TIMEZONE_OPTIONS,
} from "./lib/onboarding";
import { useUniverseStore } from "./store/useUniverseStore";

const SELECTED_GALAXY_STORAGE_KEY = "dataverse_selected_galaxy_id";

async function parseApiError(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail;
  } catch {
    // noop
  }
  return text;
}

const KNOWN_PRESET_KEYS = new Set(GALAXY_CREATION_PRESETS.map((item) => item.key));
const KNOWN_PURPOSE_KEYS = new Set(GALAXY_PURPOSE_OPTIONS.map((item) => item.key));
const KNOWN_REGION_KEYS = new Set(GALAXY_REGION_OPTIONS.map((item) => item.key));
const KNOWN_TIMEZONE_KEYS = new Set(GALAXY_TIMEZONE_OPTIONS.map((item) => item.key));

export default function App() {
  const { user, isAuthenticated, isLoading, login, register, logout, setDefaultGalaxy } = useAuth();
  const { selectedGalaxyId, selectGalaxy, setLevel } = useUniverseStore();

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [galaxies, setGalaxies] = useState([]);
  const [galaxyLoading, setGalaxyLoading] = useState(false);
  const [galaxyBusy, setGalaxyBusy] = useState(false);
  const [galaxyError, setGalaxyError] = useState("");
  const [newGalaxyName, setNewGalaxyName] = useState("");

  const selectedGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(selectedGalaxyId || "")) || null,
    [galaxies, selectedGalaxyId]
  );

  useEffect(() => {
    if (selectedGalaxyId) {
      localStorage.setItem(SELECTED_GALAXY_STORAGE_KEY, selectedGalaxyId);
    } else {
      localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
    }
  }, [selectedGalaxyId]);

  useEffect(() => {
    if (!isAuthenticated) {
      selectGalaxy("");
      setLevel(0);
      setGalaxies([]);
      return;
    }
    if (!selectedGalaxyId) {
      setLevel(1);
    }
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  const loadGalaxies = useCallback(async () => {
    if (!isAuthenticated) return;
    setGalaxyLoading(true);
    setGalaxyError("");
    try {
      const response = await apiFetch(`${API_BASE}/galaxies`);
      if (!response.ok) {
        throw new Error(await parseApiError(response, `Galaxies failed: ${response.status}`));
      }
      const body = await response.json();
      const live = Array.isArray(body) ? body.filter((item) => !item?.deleted_at) : [];
      setGalaxies(live);

      const hasSelected = selectedGalaxyId && live.some((item) => String(item.id) === String(selectedGalaxyId));
      if (selectedGalaxyId && !hasSelected) {
        selectGalaxy("");
        setLevel(1);
      }

      if (!hasSelected) {
        const next =
          (live.length === 1 ? live[0].id : "") ||
          "";
        if (next) {
          selectGalaxy(next);
          setLevel(2);
        } else {
          setLevel(1);
        }
      }
    } catch (error) {
      setGalaxyError(error.message || "Load galaxies failed");
    } finally {
      setGalaxyLoading(false);
    }
  }, [isAuthenticated, selectGalaxy, selectedGalaxyId, setLevel]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadGalaxies();
  }, [isAuthenticated, loadGalaxies]);

  const handleAuthLogin = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        await login(email, password);
        await loadGalaxies();
      } catch (error) {
        setAuthError(error.message || "Login failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [loadGalaxies, login]
  );

  const handleAuthRegister = useCallback(
    async (email, password) => {
      setAuthBusy(true);
      setAuthError("");
      try {
        await register(email, password);
        await loadGalaxies();
      } catch (error) {
        setAuthError(error.message || "Register failed");
      } finally {
        setAuthBusy(false);
      }
    },
    [loadGalaxies, register]
  );

  const seedGalaxyPreset = useCallback(async (galaxyId, rawPresetKey, rawPurposeKey = "general", profile = null) => {
    const presetKey = String(rawPresetKey || "blank").trim();
    const purposeKey = String(rawPurposeKey || "general").trim();
    if (!galaxyId || !presetKey) return;
    const defaults = {
      owner: String(profile?.owner || "").trim() || "unassigned",
      team: String(profile?.team || "").trim() || "core",
      region: String(profile?.region || "").trim() || "global",
      timezone: String(profile?.timezone || "").trim() || "UTC",
    };
    const withProfile = (metadata) => ({
      ...defaults,
      ...metadata,
    });

    const ingest = async (value, metadata) => {
      const response = await apiFetch(`${API_BASE}/asteroids/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, metadata, galaxy_id: galaxyId }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, `Seed ingest failed: ${response.status}`));
      }
      return response.json();
    };

    const link = async (sourceId, targetId, type) => {
      const response = await apiFetch(`${API_BASE}/bonds/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: sourceId,
          target_id: targetId,
          type,
          galaxy_id: galaxyId,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, `Seed link failed: ${response.status}`));
      }
      return response.json();
    };

    if (presetKey === "business") {
      const customer = await ingest("Klient ACME", withProfile({ table: "CRM > Kontakty", segment: "B2B" }));
      const lead = await ingest("Lead Q2 ACME", withProfile({ table: "Obchod > Pipeline", amount: "120000", stage: "discovery" }));
      const invoice = await ingest("Faktura INV-001", withProfile({ table: "Finance > Faktury", amount: "98000", due_days: "14" }));
      await link(customer.id, lead.id, "RELATION");
      await link(lead.id, invoice.id, "FLOW");
      return;
    }

    if (presetKey === "operations") {
      const item = await ingest("Sklad SKU-001", withProfile({ table: "Sklad > Stav", qty: "150", warehouse: "Praha" }));
      const order = await ingest("Objednavka ORD-001", withProfile({ table: "Provoz > Objednavky", qty: "20", priority: "high" }));
      const shipment = await ingest("Expedice SHP-001", withProfile({ table: "Provoz > Expedice", carrier: "DHL", status: "planned" }));
      await link(item.id, order.id, "FLOW");
      await link(order.id, shipment.id, "FLOW");
      return;
    }

    if (presetKey !== "blank") return;

    if (purposeKey === "finance") {
      await ingest("Cashflow leden", {
        ...withProfile({}),
        table: "Finance > Cashflow",
        revenue: "125000",
        cost: "87000",
        margin: "38000",
      });
      await ingest("Faktura INV-template", {
        ...withProfile({}),
        table: "Finance > Faktury",
        amount: "0",
        due_days: "30",
        status: "draft",
      });
      return;
    }

    if (purposeKey === "crm") {
      await ingest("Kontakt template", {
        ...withProfile({}),
        table: "CRM > Kontakty",
        segment: "B2B",
        source: "web",
      });
      await ingest("Lead template", {
        ...withProfile({}),
        table: "CRM > Pipeline",
        stage: "new",
        expected_value: "0",
        probability_pct: "10",
      });
      return;
    }

    if (purposeKey === "logistics") {
      const stock = await ingest("SKU-template", {
        ...withProfile({}),
        table: "Logistika > Sklad",
        qty: "0",
        warehouse: "central",
        reorder_level: "20",
      });
      const order = await ingest("OBJ-template", {
        ...withProfile({}),
        table: "Logistika > Objednavky",
        qty: "0",
        priority: "normal",
        status: "new",
      });
      await ingest("SHP-template", {
        ...withProfile({}),
        table: "Logistika > Expedice",
        carrier: "n/a",
        status: "planned",
        eta_days: "2",
      });
      await link(stock.id, order.id, "FLOW");
    }
  }, []);

  const createGalaxy = useCallback(
    async (rawName, options = null) => {
      const name = String(rawName || "").trim();
      if (!name) {
        throw new Error("Nazev galaxie je povinny.");
      }
      const requestedPreset = String(options?.preset || "blank").trim();
      const presetKey = KNOWN_PRESET_KEYS.has(requestedPreset) ? requestedPreset : "blank";
      const requestedPurpose = String(options?.purpose || "general").trim();
      const purposeKey = KNOWN_PURPOSE_KEYS.has(requestedPurpose) ? requestedPurpose : "general";
      const requestedRegion = String(options?.region || "global").trim();
      const regionKey = KNOWN_REGION_KEYS.has(requestedRegion) ? requestedRegion : "global";
      const requestedTimezone = String(options?.timezone || "UTC").trim();
      const timezoneKey = KNOWN_TIMEZONE_KEYS.has(requestedTimezone) ? requestedTimezone : "UTC";
      const owner = String(options?.owner || "").trim();
      const team = String(options?.team || "").trim();
      if (galaxyBusy) {
        throw new Error("Prave probiha jina akce. Zkus to za chvili.");
      }
      setGalaxyBusy(true);
      setGalaxyError("");
      try {
        let seedWarning = "";
        const response = await apiFetch(`${API_BASE}/galaxies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Create galaxy failed: ${response.status}`));
        }
        const created = await response.json();
        setDefaultGalaxy((prev) => prev || created);
        if (presetKey !== "blank" || purposeKey !== "general") {
          try {
            await seedGalaxyPreset(created?.id, presetKey, purposeKey, {
              owner,
              team,
              region: regionKey,
              timezone: timezoneKey,
            });
          } catch (seedError) {
            seedWarning = seedError.message || "seed failed";
          }
        }
        await loadGalaxies();
        if (seedWarning) {
          setGalaxyError(`Galaxie byla vytvorena, ale predvyplneni selhalo: ${seedWarning}`);
        }
        return created;
      } finally {
        setGalaxyBusy(false);
      }
    },
    [galaxyBusy, loadGalaxies, seedGalaxyPreset, setDefaultGalaxy]
  );

  const handleCreateGalaxy = useCallback(async (options = null) => {
    const name = newGalaxyName.trim();
    if (!name || galaxyBusy) return;
    try {
      const created = await createGalaxy(name, options);
      setNewGalaxyName("");
      if (created?.id) {
        selectGalaxy(created.id);
        setLevel(2);
      }
    } catch (error) {
      setGalaxyError(error.message || "Create galaxy failed");
    }
  }, [createGalaxy, galaxyBusy, newGalaxyName, selectGalaxy, setLevel]);

  const handleExtinguishGalaxy = useCallback(
    async (galaxyId) => {
      if (!galaxyId || galaxyBusy) return;
      setGalaxyBusy(true);
      setGalaxyError("");
      try {
        const response = await apiFetch(`${API_BASE}/galaxies/${galaxyId}/extinguish`, {
          method: "PATCH",
        });
        if (!response.ok) {
          throw new Error(await parseApiError(response, `Extinguish galaxy failed: ${response.status}`));
        }
        if (String(selectedGalaxyId) === String(galaxyId)) {
          selectGalaxy("");
          setLevel(1);
        }
        await loadGalaxies();
      } catch (error) {
        setGalaxyError(error.message || "Extinguish galaxy failed");
      } finally {
        setGalaxyBusy(false);
      }
    },
    [galaxyBusy, loadGalaxies, selectGalaxy, selectedGalaxyId, setLevel]
  );

  if (isLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#02050c",
          color: "#d8f8ff",
        }}
      >
        Ověřuji relaci...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LandingDashboard
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        busy={authBusy}
        error={authError}
      />
    );
  }

  if (!selectedGalaxy) {
    return (
      <GalaxySelector3D
        user={user}
        galaxies={galaxies}
        selectedGalaxyId={selectedGalaxyId}
        newGalaxyName={newGalaxyName}
        loading={galaxyLoading}
        busy={galaxyBusy}
        error={galaxyError}
        onSelect={(id) => {
          selectGalaxy(id);
          setLevel(2);
        }}
        onCreate={handleCreateGalaxy}
        onNameChange={setNewGalaxyName}
        onExtinguish={handleExtinguishGalaxy}
        onRefresh={loadGalaxies}
        onLogout={logout}
      />
    );
  }

  return (
    <UniverseWorkspace
      galaxy={selectedGalaxy}
      onCreateGalaxy={createGalaxy}
      onBackToGalaxies={() => {
        selectGalaxy("");
        setLevel(1);
      }}
      onLogout={logout}
    />
  );
}
