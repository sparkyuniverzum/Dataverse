/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UniverseWorkspace from "./UniverseWorkspace";
import { useUniverseStore } from "../../store/useUniverseStore";

vi.mock("./UniverseCanvas", () => ({
  default: function MockUniverseCanvas(props) {
    return (
      <button
        type="button"
        data-testid="mock-open-context"
        onClick={() =>
          props.onOpenContext?.({
            kind: "asteroid",
            id: "a-1",
            label: "Asteroid A",
            x: 120,
            y: 100,
          })
        }
      >
        Open Context
      </button>
    );
  },
}));

vi.mock("./BondBuilderPanel", () => ({
  default: () => null,
}));

vi.mock("./StarHeartDashboard", () => ({
  default: () => null,
}));

vi.mock("./LinkHoverTooltip", () => ({
  default: () => null,
}));

vi.mock("./QuickGridOverlay", () => ({
  default: function MockQuickGrid({ open, onUpdateRow, onUpsertMetadata }) {
    if (!open) return null;
    return (
      <div data-testid="quick-grid-open">
        GRID
        <button
          type="button"
          data-testid="mock-grid-update-row"
          onClick={() => {
            void onUpdateRow?.("a-1", "Renamed Civilization");
          }}
        >
          Update Row
        </button>
        <button
          type="button"
          data-testid="mock-grid-upsert-metadata"
          onClick={() => {
            void onUpsertMetadata?.("a-1", "state", "archived");
          }}
        >
          Upsert Metadata
        </button>
      </div>
    );
  },
}));

vi.mock("./useUniverseRuntimeSync", () => ({
  useUniverseRuntimeSync: () => ({
    snapshot: {
      asteroids: [
        {
          id: "a-1",
          value: "Asteroid A",
          table_id: "t-1",
          table_name: "Finance > Cashflow",
          metadata: {},
          calculated_values: {},
          active_alerts: [],
          current_event_seq: 7,
          is_deleted: false,
        },
      ],
      bonds: [],
    },
    tables: [
      {
        table_id: "t-1",
        name: "Finance > Cashflow",
        members: [],
        internal_bonds: [],
        external_bonds: [],
        schema_fields: [],
        formula_fields: [],
        sector: { center: [0, 0, 0], size: 260, mode: "belt", grid_plate: true },
      },
    ],
    loading: false,
    error: "",
    starRuntime: null,
    starDomains: [],
    starPolicy: { lock_status: "locked", no_hard_delete: true, occ_enforced: true, idempotency_supported: true },
    starPhysicsProfile: { profile_key: "BALANCE", profile_version: 1 },
    starPlanetPhysicsByTableId: {},
    starPulseByEntity: {},
    starPulseLastEventSeq: 0,
    setRuntimeError: () => {},
    clearRuntimeError: () => {},
    refreshProjection: async () => {},
    refreshStarTelemetry: async () => {},
  }),
}));

describe("UniverseWorkspace P0 context/branch actions", () => {
  beforeEach(() => {
    useUniverseStore.setState({ level: 2, selectedGalaxyId: "g-1", selectedBranchId: "" });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("opens context menu and executes open-grid action", async () => {
    const user = userEvent.setup();
    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("mock-open-context"));
    expect(screen.getByText(/CIVILIZATION MENU/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Otevřít grid" }));
    expect(screen.getByTestId("quick-grid-open")).toBeTruthy();
  });

  it("calls branch promote endpoint and shows promoted events summary", async () => {
    const user = userEvent.setup();
    useUniverseStore.setState({ selectedBranchId: "br-1" });
    const refreshScopes = vi.fn(async () => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ branch: { id: "br-1" }, promoted_events_count: 5 }),
        text: async () => "",
      }))
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[{ id: "br-1", name: "Experiment A", deleted_at: null }]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
        onRefreshScopes={refreshScopes}
      />
    );

    await user.click(screen.getByRole("button", { name: "Promote branch" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(refreshScopes).toHaveBeenCalled();
    expect(screen.getByTestId("branch-promote-summary").textContent).toContain("5 event");
  });

  it("emits moon_opened telemetry when moon is selected from sidebar", async () => {
    const user = userEvent.setup();
    globalThis.window.__DATAVERSE_TELEMETRY_EVENTS__ = [];

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={{ mode: "guided" }}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("moon-orbit-item-a-1"));
    await waitFor(() => {
      const events = globalThis.window.__DATAVERSE_TELEMETRY_EVENTS__ || [];
      expect(events.some((item) => item?.event_name === "moon_opened" && item?.moon_id === "a-1")).toBe(true);
    });
  });

  it("supports command bar open, preview and confirm execute flow", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input || "");
        if (url.includes("/parser/plan")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              tasks: [{ action: "INGEST", params: { value: "Invoice 2026" } }],
              parser_version: "v2",
            }),
            text: async () => "",
          };
        }
        if (url.includes("/tasks/execute-batch")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              mode: "preview",
              task_count: 1,
              result: {
                tasks: [{ action: "INGEST", params: { value: "Invoice 2026" } }],
                civilizations: [{ id: "c-1" }],
                bonds: [],
              },
            }),
            text: async () => "",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => "",
        };
      })
    );

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("workspace-open-command-bar"));
    expect(screen.getByTestId("workspace-command-bar-modal")).toBeTruthy();

    await user.type(screen.getByTestId("command-bar-input"), '"Invoice 2026"');
    await user.click(screen.getByTestId("command-bar-preview-button"));
    expect(screen.getByText(/Plan uloh:/i).textContent).toContain("1");

    await user.click(screen.getByTestId("command-bar-execute-button"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("workspace-command-bar-modal")).toBeNull();
    expect(screen.getByTestId("workspace-command-result-summary").textContent).toContain("Prikaz proveden");
  });

  it("shows blocking ambiguity hints when parser plan targets different planet", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input) => {
      const url = String(input || "");
      if (url.includes("/parser/plan")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tasks: [{ action: "INGEST", params: { table_id: "t-other", value: "Invoice mismatch" } }],
            parser_version: "v2",
          }),
          text: async () => "",
        };
      }
      if (url.includes("/tasks/execute-batch")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            mode: "preview",
            task_count: 1,
            result: { tasks: [], civilizations: [], bonds: [] },
          }),
          text: async () => "",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("workspace-open-command-bar"));
    await user.type(screen.getByTestId("command-bar-input"), '"Invoice mismatch"');
    await user.click(screen.getByTestId("command-bar-preview-button"));

    expect(screen.getByTestId("command-bar-ambiguity-hints").textContent).toContain("BLOCK");
    expect(screen.getByTestId("command-bar-execute-button").disabled).toBe(true);

    await user.click(screen.getByTestId("command-bar-resolve-planet-button"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("command-bar-resolve-summary").textContent).toContain("Pregenerovano");
    expect(screen.getByTestId("command-bar-execute-button").disabled).toBe(false);
  });

  it("shows parser plan specific error when parser endpoint fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input || "");
        if (url.includes("/parser/plan")) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ detail: { message: "plan crashed" } }),
            text: async () => "plan crashed",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => "",
        };
      })
    );

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("workspace-open-command-bar"));
    await user.type(screen.getByTestId("command-bar-input"), '"Invoice parser fail"');
    await user.click(screen.getByTestId("command-bar-preview-button"));
    await waitFor(() => {
      expect(screen.getByText(/Parser plan/i)).toBeTruthy();
    });
  });

  it("shows backend preview specific error when preview batch fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input || "");
        if (url.includes("/parser/plan")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              tasks: [{ action: "INGEST", params: { value: "Invoice 2026" } }],
              parser_version: "v2",
            }),
            text: async () => "",
          };
        }
        if (url.includes("/tasks/execute-batch")) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ detail: { message: "preview failed" } }),
            text: async () => "preview failed",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => "",
        };
      })
    );

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("workspace-open-command-bar"));
    await user.type(screen.getByTestId("command-bar-input"), '"Invoice preview fail"');
    await user.click(screen.getByTestId("command-bar-preview-button"));
    await waitFor(() => {
      expect(screen.getByText(/Backend preview/i)).toBeTruthy();
    });
  });

  it("sends canonical mutate payload with both value and label for row update", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input) => {
      const url = String(input || "");
      if (url.includes("/civilizations/a-1/mutate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            moon_id: "a-1",
            current_event_seq: 8,
            is_deleted: false,
          }),
          text: async () => "",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("mock-open-context"));
    await user.click(screen.getByRole("button", { name: "Otevřít grid" }));
    await user.click(screen.getByTestId("mock-grid-update-row"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const mutateCall = fetchMock.mock.calls.find(([input]) =>
      String(input || "").includes("/civilizations/a-1/mutate")
    );
    expect(mutateCall).toBeTruthy();
    const mutateInit = mutateCall?.[1] || {};
    const mutateBody = JSON.parse(String(mutateInit.body || "{}"));
    expect(mutateBody.value).toBe("Renamed Civilization");
    expect(mutateBody.label).toBe("Renamed Civilization");
    expect(mutateBody.galaxy_id).toBe("g-1");
  });

  it("sends metadata in mutate fallback payload after mineral endpoints fallback", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input) => {
      const url = String(input || "");
      if (url.includes("/civilizations/a-1/minerals/state")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "not found" }),
          text: async () => "not found",
        };
      }
      if (url.includes("/moons/a-1/minerals/state")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "not found" }),
          text: async () => "not found",
        };
      }
      if (url.includes("/civilizations/a-1/mutate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            moon_id: "a-1",
            current_event_seq: 9,
            is_deleted: false,
          }),
          text: async () => "",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UniverseWorkspace
        galaxy={{ id: "g-1", name: "Milky QA" }}
        branches={[]}
        onboarding={null}
        onBackToGalaxies={() => {}}
        onLogout={() => {}}
      />
    );

    await user.click(screen.getByTestId("mock-open-context"));
    await user.click(screen.getByRole("button", { name: "Otevřít grid" }));
    await user.click(screen.getByTestId("mock-grid-upsert-metadata"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const mutateFallbackCall = fetchMock.mock.calls.find(([input]) =>
      String(input || "").includes("/civilizations/a-1/mutate")
    );
    expect(mutateFallbackCall).toBeTruthy();
    const mutateFallbackInit = mutateFallbackCall?.[1] || {};
    const fallbackBody = JSON.parse(String(mutateFallbackInit.body || "{}"));
    expect(fallbackBody.metadata).toMatchObject({ state: "archived" });
    expect(fallbackBody.minerals).toMatchObject({ state: "archived" });
    expect(fallbackBody.galaxy_id).toBe("g-1");
  });
});
