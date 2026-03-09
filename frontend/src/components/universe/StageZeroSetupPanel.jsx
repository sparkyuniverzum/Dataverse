import { useEffect, useMemo, useState } from "react";

import { isStageZeroStepUnlocked } from "./stageZeroBuilder";

export function StageZeroSetupPanel({
  stageZeroPlanetName,
  stageZeroPresetSelected,
  stageZeroPresetCatalogLoading,
  stageZeroPresetCatalogError,
  stageZeroPresetCards,
  stageZeroPresetBundleKey,
  stageZeroAssemblyMode,
  stageZeroSchemaDraft,
  stageZeroSteps,
  stageZeroDraggedSchemaKey,
  stageZeroSchemaSummary,
  stageZeroVisualBoost,
  stageZeroSchemaPreview,
  stageZeroAllSchemaStepsDone,
  stageZeroCommitDisabledReason,
  stageZeroCommitError,
  stageZeroCommitBusy,
  onSelectPreset,
  onChangePreset,
  onSchemaBlockDragStart,
  onSchemaBlockDragEnd,
  onSchemaStep,
  onSchemaBlockDrop,
  onResetDraggedSchemaKey,
  onAssemblyModeChange,
  onCommitPreset,
  onClose,
}) {
  const isManualAssembly = String(stageZeroAssemblyMode || "lego").toLowerCase() === "manual";
  const defaultManualFields = useMemo(() => {
    const result = {};
    (Array.isArray(stageZeroSteps) ? stageZeroSteps : []).forEach((step) => {
      result[step.key] = {
        fieldKey: String(step.fieldKey || "").trim(),
        fieldType:
          String(step.fieldType || "string")
            .trim()
            .toLowerCase() || "string",
      };
    });
    return result;
  }, [stageZeroSteps]);
  const [manualFields, setManualFields] = useState(defaultManualFields);

  useEffect(() => {
    setManualFields(defaultManualFields);
  }, [defaultManualFields, stageZeroPresetBundleKey]);

  return (
    <aside
      data-testid="stage0-setup-panel"
      style={{
        position: "fixed",
        right: 12,
        top: 232,
        zIndex: 58,
        width: "min(420px, calc(100vw - 24px))",
        borderRadius: 14,
        border: "1px solid rgba(112, 203, 238, 0.34)",
        background: "rgba(5, 13, 24, 0.88)",
        color: "#ddf7ff",
        padding: 12,
        display: "grid",
        gap: 8,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>SETUP PANEL</div>
      <div style={{ fontSize: "var(--dv-fs-sm)", lineHeight: "var(--dv-lh-base)" }}>
        Výborně. <strong>{stageZeroPlanetName || "Planeta"}</strong> slouží jako kontejner pro civilizaci (řádky dat).
        Aby v ní nebyl chaos, nastavíme základní schéma krok za krokem.
      </div>
      {!stageZeroPresetSelected ? (
        <>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
            Vesmír nebudujeme od nuly, používáme prověřené nákresy. Vyber si pro začátek Cashflow.
          </div>
          {stageZeroPresetCatalogLoading ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>Nacitam katalog presetu...</div>
          ) : null}
          {stageZeroPresetCatalogError ? (
            <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffc08f" }}>
              {stageZeroPresetCatalogError}. Pokracuji se statickym fallback katalogem.
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            {stageZeroPresetCards.map((preset) => {
              const locked = Boolean(preset.locked);
              return (
                <button
                  key={preset.key}
                  type="button"
                  data-testid={`stage0-preset-${preset.key}`}
                  onClick={() => void onSelectPreset(preset)}
                  disabled={locked}
                  style={{
                    border: locked ? "1px solid rgba(110, 198, 229, 0.2)" : "1px solid rgba(142, 234, 255, 0.62)",
                    background: locked
                      ? "rgba(7, 18, 32, 0.8)"
                      : "linear-gradient(120deg, rgba(35, 165, 207, 0.42), rgba(88, 226, 255, 0.2))",
                    color: locked ? "#8fb9c9" : "#dcfcff",
                    borderRadius: 10,
                    padding: "10px 11px",
                    textAlign: "left",
                    fontWeight: locked ? 500 : 700,
                    cursor: locked ? "not-allowed" : "pointer",
                    boxShadow:
                      !locked && stageZeroPresetBundleKey === String(preset.bundleKey || preset.key || "")
                        ? "0 0 24px rgba(121, 242, 255, 0.38)"
                        : locked
                          ? "none"
                          : "0 0 18px rgba(98, 223, 255, 0.24)",
                    display: "grid",
                    gap: 3,
                  }}
                >
                  <span>{preset.label}</span>
                  {locked ? (
                    <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>{preset.lockReason}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              border: "1px solid rgba(95, 188, 220, 0.26)",
              borderRadius: 10,
              background: "rgba(7, 18, 32, 0.74)",
              padding: "8px 9px",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.92 }}>
              Stavební plán: skládej schéma z Lego dílků (klik nebo drag & drop).
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                Aktivni preset:{" "}
                <strong>
                  {stageZeroPresetCards.find(
                    (item) => String(item.bundleKey || item.key || "") === String(stageZeroPresetBundleKey || "")
                  )?.label ||
                    stageZeroPresetBundleKey ||
                    "neznamy"}
                </strong>
              </div>
              <button
                type="button"
                data-testid="stage0-change-preset-button"
                onClick={onChangePreset}
                style={{
                  border: "1px solid rgba(114, 219, 252, 0.5)",
                  background: "rgba(8, 22, 36, 0.72)",
                  color: "#d7f7ff",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: "var(--dv-fs-xs)",
                  cursor: "pointer",
                }}
              >
                Zmenit preset
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onAssemblyModeChange("lego")}
                style={{
                  border: "1px solid rgba(114, 219, 252, 0.5)",
                  background: isManualAssembly ? "rgba(8, 22, 36, 0.72)" : "linear-gradient(120deg, #21bbea, #44d8ff)",
                  color: isManualAssembly ? "#d7f7ff" : "#072737",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: "var(--dv-fs-xs)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Skladacka
              </button>
              <button
                type="button"
                onClick={() => onAssemblyModeChange("manual")}
                style={{
                  border: "1px solid rgba(114, 219, 252, 0.5)",
                  background: isManualAssembly ? "linear-gradient(120deg, #21bbea, #44d8ff)" : "rgba(8, 22, 36, 0.72)",
                  color: isManualAssembly ? "#072737" : "#d7f7ff",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: "var(--dv-fs-xs)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Rucni
              </button>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
              Vizuální odezva planety: {stageZeroSchemaSummary.completed}/{stageZeroSchemaSummary.total} dílků • zář +
              {Math.round(stageZeroVisualBoost.emissiveBoost * 100)}%
            </div>
          </div>

          {!isManualAssembly ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Array.isArray(stageZeroSteps) ? stageZeroSteps : []).map((step, index) => {
                const unlocked = isStageZeroStepUnlocked(index, stageZeroSchemaDraft, stageZeroSteps);
                const done = Boolean(stageZeroSchemaDraft[step.key]);
                return (
                  <button
                    key={`tray-${step.key}`}
                    type="button"
                    data-testid={`stage0-tray-${step.key}`}
                    draggable={unlocked && !done}
                    onDragStart={(event) => {
                      if (!unlocked || done) return;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", step.key);
                      onSchemaBlockDragStart(step.key);
                    }}
                    onDragEnd={onSchemaBlockDragEnd}
                    onClick={() => {
                      if (!unlocked || done) return;
                      onSchemaStep(step.key);
                    }}
                    disabled={!unlocked || done}
                    style={{
                      border: done ? "1px solid rgba(120, 232, 182, 0.6)" : "1px solid rgba(114, 219, 252, 0.5)",
                      background: done
                        ? "linear-gradient(120deg, rgba(30, 94, 67, 0.9), rgba(30, 136, 92, 0.7))"
                        : "linear-gradient(120deg, rgba(33, 187, 234, 0.24), rgba(68, 216, 255, 0.14))",
                      color: done ? "#d8ffea" : "#d7f7ff",
                      borderRadius: 9,
                      padding: "7px 10px",
                      fontSize: "var(--dv-fs-xs)",
                      cursor: !unlocked || done ? "default" : "grab",
                      opacity: unlocked ? 1 : 0.58,
                    }}
                  >
                    {done ? "✓ " : "+ "}
                    {step.blockLabel}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>
              Rucni rezim: u kazdeho kroku vypln `klic + typ` a potvrd slot.
            </div>
          )}

          {(Array.isArray(stageZeroSteps) ? stageZeroSteps : []).map((step, index) => {
            const unlocked = isStageZeroStepUnlocked(index, stageZeroSchemaDraft, stageZeroSteps);
            const done = Boolean(stageZeroSchemaDraft[step.key]);
            const manualField = manualFields[step.key] || { fieldKey: "", fieldType: "string" };
            const isDragTarget = stageZeroDraggedSchemaKey && stageZeroDraggedSchemaKey === step.key;
            return (
              <div
                key={step.key}
                onDragOver={(event) => {
                  if (!unlocked || done) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (isManualAssembly) return;
                  if (!unlocked || done) return;
                  event.preventDefault();
                  const droppedKey = String(
                    event.dataTransfer?.getData("text/plain") || stageZeroDraggedSchemaKey || ""
                  );
                  if (droppedKey !== step.key) {
                    onResetDraggedSchemaKey();
                    return;
                  }
                  onSchemaBlockDrop(step.key, index);
                }}
                style={{
                  border: done
                    ? "1px solid rgba(116, 228, 170, 0.36)"
                    : isDragTarget
                      ? "1px solid rgba(144, 233, 255, 0.72)"
                      : "1px solid rgba(98, 188, 220, 0.24)",
                  borderRadius: 10,
                  background: done ? "rgba(15, 44, 34, 0.78)" : "rgba(6, 17, 30, 0.7)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 8,
                  opacity: unlocked ? 1 : 0.58,
                  transition: "border-color 150ms ease, box-shadow 150ms ease",
                  boxShadow: isDragTarget ? "0 0 16px rgba(98, 223, 255, 0.24)" : "none",
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
                  {step.title}: <strong>{step.sentence}</strong> {step.instruction}
                </div>
                <div
                  style={{
                    border: "1px dashed rgba(114, 219, 252, 0.34)",
                    borderRadius: 8,
                    padding: "7px 9px",
                    fontSize: "var(--dv-fs-xs)",
                    color: done ? "#d9ffea" : "#a0d4e4",
                  }}
                >
                  {done
                    ? `Slot osazen: ${step.blockLabel} ✓`
                    : "Slot prázdný: přetáhni díl sem nebo klikni na díl v trayi."}
                </div>
                <button
                  type="button"
                  data-testid={`stage0-schema-add-${step.key}`}
                  onClick={() => {
                    if (isManualAssembly) {
                      const keyFilled = String(manualField.fieldKey || "").trim();
                      if (!keyFilled) return;
                    }
                    onSchemaStep(step.key);
                  }}
                  disabled={!unlocked || done}
                  style={{
                    border: "1px solid rgba(114, 219, 252, 0.5)",
                    background: done ? "rgba(25, 75, 58, 0.86)" : "linear-gradient(120deg, #21bbea, #44d8ff)",
                    color: done ? "#d7ffe5" : "#072737",
                    borderRadius: 9,
                    padding: "7px 10px",
                    fontWeight: 700,
                    cursor: !unlocked || done ? "default" : "pointer",
                  }}
                >
                  {done ? "Přidáno ✓" : isManualAssembly ? "Potvrdit slot" : `+ ${step.blockLabel}`}
                </button>
                {isManualAssembly && !done ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <input
                      value={manualField.fieldKey}
                      onChange={(event) => {
                        const nextValue = String(event.target.value || "")
                          .trim()
                          .toLowerCase()
                          .replace(/\s+/g, "_");
                        setManualFields((prev) => ({
                          ...prev,
                          [step.key]: {
                            ...(prev[step.key] || {}),
                            fieldKey: nextValue,
                          },
                        }));
                      }}
                      placeholder={`klic (napr. ${step.fieldKey})`}
                      style={{
                        border: "1px solid rgba(114, 219, 252, 0.34)",
                        background: "rgba(8, 21, 35, 0.76)",
                        color: "#dff8ff",
                        borderRadius: 7,
                        padding: "6px 8px",
                        fontSize: "var(--dv-fs-xs)",
                      }}
                    />
                    <select
                      value={manualField.fieldType}
                      onChange={(event) => {
                        const nextType =
                          String(event.target.value || "string")
                            .trim()
                            .toLowerCase() || "string";
                        setManualFields((prev) => ({
                          ...prev,
                          [step.key]: {
                            ...(prev[step.key] || {}),
                            fieldType: nextType,
                          },
                        }));
                      }}
                      style={{
                        border: "1px solid rgba(114, 219, 252, 0.34)",
                        background: "rgba(8, 21, 35, 0.76)",
                        color: "#dff8ff",
                        borderRadius: 7,
                        padding: "6px 8px",
                        fontSize: "var(--dv-fs-xs)",
                      }}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="datetime">datetime</option>
                      <option value="json">json</option>
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            style={{
              border: "1px solid rgba(95, 188, 220, 0.26)",
              borderRadius: 10,
              background: "rgba(7, 18, 32, 0.74)",
              padding: "8px 9px",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>Průběžný preview planety</div>
            {stageZeroSchemaPreview.map((item) => (
              <div key={item.key} style={{ fontSize: "var(--dv-fs-xs)", opacity: item.done ? 0.96 : 0.58 }}>
                {(() => {
                  const manualField = manualFields[item.key] || {};
                  const label = isManualAssembly ? String(manualField.fieldKey || item.label || "").trim() : item.label;
                  const type = isManualAssembly ? String(manualField.fieldType || item.type || "").trim() : item.type;
                  return (
                    <>
                      {item.done ? "✓" : "○"} {label || item.label}{" "}
                      <span style={{ opacity: 0.74 }}>({type || item.type})</span>
                    </>
                  );
                })()}
              </div>
            ))}
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
              {isManualAssembly
                ? "Po ulozeni manualniho kontraktu si civilizace doplnis rucne v gridu."
                : "Po zažehnutí jádra se vloží 3 ukázkové civilizační řádky do gridu."}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(120, 217, 247, 0.38)",
              borderRadius: 10,
              background: "rgba(8, 22, 36, 0.74)",
              padding: "8px 10px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
              {stageZeroAllSchemaStepsDone
                ? "Plan je kompletni. Vytvori se struktura o 3 zakonech a nasypou se 3 ukazkove zaznamy."
                : "Dokonci schema kroky, pak muzes zazehnout jadro."}
            </div>
            {stageZeroCommitDisabledReason ? (
              <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffc08f" }}>{stageZeroCommitDisabledReason}</div>
            ) : null}
            {stageZeroCommitError ? (
              <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffb4b4" }}>{stageZeroCommitError}</div>
            ) : null}
            <button
              type="button"
              data-testid="stage0-ignite-core-button"
              onClick={() =>
                void onCommitPreset({
                  manualFields: (Array.isArray(stageZeroSteps) ? stageZeroSteps : []).map((step) => ({
                    fieldKey: String(manualFields[step.key]?.fieldKey || "")
                      .trim()
                      .toLowerCase(),
                    fieldType:
                      String(manualFields[step.key]?.fieldType || "string")
                        .trim()
                        .toLowerCase() || "string",
                  })),
                })
              }
              disabled={Boolean(stageZeroCommitDisabledReason)}
              style={{
                border: "1px solid rgba(130, 233, 255, 0.64)",
                background: "linear-gradient(120deg, #35c1ea, #8cecff)",
                color: "#062535",
                borderRadius: 10,
                padding: "9px 12px",
                fontWeight: 800,
                cursor: stageZeroCommitDisabledReason ? "not-allowed" : "pointer",
                opacity: stageZeroCommitDisabledReason ? 0.64 : 1,
              }}
            >
              {stageZeroCommitBusy ? "Aplikuji..." : "Zažehnout Jádro"}
            </button>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(113, 202, 234, 0.3)",
            background: "rgba(7, 18, 32, 0.86)",
            color: "#d5f5ff",
            borderRadius: 9,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          Zavřít panel
        </button>
      </div>
    </aside>
  );
}
