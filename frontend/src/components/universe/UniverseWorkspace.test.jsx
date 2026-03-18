import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./UniverseCanvas.jsx", () => ({
  default: ({ model, navigationModel, spaceObjects, onSelectObject, onApproachObject, onClearFocus }) => (
    <div data-testid="universe-canvas">
      <span data-testid="canvas-state">{model.state}</span>
      <span data-testid="canvas-nav-mode">{navigationModel.mode}</span>
      <span data-testid="canvas-selected-object">{navigationModel.selectedObjectId || "none"}</span>
      <span data-testid="canvas-object-count">{spaceObjects.length}</span>
      <button type="button" onClick={() => onSelectObject("star-core")}>
        select star
      </button>
      <button type="button" onClick={() => onApproachObject("star-core")}>
        approach star
      </button>
      <button type="button" onClick={onClearFocus}>
        clear focus
      </button>
    </div>
  ),
}));

vi.mock("./StarCoreInteriorScreen.jsx", () => ({
  default: ({
    screenModel,
    interiorModel,
    selectedConstitution,
    onSelectConstitution,
    onConfirmPolicyLock,
    onReturnToSpace,
  }) =>
    screenModel.isVisible ? (
      <div data-testid="star-core-interior-screen">
        <span data-testid="screen-stage">{screenModel.stage}</span>
        <span data-testid="screen-phase">{interiorModel.phase}</span>
        <span data-testid="screen-selected-constitution">{selectedConstitution?.id || "none"}</span>
        <button type="button" onClick={() => onSelectConstitution("rovnovaha")}>
          select constitution
        </button>
        <button type="button" data-testid="star-core-primary-action" onClick={onConfirmPolicyLock}>
          primary action
        </button>
        <button type="button" onClick={onReturnToSpace}>
          return to space
        </button>
      </div>
    ) : null,
}));

import UniverseWorkspace from "./UniverseWorkspace.jsx";

function createJsonResponse(payload, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

function mockWorkspaceFetch({
  policy = null,
  interior = null,
  physics = null,
  tables = { items: [] },
  runtime = { events_count: 0, writes_per_minute: 0 },
  pulse = { sampled_count: 0, events: [] },
  domainMetrics = { total_events_count: 0, domains: [] },
  policyError = null,
} = {}) {
  fetch.mockImplementation(async (input) => {
    const url = String(input || "");
    if (url.includes("/star-core/policy/lock")) {
      return createJsonResponse({ ok: true });
    }
    if (url.includes("/star-core/interior/entry/start")) {
      return createJsonResponse({
        interior_phase: "star_core_interior_entry",
        selected_constitution_id: null,
        available_constitutions: [
          {
            constitution_id: "rovnovaha",
            title_cz: "Rovnováha",
            summary_cz: "Stabilní režim",
            visual_tone: "balanced_blue",
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
            recommended: true,
            lock_allowed: true,
          },
        ],
        lock_ready: false,
        lock_blockers: [],
        lock_transition_state: "idle",
        first_orbit_ready: false,
        next_action: { action_key: "stabilize_core_entry", label_cz: "Stabilizuji vstup do Srdce hvězdy" },
        explainability: {
          headline_cz: "Vstup do Srdce hvězdy se stabilizuje.",
          body_cz: "Přechod do governance komory právě ustaluje vrstvy plazmy.",
        },
        source_truth: {
          profile_key: "ORIGIN",
          law_preset: "balanced",
          physical_profile_key: "BALANCE",
          physical_profile_version: 1,
        },
      });
    }
    if (url.includes("/star-core/interior/constitution/select")) {
      return createJsonResponse(
        interior || {
          interior_phase: "policy_lock_ready",
          selected_constitution_id: "rovnovaha",
          available_constitutions: [
            {
              constitution_id: "rovnovaha",
              title_cz: "Rovnováha",
              summary_cz: "Stabilní režim",
              visual_tone: "balanced_blue",
              profile_key: "ORIGIN",
              law_preset: "balanced",
              physical_profile_key: "BALANCE",
              physical_profile_version: 1,
              recommended: true,
              lock_allowed: true,
            },
          ],
          lock_ready: true,
          lock_blockers: [],
          lock_transition_state: "idle",
          first_orbit_ready: false,
          next_action: { action_key: "confirm_policy_lock", label_cz: "Potvrdit ústavu a uzamknout politiky" },
          explainability: { headline_cz: "Ústava je připravena k uzamčení", body_cz: "Můžeš pokračovat." },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
          },
        }
      );
    }
    if (url.includes("/star-core/interior")) {
      return createJsonResponse(
        interior || {
          interior_phase: "constitution_select",
          selected_constitution_id: null,
          available_constitutions: [
            {
              constitution_id: "rovnovaha",
              title_cz: "Rovnováha",
              summary_cz: "Stabilní režim",
              visual_tone: "balanced_blue",
              profile_key: "ORIGIN",
              law_preset: "balanced",
              physical_profile_key: "BALANCE",
              physical_profile_version: 1,
              recommended: true,
              lock_allowed: true,
            },
          ],
          lock_ready: false,
          lock_blockers: ["constitution_required"],
          lock_transition_state: "idle",
          first_orbit_ready: false,
          next_action: { action_key: "select_constitution", label_cz: "Vyber ústavu vesmíru" },
          explainability: {
            headline_cz: "Nejdřív vyber ústavu.",
            body_cz: "Dokud není potvrzen režim vesmíru, policy lock není připraven.",
          },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
          },
        }
      );
    }
    if (url.includes("/star-core/policy")) {
      if (policyError) {
        return {
          ok: false,
          status: policyError.status || 503,
          text: async () => JSON.stringify({ detail: policyError.detail || "service unavailable" }),
        };
      }
      return createJsonResponse(policy || {});
    }
    if (url.includes("/star-core/physics/profile")) return createJsonResponse(physics || {});
    if (url.includes("/star-core/runtime")) return createJsonResponse(runtime);
    if (url.includes("/star-core/pulse")) return createJsonResponse(pulse);
    if (url.includes("/star-core/metrics/domains")) return createJsonResponse(domainMetrics);
    if (url.includes("/universe/tables")) return createJsonResponse(tables);
    return createJsonResponse({ items: [] });
  });
}

describe("UniverseWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders explicit data_unavailable state when galaxy is missing", async () => {
    const { container } = render(<UniverseWorkspace />);

    expect(screen.getByTestId("workspace-reset-root")).toBeTruthy();
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(200);
    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("data_unavailable");
    });
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("renders pre-lock state from BE truth", async () => {
    mockWorkspaceFetch({
      policy: {
        profile_key: "ORIGIN",
        law_preset: "balanced",
        profile_mode: "auto",
        lock_status: "draft",
        policy_version: 1,
        locked_at: null,
        can_edit_core_laws: true,
      },
      physics: {
        galaxy_id: "g-1",
        profile_key: "BALANCE",
        profile_version: 1,
        lock_status: "draft",
        coefficients: { a: 0.12, b: 0.4 },
      },
      tables: {
        items: [
          {
            table_id: "t-1",
            planet_name: "Planeta A",
            constellation_name: "Orion",
            sector: { center: { x: 6, z: -2 }, size: 2 },
          },
        ],
      },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("star_core_unlocked");
    });
    expect(screen.getByTestId("canvas-object-count").textContent).toBe("2");
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("opens standalone interior screen and returns focus to Star Core", async () => {
    mockWorkspaceFetch({
      policy: {
        profile_key: "ORIGIN",
        law_preset: "balanced",
        profile_mode: "auto",
        lock_status: "draft",
        policy_version: 1,
        locked_at: null,
        can_edit_core_laws: true,
      },
      physics: {
        galaxy_id: "g-1",
        profile_key: "BALANCE",
        profile_version: 1,
        lock_status: "draft",
        coefficients: { a: 0.12, b: 0.4 },
      },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "select star" }));
    fireEvent.click(screen.getByRole("button", { name: "approach star" }));

    await waitFor(() => {
      expect(screen.getByTestId("star-core-interior-screen")).toBeTruthy();
      expect(screen.getByTestId("screen-stage").textContent).toBe("entering");
      expect(screen.getByTestId("screen-phase").textContent).toBe("star_core_interior_entry");
    });
    await waitFor(() => {
      expect(screen.getByTestId("screen-stage").textContent).toBe("active");
      expect(screen.getByTestId("screen-phase").textContent).toBe("constitution_select");
    });
    expect(screen.queryByTestId("galaxy-selection-hud")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "return to space" }));

    await waitFor(() => {
      expect(screen.queryByTestId("star-core-interior-screen")).toBeNull();
    });
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("object_selected");
    expect(screen.getByTestId("canvas-selected-object").textContent).toBe("star-core");
    expect(screen.getByTestId("galaxy-selection-hud")).toBeTruthy();
  });

  it("locks via canonical endpoint from interior screen", async () => {
    let lockSeen = false;
    let lockedInteriorReads = 0;

    fetch.mockImplementation(async (input, init) => {
      const url = String(input || "");
      if (url.includes("/star-core/policy/lock")) {
        lockSeen = true;
        const payload = JSON.parse(String(init?.body || "{}"));
        expect(payload.profile_key).toBe("ORIGIN");
        expect(payload.physical_profile_key).toBe("BALANCE");
        return createJsonResponse({ ok: true });
      }
      if (url.includes("/star-core/interior/entry/start")) {
        return createJsonResponse({
          interior_phase: "star_core_interior_entry",
          selected_constitution_id: null,
          available_constitutions: [
            {
              constitution_id: "rovnovaha",
              title_cz: "Rovnováha",
              summary_cz: "Stabilní režim",
              visual_tone: "balanced_blue",
              profile_key: "ORIGIN",
              law_preset: "balanced",
              physical_profile_key: "BALANCE",
              physical_profile_version: 1,
              recommended: true,
              lock_allowed: true,
            },
          ],
          lock_ready: false,
          lock_blockers: [],
          lock_transition_state: "idle",
          first_orbit_ready: false,
          next_action: { action_key: "stabilize_core_entry", label_cz: "Stabilizuji vstup do Srdce hvězdy" },
          explainability: {
            headline_cz: "Vstup do Srdce hvězdy se stabilizuje.",
            body_cz: "Přechod do governance komory právě ustaluje vrstvy plazmy.",
          },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
          },
        });
      }
      if (url.includes("/star-core/interior/constitution/select")) {
        return createJsonResponse({
          interior_phase: "policy_lock_ready",
          selected_constitution_id: "rovnovaha",
          available_constitutions: [
            {
              constitution_id: "rovnovaha",
              title_cz: "Rovnováha",
              summary_cz: "Stabilní režim",
              visual_tone: "balanced_blue",
              profile_key: "ORIGIN",
              law_preset: "balanced",
              physical_profile_key: "BALANCE",
              physical_profile_version: 1,
              recommended: true,
              lock_allowed: true,
            },
          ],
          lock_ready: true,
          lock_blockers: [],
          lock_transition_state: "idle",
          first_orbit_ready: false,
          next_action: { action_key: "confirm_policy_lock", label_cz: "Potvrdit ústavu a uzamknout politiky" },
          explainability: { headline_cz: "Ústava je připravena k uzamčení", body_cz: "Můžeš pokračovat." },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
          },
        });
      }
      if (url.includes("/star-core/interior")) {
        return createJsonResponse(
          lockSeen
            ? (lockedInteriorReads += 1) === 1
              ? {
                  interior_phase: "policy_lock_transition",
                  selected_constitution_id: "rovnovaha",
                  available_constitutions: [],
                  lock_ready: false,
                  lock_blockers: [],
                  lock_transition_state: "locked",
                  first_orbit_ready: true,
                  next_action: { action_key: "stabilize_first_orbit", label_cz: "Dokončuji přechod k první orbitě" },
                  explainability: {
                    headline_cz: "Politiky se fyzicky uzamykají.",
                    body_cz: "Governance prstenec dosedá do finální polohy.",
                  },
                  source_truth: {
                    profile_key: "ORIGIN",
                    law_preset: "balanced",
                    physical_profile_key: "BALANCE",
                    physical_profile_version: 1,
                  },
                }
              : {
                  interior_phase: "first_orbit_ready",
                  selected_constitution_id: "rovnovaha",
                  available_constitutions: [],
                  lock_ready: false,
                  lock_blockers: [],
                  lock_transition_state: "locked",
                  first_orbit_ready: true,
                  next_action: { action_key: "review_first_orbit", label_cz: "První oběžná dráha je připravena" },
                  explainability: {
                    headline_cz: "Politiky jsou uzamčeny.",
                    body_cz: "Governance základ je potvrzen.",
                  },
                  source_truth: {
                    profile_key: "ORIGIN",
                    law_preset: "balanced",
                    physical_profile_key: "BALANCE",
                    physical_profile_version: 1,
                  },
                }
            : {
                interior_phase: "constitution_select",
                selected_constitution_id: null,
                available_constitutions: [
                  {
                    constitution_id: "rovnovaha",
                    title_cz: "Rovnováha",
                    summary_cz: "Stabilní režim",
                    visual_tone: "balanced_blue",
                    profile_key: "ORIGIN",
                    law_preset: "balanced",
                    physical_profile_key: "BALANCE",
                    physical_profile_version: 1,
                    recommended: true,
                    lock_allowed: true,
                  },
                ],
                lock_ready: false,
                lock_blockers: ["constitution_required"],
                lock_transition_state: "idle",
                first_orbit_ready: false,
                next_action: { action_key: "select_constitution", label_cz: "Vyber ústavu vesmíru" },
                explainability: {
                  headline_cz: "Nejdřív vyber ústavu.",
                  body_cz: "Dokud není potvrzen režim vesmíru, policy lock není připraven.",
                },
                source_truth: {
                  profile_key: "ORIGIN",
                  law_preset: "balanced",
                  physical_profile_key: "BALANCE",
                  physical_profile_version: 1,
                },
              }
        );
      }
      if (url.includes("/star-core/policy")) {
        return createJsonResponse(
          lockSeen
            ? {
                profile_key: "ORIGIN",
                law_preset: "balanced",
                profile_mode: "locked",
                lock_status: "locked",
                policy_version: 2,
                locked_at: "2026-03-12T10:00:00Z",
                can_edit_core_laws: false,
              }
            : {
                profile_key: "ORIGIN",
                law_preset: "balanced",
                profile_mode: "auto",
                lock_status: "draft",
                policy_version: 1,
                locked_at: null,
                can_edit_core_laws: true,
              }
        );
      }
      if (url.includes("/star-core/physics/profile")) {
        return createJsonResponse({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: lockSeen ? "locked" : "draft",
          coefficients: { a: 0.12, b: 0.4 },
        });
      }
      if (url.includes("/star-core/runtime")) return createJsonResponse({ events_count: 0, writes_per_minute: 0 });
      if (url.includes("/star-core/pulse")) return createJsonResponse({ sampled_count: 0, events: [] });
      if (url.includes("/star-core/metrics/domains")) return createJsonResponse({ total_events_count: 0, domains: [] });
      if (url.includes("/universe/tables")) return createJsonResponse({ items: [] });
      return createJsonResponse({ items: [] });
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "approach star" }));

    await waitFor(() => {
      expect(screen.getByTestId("screen-phase").textContent).toBe("constitution_select");
    });

    fireEvent.click(screen.getByRole("button", { name: "select constitution" }));
    await waitFor(() => {
      expect(screen.getByTestId("screen-phase").textContent).toBe("policy_lock_ready");
      expect(screen.getByTestId("screen-selected-constitution").textContent).toBe("rovnovaha");
    });

    fireEvent.click(screen.getByTestId("star-core-primary-action"));
    await waitFor(() => {
      expect(screen.getByTestId("screen-phase").textContent).toBe("first_orbit_ready");
    });
    expect(lockSeen).toBe(true);
  });

  it("opens locked observatory without calling entry/start write endpoint", async () => {
    let entryStartCalls = 0;

    fetch.mockImplementation(async (input) => {
      const url = String(input || "");
      if (url.includes("/star-core/interior/entry/start")) {
        entryStartCalls += 1;
        return createJsonResponse({});
      }
      if (url.includes("/star-core/interior")) {
        return createJsonResponse({
          interior_phase: "first_orbit_ready",
          selected_constitution_id: "rovnovaha",
          available_constitutions: [],
          lock_ready: false,
          lock_blockers: [],
          lock_transition_state: "locked",
          first_orbit_ready: true,
          next_action: { action_key: "review_first_orbit", label_cz: "Prvni obezna draha je pripravena" },
          explainability: {
            headline_cz: "Politiky jsou uzamceny.",
            body_cz: "Star Core uz funguje jako observatory dashboard.",
          },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
            policy_lock_status: "locked",
            policy_version: 2,
          },
        });
      }
      if (url.includes("/star-core/policy")) {
        return createJsonResponse({
          profile_key: "ORIGIN",
          law_preset: "balanced",
          profile_mode: "locked",
          lock_status: "locked",
          policy_version: 2,
          locked_at: "2026-03-12T10:00:00Z",
          can_edit_core_laws: false,
        });
      }
      if (url.includes("/star-core/physics/profile")) {
        return createJsonResponse({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: "locked",
          coefficients: { a: 0.12 },
        });
      }
      if (url.includes("/star-core/runtime")) return createJsonResponse({ events_count: 12, writes_per_minute: 4 });
      if (url.includes("/star-core/pulse")) return createJsonResponse({ sampled_count: 3, events: [] });
      if (url.includes("/star-core/metrics/domains")) return createJsonResponse({ total_events_count: 8, domains: [] });
      if (url.includes("/universe/tables")) return createJsonResponse({ items: [] });
      if (url.includes("/universe/snapshot")) return createJsonResponse({ civilizations: [], bonds: [] });
      return createJsonResponse({});
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "approach star" }));

    await waitFor(() => {
      expect(screen.getByTestId("screen-stage").textContent).toBe("active");
      expect(screen.getByTestId("screen-phase").textContent).toBe("first_orbit_ready");
    });
    expect(entryStartCalls).toBe(0);
  });

  it("runs command preview and commit through canonical parser pipeline", async () => {
    let commitSeen = false;

    fetch.mockImplementation(async (input, init) => {
      const url = String(input || "");
      if (url.includes("/parser/plan")) {
        return createJsonResponse({
          resolved_command: "nastav civ-001.status na aktivni",
          atomic_tasks: [{ kind: "UPDATE_CIVILIZATION", target_id: "civ-001" }],
          expected_events: ["civilization.updated"],
          because_chain: ["Civilizace dostane novy status."],
          risk_flags: [],
        });
      }
      if (url.includes("/tasks/execute-batch")) {
        commitSeen = true;
        const payload = JSON.parse(String(init?.body || "{}"));
        expect(payload.mode).toBe("commit");
        expect(payload.tasks).toHaveLength(1);
        return createJsonResponse({ ok: true });
      }
      if (url.includes("/star-core/policy")) {
        return createJsonResponse({
          profile_key: "ORIGIN",
          law_preset: "balanced",
          profile_mode: "locked",
          lock_status: "locked",
          policy_version: 2,
          locked_at: "2026-03-12T10:00:00Z",
          can_edit_core_laws: false,
        });
      }
      if (url.includes("/star-core/physics/profile")) {
        return createJsonResponse({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: "locked",
          coefficients: { a: 0.12 },
        });
      }
      if (url.includes("/star-core/interior")) {
        return createJsonResponse({
          interior_phase: "first_orbit_ready",
          selected_constitution_id: "rovnovaha",
          available_constitutions: [],
          lock_ready: false,
          lock_blockers: [],
          lock_transition_state: "locked",
          first_orbit_ready: true,
          next_action: { action_key: "review_first_orbit", label_cz: "Prvni obezna draha je pripravena" },
          explainability: {
            headline_cz: "Politiky jsou uzamceny.",
            body_cz: "Star Core je stabilni.",
          },
          source_truth: {
            profile_key: "ORIGIN",
            law_preset: "balanced",
            physical_profile_key: "BALANCE",
            physical_profile_version: 1,
            policy_lock_status: "locked",
            policy_version: 2,
          },
        });
      }
      if (url.includes("/star-core/runtime")) return createJsonResponse({ events_count: 12, writes_per_minute: 4 });
      if (url.includes("/star-core/pulse")) return createJsonResponse({ sampled_count: 3, events: [] });
      if (url.includes("/star-core/metrics/domains")) return createJsonResponse({ total_events_count: 8, domains: [] });
      if (url.includes("/universe/tables")) {
        return createJsonResponse({
          items: [
            {
              table_id: "t-1",
              planet_name: "Planeta A",
              constellation_name: "Orion",
              sector: { center: { x: 0, z: 0 }, size: 1 },
            },
          ],
        });
      }
      if (url.includes("/universe/snapshot")) {
        return createJsonResponse({
          civilizations: [
            {
              id: "civ-001",
              value: commitSeen ? "Civilizace aktivni" : "Civilizace draft",
              table_id: "t-1",
              table_name: "Planeta A",
              planet_name: "Planeta A",
              constellation_name: "Orion",
              active_alerts: [],
              error_count: 0,
              current_event_seq: commitSeen ? 2 : 1,
            },
          ],
          bonds: [],
        });
      }
      return createJsonResponse({});
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("operator-command-toggle").hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByTestId("operator-command-toggle"));
    fireEvent.change(screen.getByTestId("command-input"), { target: { value: "nastav civ-001.status na aktivni" } });
    fireEvent.click(screen.getByTestId("command-preview-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("command-preview")).toBeTruthy();
      expect(screen.getByText("Preview pripraven. Parser navrhl 1 task(s).")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("command-commit"));

    await waitFor(() => {
      expect(screen.getByTestId("read-grid")).toBeTruthy();
      expect(screen.getByText("Konvergence potvrzena. Workspace byl obnoven z canonical read modelu.")).toBeTruthy();
      expect(screen.getByText("Civilizace aktivni")).toBeTruthy();
    });
    expect(commitSeen).toBe(true);
  });
});
