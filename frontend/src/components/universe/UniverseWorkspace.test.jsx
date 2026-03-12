import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./UniverseCanvas.jsx", () => ({
  default: ({
    model,
    navigationModel,
    spaceObjects,
    interiorModel,
    selectedConstitution,
    onSelectObject,
    onApproachObject,
    onSelectConstitution,
    onClearFocus,
  }) => (
    <div data-testid="universe-canvas">
      <span data-testid="canvas-state">{model.state}</span>
      <span data-testid="canvas-nav-mode">{navigationModel.mode}</span>
      <span data-testid="canvas-selected-object">{navigationModel.selectedObjectId || "none"}</span>
      <span data-testid="canvas-object-count">{spaceObjects.length}</span>
      <span data-testid="canvas-interior-phase">{interiorModel.phase}</span>
      <span data-testid="canvas-selected-constitution">{selectedConstitution?.id || "none"}</span>
      <button type="button" onClick={() => onSelectObject("star-core")}>
        select star
      </button>
      <button type="button" onClick={() => onApproachObject("star-core")}>
        approach star
      </button>
      <button type="button" onClick={() => onSelectConstitution("rovnovaha")}>
        select constitution
      </button>
      <button type="button" onClick={onClearFocus}>
        clear focus
      </button>
    </div>
  ),
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
    if (url.includes("/star-core/physics/profile")) {
      return createJsonResponse(physics || {});
    }
    if (url.includes("/star-core/runtime")) {
      return createJsonResponse(runtime);
    }
    if (url.includes("/star-core/pulse")) {
      return createJsonResponse(pulse);
    }
    if (url.includes("/star-core/metrics/domains")) {
      return createJsonResponse(domainMetrics);
    }
    if (url.includes("/universe/tables")) {
      return createJsonResponse(tables);
    }
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
      interior: {
        interior_phase: "constitution_select",
        selected_constitution_id: null,
        available_constitutions: [],
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
      },
      runtime: { events_count: 12, writes_per_minute: 24 },
      pulse: { sampled_count: 6, events: [{ event_type: "planet.update" }] },
      domainMetrics: { total_events_count: 18, domains: [{ domain_name: "governance" }] },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("star_core_unlocked");
    });
    expect(screen.getByTestId("canvas-object-count").textContent).toBe("2");
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("renders post-lock ready state from BE truth", async () => {
    mockWorkspaceFetch({
      policy: {
        profile_key: "SENTINEL",
        law_preset: "integrity_first",
        profile_mode: "locked",
        lock_status: "locked",
        policy_version: 3,
        locked_at: "2026-03-12T10:00:00Z",
        can_edit_core_laws: false,
      },
      physics: {
        galaxy_id: "g-1",
        profile_key: "FORGE",
        profile_version: 2,
        lock_status: "locked",
        coefficients: { a: 0.12, b: 0.4, c: 0.9 },
      },
      tables: { items: [] },
      interior: {
        interior_phase: "first_orbit_ready",
        selected_constitution_id: "straz",
        available_constitutions: [],
        lock_ready: false,
        lock_blockers: [],
        lock_transition_state: "locked",
        first_orbit_ready: true,
        next_action: { action_key: "review_first_orbit", label_cz: "První oběžná dráha je připravena" },
        explainability: { headline_cz: "Politiky jsou uzamčeny.", body_cz: "Governance základ je potvrzen." },
        source_truth: {
          profile_key: "SENTINEL",
          law_preset: "integrity_first",
          physical_profile_key: "BALANCE",
          physical_profile_version: 1,
        },
      },
      runtime: { events_count: 48, writes_per_minute: 64 },
      pulse: { sampled_count: 12, events: [{ event_type: "policy.lock" }] },
      domainMetrics: {
        total_events_count: 48,
        domains: [{ domain_name: "governance" }, { domain_name: "physics" }],
      },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("star_core_locked_ready");
    });
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("falls back to data_unavailable when policy fetch fails", async () => {
    mockWorkspaceFetch({
      policyError: { status: 503, detail: "service unavailable" },
      physics: {
        galaxy_id: "g-1",
        profile_key: "BALANCE",
        profile_version: 1,
        lock_status: "draft",
        coefficients: {},
      },
      tables: { items: [] },
      interior: {
        interior_phase: "constitution_select",
        selected_constitution_id: null,
        available_constitutions: [],
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
      },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("data_unavailable");
    });
    expect(screen.getByText("service unavailable")).toBeTruthy();
  });

  it("switches selection and approach states from canvas actions", async () => {
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
      tables: { items: [] },
      interior: {
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
      },
    });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "select star" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("object_selected");
    expect(screen.getByText("Vybraný objekt: Srdce hvězdy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "approach star" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("approach_active");

    fireEvent.click(screen.getByRole("button", { name: "clear focus" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
  });

  it("opens interior flow from unlocked star approach and locks via canonical endpoint", async () => {
    let lockSeen = false;

    fetch.mockImplementation(async (input, init) => {
      const url = String(input || "");
      if (url.includes("/star-core/policy/lock")) {
        lockSeen = true;
        const payload = JSON.parse(String(init?.body || "{}"));
        expect(payload.profile_key).toBe("ORIGIN");
        expect(payload.physical_profile_key).toBe("BALANCE");
        return createJsonResponse({ ok: true });
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
            ? {
                interior_phase: "first_orbit_ready",
                selected_constitution_id: "rovnovaha",
                available_constitutions: [],
                lock_ready: false,
                lock_blockers: [],
                lock_transition_state: "locked",
                first_orbit_ready: true,
                next_action: { action_key: "review_first_orbit", label_cz: "První oběžná dráha je připravena" },
                explainability: { headline_cz: "Politiky jsou uzamčeny.", body_cz: "Governance základ je potvrzen." },
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

    fireEvent.click(screen.getByRole("button", { name: "select star" }));
    fireEvent.click(screen.getByRole("button", { name: "approach star" }));
    fireEvent.click(screen.getByRole("button", { name: "approach star" }));

    await waitFor(() => {
      expect(screen.getByTestId("canvas-interior-phase").textContent).toBe("star_core_interior_entry");
    });
    await waitFor(() => {
      expect(screen.getByTestId("canvas-interior-phase").textContent).toBe("constitution_select");
    });

    fireEvent.click(screen.getByRole("button", { name: "select constitution" }));
    await waitFor(() => {
      expect(screen.getByTestId("canvas-interior-phase").textContent).toBe("policy_lock_ready");
    });
    fireEvent.click(screen.getByTestId("star-core-primary-action"));

    await waitFor(() => {
      expect(screen.getByTestId("canvas-interior-phase").textContent).toBe("first_orbit_ready");
    });
    expect(lockSeen).toBe(true);
  });
});
