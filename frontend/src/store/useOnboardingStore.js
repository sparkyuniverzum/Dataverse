import { create } from "zustand";
import { persist } from "zustand/middleware";

const STEP_INTRO = "intro";
const STEP_BLUEPRINT = "blueprint";
const STEP_DROP_PLANET = "drop_planet";
const STEP_SCHEMA = "schema";
const STEP_DEPENDENCIES = "dependencies";
const STEP_CALCULATIONS = "calculations";
const STEP_SIMULATION = "simulation";
const STEP_COMPLETE = "complete";
const STEP_UNLOCKED = "unlocked";

const IMMERSIVE_STEPS = [
  STEP_INTRO,
  STEP_BLUEPRINT,
  STEP_DROP_PLANET,
  STEP_SCHEMA,
  STEP_DEPENDENCIES,
  STEP_CALCULATIONS,
  STEP_SIMULATION,
  STEP_COMPLETE,
];

const STEP_RANK = {
  [STEP_INTRO]: 0,
  [STEP_BLUEPRINT]: 1,
  [STEP_DROP_PLANET]: 2,
  [STEP_SCHEMA]: 3,
  [STEP_DEPENDENCIES]: 4,
  [STEP_CALCULATIONS]: 5,
  [STEP_SIMULATION]: 6,
  [STEP_COMPLETE]: 7,
  [STEP_UNLOCKED]: 99,
};

function stepRank(step) {
  return Number(STEP_RANK[String(step || "").trim()] ?? 0);
}

function normalizeSession(raw = {}) {
  const step = typeof raw.step === "string" ? raw.step : STEP_INTRO;
  const normalizedStep = IMMERSIVE_STEPS.includes(step) ? step : STEP_INTRO;
  const introAck = Boolean(raw.introAck ?? raw.intro_ack);
  const planetDropped = Boolean(raw.planetDropped ?? raw.planet_dropped);
  const schemaConfirmed = Boolean(raw.schemaConfirmed ?? raw.schema_confirmed);
  const dependenciesConfirmed = Boolean(raw.dependenciesConfirmed ?? raw.dependencies_confirmed);
  const calculationsConfirmed = Boolean(raw.calculationsConfirmed ?? raw.calculations_confirmed);
  const simulationConfirmed = Boolean(raw.simulationConfirmed ?? raw.simulation_confirmed);
  const completed = Boolean(raw.completed);

  let finalStep = normalizedStep;
  const advanceTo = (targetStep) => {
    if (stepRank(finalStep) < stepRank(targetStep)) {
      finalStep = targetStep;
    }
  };
  if (introAck) advanceTo(STEP_BLUEPRINT);
  if (planetDropped) advanceTo(STEP_SCHEMA);
  if (schemaConfirmed) advanceTo(STEP_DEPENDENCIES);
  if (dependenciesConfirmed) advanceTo(STEP_CALCULATIONS);
  if (calculationsConfirmed) advanceTo(STEP_SIMULATION);
  if (simulationConfirmed || completed) advanceTo(STEP_COMPLETE);

  return {
    step: finalStep,
    introAck,
    planetDropped,
    schemaConfirmed,
    dependenciesConfirmed,
    calculationsConfirmed,
    simulationConfirmed,
    completed: completed || finalStep === STEP_COMPLETE,
    lastDrop: Array.isArray(raw.lastDrop) ? raw.lastDrop.slice(0, 2) : null,
  };
}

function mergeSessionsByProgress(primary, secondary) {
  const a = normalizeSession(primary);
  const b = normalizeSession(secondary);
  const useA = stepRank(a.step) >= stepRank(b.step);
  const winner = useA ? a : b;
  const loser = useA ? b : a;
  return normalizeSession({
    ...loser,
    ...winner,
    introAck: winner.introAck || loser.introAck,
    planetDropped: winner.planetDropped || loser.planetDropped,
    schemaConfirmed: winner.schemaConfirmed || loser.schemaConfirmed,
    dependenciesConfirmed: winner.dependenciesConfirmed || loser.dependenciesConfirmed,
    calculationsConfirmed: winner.calculationsConfirmed || loser.calculationsConfirmed,
    simulationConfirmed: winner.simulationConfirmed || loser.simulationConfirmed,
    completed: winner.completed || loser.completed,
    lastDrop: winner.lastDrop || loser.lastDrop || null,
  });
}

function resolveStepFromMission(session, mission) {
  const safeMission = mission && typeof mission === "object" ? mission : {};
  if (!session.introAck) return STEP_INTRO;
  if (!safeMission.hasFinanceTable || !safeMission.hasModel) return STEP_BLUEPRINT;
  if (!session.planetDropped) return STEP_DROP_PLANET;
  if (!session.schemaConfirmed || !safeMission.schemaDefined) return STEP_SCHEMA;
  if (!safeMission.dependenciesReady) return STEP_DEPENDENCIES;
  if (!safeMission.calculationsReady) return STEP_CALCULATIONS;
  if (!safeMission.simulationReady) return STEP_SIMULATION;
  return STEP_COMPLETE;
}

export const useOnboardingStore = create(
  persist(
    (set, get) => ({
      currentGalaxyId: "",
      immersiveActive: false,
      sessionsByGalaxy: {},

      bootSession: ({ galaxyId, immersiveEnabled, backendStageKey, backendMode, backendMachine = null }) => {
        const id = String(galaxyId || "").trim();
        if (!id) {
          set({ currentGalaxyId: "", immersiveActive: false });
          return;
        }
        const stageKey = String(backendStageKey || "");
        const mode = String(backendMode || "guided");
        const allowImmersive = Boolean(immersiveEnabled) && stageKey === "galaxy_bootstrap" && mode !== "hardcore";
        set((state) => {
          const existing = normalizeSession(state.sessionsByGalaxy[id]);
          const fromBackend = normalizeSession(backendMachine || {});
          const merged = mergeSessionsByProgress(fromBackend, existing);
          return {
            currentGalaxyId: id,
            immersiveActive: allowImmersive,
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: merged,
            },
          };
        });
      },

      syncMissionProgress: ({ galaxyId, mission }) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        const { immersiveActive, sessionsByGalaxy } = get();
        if (!immersiveActive) return;
        const session = normalizeSession(sessionsByGalaxy[id]);
        const nextStep = resolveStepFromMission(session, mission);
        if (stepRank(nextStep) <= stepRank(session.step)) return;
        set((state) => ({
          sessionsByGalaxy: {
            ...state.sessionsByGalaxy,
            [id]: {
              ...normalizeSession(state.sessionsByGalaxy[id]),
              step: nextStep,
            },
          },
        }));
      },

      acknowledgeIntro: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                introAck: true,
                step: stepRank(session.step) <= stepRank(STEP_INTRO) ? STEP_BLUEPRINT : session.step,
              },
            },
          };
        });
      },

      markPlanetDropped: ({ galaxyId, dropPoint = null }) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        const point =
          Array.isArray(dropPoint) && dropPoint.length >= 2
            ? [Number(dropPoint[0] || 0), Number(dropPoint[1] || 0)]
            : null;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                planetDropped: true,
                lastDrop: point,
                step: stepRank(session.step) <= stepRank(STEP_DROP_PLANET) ? STEP_SCHEMA : session.step,
              },
            },
          };
        });
      },

      confirmSchema: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                schemaConfirmed: true,
                step: stepRank(session.step) <= stepRank(STEP_SCHEMA) ? STEP_DEPENDENCIES : session.step,
              },
            },
          };
        });
      },

      markDependenciesReady: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                dependenciesConfirmed: true,
                step: stepRank(session.step) <= stepRank(STEP_DEPENDENCIES) ? STEP_CALCULATIONS : session.step,
              },
            },
          };
        });
      },

      markCalculationsReady: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                calculationsConfirmed: true,
                step: stepRank(session.step) <= stepRank(STEP_CALCULATIONS) ? STEP_SIMULATION : session.step,
              },
            },
          };
        });
      },

      markSimulationReady: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => {
          const session = normalizeSession(state.sessionsByGalaxy[id]);
          return {
            sessionsByGalaxy: {
              ...state.sessionsByGalaxy,
              [id]: {
                ...session,
                simulationConfirmed: true,
                completed: true,
                step: STEP_COMPLETE,
              },
            },
          };
        });
      },

      forceUnlock: (galaxyId) => {
        const id = String(galaxyId || "").trim();
        if (!id) return;
        set((state) => ({
          sessionsByGalaxy: {
            ...state.sessionsByGalaxy,
            [id]: {
              ...normalizeSession(state.sessionsByGalaxy[id]),
              step: STEP_UNLOCKED,
            },
          },
          immersiveActive: false,
        }));
      },
    }),
    {
      name: "dataverse_onboarding_machine_v1",
      version: 1,
      partialize: (state) => ({
        sessionsByGalaxy: state.sessionsByGalaxy,
      }),
    }
  )
);

export const OnboardingSteps = {
  STEP_INTRO,
  STEP_BLUEPRINT,
  STEP_DROP_PLANET,
  STEP_SCHEMA,
  STEP_DEPENDENCIES,
  STEP_CALCULATIONS,
  STEP_SIMULATION,
  STEP_COMPLETE,
  STEP_UNLOCKED,
};
