import { useEffect, useMemo, useState } from "react";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";

import { OnboardingSteps } from "../../store/useOnboardingStore";

const DROP_ZONE_ID = "space-canvas-dropzone";
const ACTION_TOKEN_ID = "immersive-stage-token";
const SIDE_PANEL_WIDTH = 420;
const FLOW_STEPS = [
  OnboardingSteps.STEP_BLUEPRINT,
  OnboardingSteps.STEP_DROP_PLANET,
  OnboardingSteps.STEP_SCHEMA,
  OnboardingSteps.STEP_DEPENDENCIES,
  OnboardingSteps.STEP_CALCULATIONS,
  OnboardingSteps.STEP_SIMULATION,
  OnboardingSteps.STEP_COMPLETE,
];

const SCHEMA_RECOMMENDED_PRESET_KEY = "personal_cashflow";
const SCHEMA_PRESET_CARDS = [
  {
    key: SCHEMA_RECOMMENDED_PRESET_KEY,
    title: "Osobni Cashflow",
    subtitle: "Doporuceno pro prvni planetu",
    locked: false,
  },
  {
    key: "agile_crm",
    title: "Agilni CRM",
    subtitle: "Odemkne se po zvladnuti zakladu.",
    locked: true,
  },
  {
    key: "warehouse",
    title: "Sklad",
    subtitle: "Odemkne se po zvladnuti zakladu.",
    locked: true,
  },
];
const SCHEMA_ASSEMBLY_STEPS = [
  {
    id: "tx_name",
    label: "Nazev transakce",
    typeLabel: "Text",
    helper: "Zakladem je vzdy nazev. Pridej Planete Nerost 'Nazev transakce' (Text).",
    actionLabel: "+ Nazev",
  },
  {
    id: "amount",
    label: "Castka",
    typeLabel: "Cislo",
    helper: "Cashflow stoji na cislech. Pridej 'Castku' (Cislo).",
    actionLabel: "+ Castka",
  },
  {
    id: "direction",
    label: "Typ",
    typeLabel: "Prijem / Vydaj",
    helper: "Aby v tom nebyl zmatek, pridej 'Typ' (Prijem/Vydaj).",
    actionLabel: "+ Typ",
  },
];

function createSchemaAssemblyState() {
  return SCHEMA_ASSEMBLY_STEPS.reduce((acc, item) => ({ ...acc, [item.id]: false }), {});
}

function isSchemaAssemblyComplete(state) {
  return SCHEMA_ASSEMBLY_STEPS.every((item) => Boolean(state?.[item.id]));
}

function resolveTokenTheme(tone) {
  switch (tone) {
    case "blueprint":
      return {
        shell: "linear-gradient(145deg, #122c40, #0a1a2a)",
        orb: "radial-gradient(circle at 30% 28%, #d8f8ff 0%, #73d6ff 30%, #2f7ab2 60%, #0a2745 100%)",
        glow: "0 0 30px rgba(103, 203, 239, 0.62)",
      };
    case "schema":
      return {
        shell: "linear-gradient(145deg, #172945, #121e35)",
        orb: "radial-gradient(circle at 32% 28%, #e5ebff 0%, #9ab2ff 30%, #4a65cf 60%, #1a2c75 100%)",
        glow: "0 0 30px rgba(143, 166, 255, 0.58)",
      };
    case "dependencies":
      return {
        shell: "linear-gradient(145deg, #113733, #102720)",
        orb: "radial-gradient(circle at 32% 28%, #d9fff5 0%, #77f0cd 28%, #2f9d82 60%, #0d3d34 100%)",
        glow: "0 0 30px rgba(119, 234, 196, 0.58)",
      };
    case "calculations":
      return {
        shell: "linear-gradient(145deg, #352a14, #261b0f)",
        orb: "radial-gradient(circle at 30% 28%, #fff2d7 0%, #ffd489 28%, #d7923f 60%, #6f4418 100%)",
        glow: "0 0 30px rgba(255, 201, 122, 0.56)",
      };
    case "simulation":
      return {
        shell: "linear-gradient(145deg, #3a1b23, #25121a)",
        orb: "radial-gradient(circle at 30% 28%, #ffe0ea 0%, #ff9cbf 30%, #cb4a76 60%, #651d37 100%)",
        glow: "0 0 30px rgba(255, 150, 187, 0.62)",
      };
    case "complete":
      return {
        shell: "linear-gradient(145deg, #192d23, #101d18)",
        orb: "radial-gradient(circle at 30% 28%, #e0ffef 0%, #98ffc7 30%, #3abf7e 60%, #115637 100%)",
        glow: "0 0 30px rgba(139, 255, 191, 0.6)",
      };
    default:
      return {
        shell: "linear-gradient(145deg, #16283d, #0d1f33)",
        orb: "radial-gradient(circle at 35% 30%, #d8f8ff 0%, #79d8ff 25%, #2f7db5 56%, #0a2948 100%)",
        glow: "0 0 30px rgba(97, 194, 231, 0.62)",
      };
  }
}

function DraggableActionToken({
  disabled = false,
  label = "Modul",
  subtitle = "Pretahni do prostoru",
  tone = "default",
  compact = false,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ACTION_TOKEN_ID,
    disabled,
  });
  const theme = resolveTokenTheme(tone);
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "grab",
    userSelect: "none",
    border: "1px solid rgba(109, 209, 244, 0.42)",
    borderRadius: 14,
    padding: compact ? "8px 10px" : "10px 12px",
    background: theme.shell,
    display: "grid",
    gap: compact ? 6 : 8,
    justifyItems: "center",
    minWidth: compact ? 112 : 146,
    width: compact ? "100%" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div
        style={{
          width: compact ? 44 : 64,
          height: compact ? 44 : 64,
          borderRadius: "50%",
          background: theme.orb,
          boxShadow: `${theme.glow}, inset -10px -12px 18px rgba(5, 18, 33, 0.72)`,
        }}
      />
      <div style={{ fontSize: compact ? "var(--dv-fs-2xs)" : "var(--dv-fs-xs)", opacity: 0.94, textAlign: "center", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.8, textAlign: "center" }}>{subtitle}</div>
    </div>
  );
}

function CanvasDropzone({ active = false, title = "Drop zona", hint = "Pust modul do prostoru", insetRight = 24 }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      style={{
        position: "fixed",
        top: 24,
        left: 24,
        right: insetRight,
        bottom: 24,
        borderRadius: 18,
        border: isOver ? "2px solid rgba(115, 228, 255, 0.82)" : "1px dashed rgba(102, 188, 220, 0.34)",
        background: isOver
          ? "radial-gradient(circle at 50% 50%, rgba(87, 208, 255, 0.16), rgba(5, 14, 25, 0.08))"
          : "rgba(4, 12, 22, 0.12)",
        pointerEvents: active ? "auto" : "none",
        transition: "all 160ms ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(121, 211, 241, 0.38)",
          borderRadius: 14,
          background: "rgba(6, 19, 33, 0.84)",
          color: "#d9f8ff",
          padding: "12px 14px",
          minWidth: 240,
          textAlign: "center",
          boxShadow: isOver ? "0 0 36px rgba(80, 188, 229, 0.35)" : "none",
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>{hint}</div>
      </div>
    </div>
  );
}

function SchemaPresetWorkbench({
  presetKey = "",
  assemblyState = createSchemaAssemblyState(),
  busy = false,
  onPickPreset,
  onAssemblePart,
  onIgnite,
}) {
  const presetSelected = presetKey === SCHEMA_RECOMMENDED_PRESET_KEY;
  const completedCount = SCHEMA_ASSEMBLY_STEPS.filter((item) => Boolean(assemblyState?.[item.id])).length;
  const canIgnite = presetSelected && isSchemaAssemblyComplete(assemblyState);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
        Vyborne. Planeta je kontejner pro data. Aby v ni nebyl chaos, nastavime ji zakony pomoci NAKRESU.
      </div>
      <AnimatePresence initial={false} mode="wait">
        {!presetSelected ? (
          <motion.div
            key="schema-presets"
            layoutId="schema-workbench-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{
              border: "1px solid rgba(124, 214, 246, 0.32)",
              borderRadius: 10,
              background: "rgba(9, 24, 40, 0.86)",
              padding: "8px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.85 }}>
              Vesmír nebudujeme od nuly. Pouzijeme overeny Nakres (Preset). Zacneme presetem Cashflow.
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {SCHEMA_PRESET_CARDS.map((card) => {
                const isLocked = Boolean(card.locked);
                const isRecommended = card.key === SCHEMA_RECOMMENDED_PRESET_KEY;
                return (
                  <motion.button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      if (isLocked || busy) return;
                      onPickPreset?.(card.key);
                    }}
                    disabled={isLocked || busy}
                    animate={
                      isRecommended && !isLocked
                        ? {
                            boxShadow: [
                              "0 0 0 rgba(101, 221, 255, 0.0)",
                              "0 0 18px rgba(101, 221, 255, 0.38)",
                              "0 0 0 rgba(101, 221, 255, 0.0)",
                            ],
                          }
                        : undefined
                    }
                    transition={isRecommended ? { duration: 1.8, repeat: Number.POSITIVE_INFINITY } : undefined}
                    style={{
                      border: isRecommended ? "1px solid rgba(129, 224, 255, 0.58)" : "1px solid rgba(103, 174, 208, 0.3)",
                      borderRadius: 10,
                      background: isLocked ? "rgba(16, 24, 35, 0.72)" : "rgba(14, 37, 58, 0.9)",
                      color: "#d8f7ff",
                      padding: "9px 10px",
                      display: "grid",
                      gap: 3,
                      textAlign: "left",
                      opacity: isLocked ? 0.58 : 1,
                      cursor: isLocked || busy ? "not-allowed" : "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>{card.title}</span>
                      {isLocked ? (
                        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>LOCK</span>
                      ) : (
                        <span style={{ fontSize: "var(--dv-fs-2xs)", color: "#9ff9d8", letterSpacing: "var(--dv-tr-wide)" }}>READY</span>
                      )}
                    </div>
                    <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>{card.subtitle}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="schema-assembly"
            layoutId="schema-workbench-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{
              border: "1px solid rgba(124, 214, 246, 0.34)",
              borderRadius: 10,
              background: "rgba(9, 24, 40, 0.88)",
              padding: "8px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>STAVEBNI PLAN</div>
                <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Osobni Cashflow · {completedCount}/3</div>
              </div>
              <button
                type="button"
                onClick={() => onPickPreset?.("")}
                disabled={busy}
                style={{
                  border: "1px solid rgba(118, 198, 232, 0.34)",
                  borderRadius: 8,
                  background: "rgba(6, 18, 30, 0.92)",
                  color: "#cbeffd",
                  fontSize: "var(--dv-fs-2xs)",
                  padding: "4px 7px",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Zpet na presety
              </button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {SCHEMA_ASSEMBLY_STEPS.map((item, index) => {
                const prevItem = SCHEMA_ASSEMBLY_STEPS[index - 1];
                const unlocked = index === 0 || Boolean(assemblyState?.[prevItem.id]);
                const completed = Boolean(assemblyState?.[item.id]);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    style={{
                      border: completed
                        ? "1px solid rgba(138, 246, 189, 0.52)"
                        : "1px solid rgba(118, 198, 232, 0.28)",
                      borderRadius: 10,
                      background: "rgba(8, 22, 37, 0.88)",
                      padding: "7px",
                      display: "grid",
                      gap: 5,
                      opacity: unlocked ? 1 : 0.55,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: "var(--dv-fs-xs)", fontWeight: 700 }}>
                        {String.fromCharCode(65 + index)} · {item.label}
                      </div>
                      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>{completed ? "OK" : item.typeLabel}</div>
                    </div>
                    <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>{item.helper}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                      <div
                        style={{
                          border: completed
                            ? "1px solid rgba(138, 246, 189, 0.5)"
                            : "1px dashed rgba(123, 203, 236, 0.36)",
                          borderRadius: 8,
                          background: completed ? "rgba(11, 47, 34, 0.54)" : "rgba(6, 18, 30, 0.66)",
                          padding: "5px 7px",
                          fontSize: "var(--dv-fs-2xs)",
                          opacity: completed ? 0.96 : 0.74,
                        }}
                      >
                        {completed ? `Nerost vlozen: ${item.label}` : "Slot schema ceka na Lego dilek"}
                      </div>
                      <button
                        type="button"
                        onClick={() => onAssemblePart?.(item.id)}
                        disabled={!unlocked || completed || busy}
                        style={{
                          border: "1px solid rgba(124, 214, 246, 0.38)",
                          borderRadius: 8,
                          background: completed ? "rgba(16, 53, 40, 0.86)" : "rgba(8, 23, 39, 0.9)",
                          color: completed ? "#a9ffd2" : "#d4f6ff",
                          fontSize: "var(--dv-fs-2xs)",
                          padding: "5px 7px",
                          cursor: !unlocked || completed || busy ? "not-allowed" : "pointer",
                        }}
                      >
                        {completed ? "Vlozeno" : item.actionLabel}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {canIgnite ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  border: "1px solid rgba(124, 214, 246, 0.36)",
                  borderRadius: 10,
                  background: "rgba(11, 30, 48, 0.9)",
                  padding: "8px",
                  display: "grid",
                  gap: 7,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", fontWeight: 700 }}>Plan je kompletni.</div>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.86 }}>
                  Bude vytvorena struktura o 3 zakonech (Nazev transakce, Castka, Typ) a doplnena ukazkova data.
                </div>
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                  Nyni aplikujeme plan do reality.
                </div>
                <button
                  type="button"
                  onClick={() => onIgnite?.()}
                  disabled={busy}
                  style={{
                    border: "1px solid rgba(117, 216, 248, 0.44)",
                    borderRadius: 10,
                    background: "linear-gradient(120deg, #5cd6ff, #8ff8df)",
                    color: "#03121f",
                    fontSize: "var(--dv-fs-sm)",
                    fontWeight: 800,
                    padding: "9px 12px",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Aplikuji..." : "Zazehnout Jadro"}
                </button>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function stepDescription(step) {
  switch (step) {
    case OnboardingSteps.STEP_BLUEPRINT:
      return "Tohle je tva stavebnice. Vytvor zakladni Planetu, ktera ponese schema i data.";
    case OnboardingSteps.STEP_DROP_PLANET:
      return "Vezmi planetu a pretahni ji do prostoru. Tim ji materializujes.";
    case OnboardingSteps.STEP_SCHEMA:
      return "Vyber Nakres a sloz 3 zakladni zakony planety pomoci predpripravenych Lego dilku.";
    case OnboardingSteps.STEP_DEPENDENCIES:
      return "Bez vazeb neni kauzalita. Propoj model se vstupnimi mesici.";
    case OnboardingSteps.STEP_CALCULATIONS:
      return "Zapni vypocty. Prijmy a vydaje se musi prepocitavat automaticky.";
    case OnboardingSteps.STEP_SIMULATION:
      return "Simuluj stresovy scenar a sleduj, jak se meni marze modelu.";
    case OnboardingSteps.STEP_COMPLETE:
      return "Stage 1 je dokoncena. Pripraveno na standardni workspace UI.";
    default:
      return "Vstupujes do prostoru, kde vizualni akce tvori datovy model.";
  }
}

function stepOrder(step) {
  const index = FLOW_STEPS.indexOf(step);
  return index >= 0 ? index : 0;
}

function resolveFlowRows(currentStep) {
  const currentOrder = stepOrder(currentStep);
  return [
    {
      step: OnboardingSteps.STEP_BLUEPRINT,
      title: "Planeta Blueprint",
      domain: "STAVBA",
      note: "Vytvor domovskou planetu jako kontejner dat.",
    },
    {
      step: OnboardingSteps.STEP_DROP_PLANET,
      title: "Materializace Planety",
      domain: "PLANETY",
      note: "Pretazenim planetu usadis do prostoru.",
    },
    {
      step: OnboardingSteps.STEP_SCHEMA,
      title: "Zakony a Sloupce",
      domain: "SCHEMA",
      note: "Vyber preset Cashflow a sloz 3 zakony planety.",
    },
    {
      step: OnboardingSteps.STEP_DEPENDENCIES,
      title: "Vazby a Kauzalita",
      domain: "VAZBY",
      note: "Propoj mesice tokem dat.",
    },
    {
      step: OnboardingSteps.STEP_CALCULATIONS,
      title: "Vypocetni Vrstva",
      domain: "NEROSTY",
      note: "Zapni soucty a odvozena pole.",
    },
    {
      step: OnboardingSteps.STEP_SIMULATION,
      title: "Simulace a Fyzika",
      domain: "FYZIKA",
      note: "Proved stresovy scenar nad modelem.",
    },
    {
      step: OnboardingSteps.STEP_COMPLETE,
      title: "Prechod do Stage 2",
      domain: "UNLOCK",
      note: "Dokonceni pilotu a otevreni standardniho UI.",
    },
  ].map((row) => {
    const order = stepOrder(row.step);
    const status = order < currentOrder ? "done" : order === currentOrder ? "active" : "locked";
    return {
      ...row,
      status,
    };
  });
}

function resolveStepDragAction(step, handlers) {
  switch (step) {
    case OnboardingSteps.STEP_BLUEPRINT:
      return {
        label: "Blueprint Core",
        subtitle: "Inicializace planety",
        tone: "blueprint",
        dropTitle: "Inicializace Planety",
        dropHint: "Pretahni Blueprint Core do drop zony",
        instruction: "Akce vytvori prvni planetu, do ktere pozdeji vlozis schema a data.",
        onDrop: handlers.onRunBlueprint,
      };
    case OnboardingSteps.STEP_DROP_PLANET:
      return {
        label: "Domovska Planeta",
        subtitle: "Materializace objektu",
        tone: "default",
        dropTitle: "Materializace Planety",
        dropHint: "Pretahni planetu do drop zony",
        instruction: "Po dropu se planeta zhmotni a otevre setup schema.",
        onDrop: handlers.onDropPlanet,
      };
    case OnboardingSteps.STEP_SCHEMA:
      return null;
    case OnboardingSteps.STEP_DEPENDENCIES:
      return {
        label: "Flow Bridge",
        subtitle: "Datove vazby",
        tone: "dependencies",
        dropTitle: "Aktivace Vazeb",
        dropHint: "Pretahni Flow Bridge do drop zony",
        instruction: "Akce vytvori FLOW propojeni mezi modelem a mesici.",
        onDrop: handlers.onRunDependencies,
      };
    case OnboardingSteps.STEP_CALCULATIONS:
      return {
        label: "Calc Engine",
        subtitle: "Soucty a derivace",
        tone: "calculations",
        dropTitle: "Aktivace Vypoctu",
        dropHint: "Pretahni Calc Engine do drop zony",
        instruction: "Akce aktivuje prijem_total a vydaj_total vypocty.",
        onDrop: handlers.onRunCalculations,
      };
    case OnboardingSteps.STEP_SIMULATION:
      return {
        label: "Shock Pulse",
        subtitle: "Stresovy scenar",
        tone: "simulation",
        dropTitle: "Spusteni Simulace",
        dropHint: "Pretahni Shock Pulse do drop zony",
        instruction: "Akce navysi vydaj a ukaze dopad na marzi.",
        onDrop: handlers.onRunSimulation,
      };
    case OnboardingSteps.STEP_COMPLETE:
      return {
        label: "Warp Gate",
        subtitle: "Prechod do Stage 2",
        tone: "complete",
        dropTitle: "Dokonceni Stage 1",
        dropHint: "Pretahni Warp Gate do drop zony",
        instruction: "Akce potvrdi stage a pusti standardni workspace flow.",
        onDrop: handlers.onAdvanceStage,
      };
    default:
      return null;
  }
}

export default function ImmersiveOnboardingLayer({
  active = false,
  step = OnboardingSteps.STEP_UNLOCKED,
  mission = null,
  busy = false,
  info = "",
  onAcknowledgeIntro,
  onRunBlueprint,
  onRunDependencies,
  onRunCalculations,
  onRunSimulation,
  onConfirmSchema,
  onDropPlanet,
  onAdvanceStage,
}) {
  const [dragging, setDragging] = useState(false);
  const [schemaPresetKey, setSchemaPresetKey] = useState("");
  const [schemaAssemblyState, setSchemaAssemblyState] = useState(createSchemaAssemblyState);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (active && step === OnboardingSteps.STEP_SCHEMA) return;
    setSchemaPresetKey("");
    setSchemaAssemblyState(createSchemaAssemblyState());
  }, [active, step]);

  const title = useMemo(() => {
    switch (step) {
      case OnboardingSteps.STEP_INTRO:
        return "Singularita";
      case OnboardingSteps.STEP_BLUEPRINT:
        return "Krok 1/6 · Blueprint";
      case OnboardingSteps.STEP_DROP_PLANET:
        return "Krok 2/6 · Materializace";
      case OnboardingSteps.STEP_SCHEMA:
        return "Krok 3/6 · Setup Planety";
      case OnboardingSteps.STEP_DEPENDENCIES:
        return "Krok 4/6 · Vazby";
      case OnboardingSteps.STEP_CALCULATIONS:
        return "Krok 5/6 · Vypocty";
      case OnboardingSteps.STEP_SIMULATION:
        return "Krok 6/6 · Simulace";
      case OnboardingSteps.STEP_COMPLETE:
        return "Stage 1 · Hotovo";
      default:
        return "Onboarding";
    }
  }, [step]);

  const stepDragAction = useMemo(
    () =>
      resolveStepDragAction(step, {
        onRunBlueprint,
        onDropPlanet,
        onConfirmSchema,
        onRunDependencies,
        onRunCalculations,
        onRunSimulation,
        onAdvanceStage,
      }),
    [step, onRunBlueprint, onDropPlanet, onConfirmSchema, onRunDependencies, onRunCalculations, onRunSimulation, onAdvanceStage]
  );

  if (!active || step === OnboardingSteps.STEP_UNLOCKED) return null;

  const completion = Math.max(0, Math.min(100, Number(mission?.completionPct || 0)));
  const summary = mission && typeof mission === "object" ? mission : {};
  const dragTheme = resolveTokenTheme(stepDragAction?.tone || "default");
  const flowRows = resolveFlowRows(step);
  const statusLine =
    step === OnboardingSteps.STEP_SCHEMA || step === OnboardingSteps.STEP_COMPLETE
      ? `Stav: ${completion}% · Planeta ${summary.hasFinanceTable ? "OK" : "..."} · Schema ${summary.schemaDefined ? "OK" : "..."} · Data ${summary.sampleRowsReady ? "OK" : "..."}`
      : `Stav: ${completion}% · Planeta ${summary.hasFinanceTable ? "OK" : "..."} · Vazby ${summary.dependenciesReady ? "OK" : "..."} · Vypocty ${summary.calculationsReady ? "OK" : "..."}`;

  return (
    <AnimatePresence>
      {step === OnboardingSteps.STEP_INTRO ? (
        <motion.section
          key="immersive-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(circle at 50% 46%, rgba(55, 131, 168, 0.18) 0%, rgba(8, 17, 31, 0.8) 42%, rgba(2, 6, 12, 0.96) 78%)",
          }}
        >
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.28, delay: 0.1 }}
            style={{
              width: "min(760px, calc(100vw - 32px))",
              border: "1px solid rgba(108, 205, 238, 0.34)",
              borderRadius: 16,
              background: "rgba(5, 14, 25, 0.92)",
              boxShadow: "0 0 50px rgba(45, 150, 198, 0.26)",
              padding: "22px 20px",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.86, 1, 0.86] }}
                transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 34% 30%, #d6f7ff 0%, #78d8ff 26%, #2f84bf 55%, #0b2a4f 100%)",
                  boxShadow: "0 0 48px rgba(114, 207, 243, 0.58), inset -14px -16px 34px rgba(4, 18, 36, 0.78)",
                }}
              />
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.76 }}>
                PRVOTNI KOSMICKY OBJEKT
              </div>
            </div>
            <div style={{ fontSize: "var(--dv-fs-3xl)", fontWeight: 800, textAlign: "center" }}>
              Prave vstupujes do prazdneho prostoru
            </div>
            <div style={{ fontSize: "var(--dv-fs-md)", lineHeight: "var(--dv-lh-relaxed)", opacity: 0.9, textAlign: "center" }}>
              Prostor je nekonecny a tvaryny. Nez zacnes tvorit data, musis pochopit jeho zakony:
              Planeta je kontejner tabulky, Mesic je zaznam a Vazby nesou kauzalitu.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onAcknowledgeIntro}
                style={{
                  border: "1px solid rgba(104, 192, 224, 0.34)",
                  borderRadius: 10,
                  background: "linear-gradient(120deg, #67dcff, #8cf3ff)",
                  color: "#03111e",
                  fontSize: "var(--dv-fs-sm)",
                  fontWeight: 700,
                  padding: "9px 14px",
                  cursor: "pointer",
                }}
              >
                Zahajit vycvik
              </button>
            </div>
          </motion.div>
        </motion.section>
      ) : (
        <motion.section
          key="immersive-hud"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{ position: "fixed", inset: 0, zIndex: 110, pointerEvents: "none" }}
        >
          {stepDragAction ? (
            <DndContext
              sensors={sensors}
              onDragStart={() => setDragging(true)}
              onDragEnd={(event) => {
                setDragging(false);
                if (busy) return;
                if (String(event?.active?.id || "") !== ACTION_TOKEN_ID) return;
                const droppedInZone = event?.over?.id === DROP_ZONE_ID;
                const dx = Number(event?.delta?.x || 0);
                const dy = Number(event?.delta?.y || 0);
                const dragDistance = Math.hypot(dx, dy);
                const realDrag = droppedInZone || dragDistance >= 4;
                if (!realDrag) return;
                stepDragAction.onDrop?.();
              }}
              onDragCancel={() => setDragging(false)}
            >
              <CanvasDropzone
                active
                title={stepDragAction.dropTitle}
                hint={stepDragAction.dropHint}
                insetRight={Math.max(24, SIDE_PANEL_WIDTH + 30)}
              />
              <DragOverlay>
                {dragging ? (
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: "50%",
                      background: dragTheme.orb,
                      boxShadow: dragTheme.glow,
                    }}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : null}

          <motion.aside
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              right: 14,
              top: 14,
              width: `min(${SIDE_PANEL_WIDTH}px, calc(100vw - 28px))`,
              height: "calc(100vh - 28px)",
              border: "1px solid rgba(108, 205, 238, 0.34)",
              borderRadius: 16,
              background: "rgba(5, 13, 24, 0.9)",
              color: "#d9f8ff",
              backdropFilter: "blur(14px)",
              boxShadow: "0 0 40px rgba(34, 132, 182, 0.26)",
              padding: "14px 12px",
              display: "grid",
              gridTemplateRows: "auto auto auto 1fr auto",
              gap: 10,
              pointerEvents: "auto",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>IMMERSIVE FLOW</div>
              <div style={{ fontSize: "var(--dv-fs-lg)", fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88 }}>{stepDescription(step)}</div>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "rgba(68, 116, 146, 0.44)", overflow: "hidden" }}>
              <motion.div
                initial={false}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.22 }}
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #58d5ff, #8ef7e2)",
                }}
              />
            </div>
            <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>{statusLine}</div>
            <div
              style={{
                minHeight: 0,
                overflowY: "auto",
                paddingRight: 2,
                display: "grid",
                gap: 8,
              }}
            >
              {flowRows.map((row, index) => {
                const isActiveRow = row.status === "active";
                const isDoneRow = row.status === "done";
                return (
                  <motion.div
                    key={row.step}
                    layout
                    style={{
                      border: isActiveRow ? "1px solid rgba(118, 222, 255, 0.5)" : "1px solid rgba(91, 162, 191, 0.26)",
                      borderRadius: 12,
                      background: isActiveRow ? "rgba(11, 29, 45, 0.9)" : "rgba(8, 20, 34, 0.76)",
                      padding: "8px 9px",
                      display: "grid",
                      gap: 6,
                      opacity: row.status === "locked" ? 0.62 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "var(--dv-fs-2xs)",
                            border: isDoneRow
                              ? "1px solid rgba(136, 255, 190, 0.6)"
                              : isActiveRow
                                ? "1px solid rgba(126, 226, 255, 0.6)"
                                : "1px solid rgba(129, 172, 196, 0.34)",
                            color: isDoneRow ? "#89f4b9" : isActiveRow ? "#8adfff" : "#8eb3c8",
                            background: "rgba(4, 14, 26, 0.72)",
                          }}
                        >
                          {isDoneRow ? "✓" : index + 1}
                        </div>
                        <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>{row.title}</div>
                      </div>
                      <span
                        style={{
                          fontSize: "var(--dv-fs-2xs)",
                          letterSpacing: "var(--dv-tr-wide)",
                          borderRadius: 999,
                          padding: "2px 6px",
                          border: "1px solid rgba(123, 206, 240, 0.34)",
                          background: "rgba(8, 23, 39, 0.86)",
                          opacity: 0.88,
                        }}
                      >
                        {row.domain}
                      </span>
                    </div>
                    <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>{row.note}</div>
                    {isActiveRow && step === OnboardingSteps.STEP_SCHEMA ? (
                      <SchemaPresetWorkbench
                        presetKey={schemaPresetKey}
                        assemblyState={schemaAssemblyState}
                        busy={busy}
                        onPickPreset={(key) => {
                          const next = String(key || "");
                          setSchemaPresetKey(next);
                          setSchemaAssemblyState(createSchemaAssemblyState());
                        }}
                        onAssemblePart={(partId) => {
                          const partKey = String(partId || "");
                          if (!partKey) return;
                          setSchemaAssemblyState((prev) => {
                            if (!Object.prototype.hasOwnProperty.call(prev, partKey)) return prev;
                            if (prev[partKey]) return prev;
                            return {
                              ...prev,
                              [partKey]: true,
                            };
                          });
                        }}
                        onIgnite={() => {
                          if (!isSchemaAssemblyComplete(schemaAssemblyState) || busy) return;
                          onConfirmSchema?.();
                        }}
                      />
                    ) : null}
                    {isActiveRow && stepDragAction ? (
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.8 }}>
                          AKTIVNI NASTROJ - DRAG & DROP
                        </div>
                        <DraggableActionToken
                          disabled={busy}
                          label={stepDragAction.label}
                          subtitle={stepDragAction.subtitle}
                          tone={stepDragAction.tone}
                          compact
                        />
                        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>{stepDragAction.instruction}</div>
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
            {info ? <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.84 }}>{info}</div> : null}
          </motion.aside>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
