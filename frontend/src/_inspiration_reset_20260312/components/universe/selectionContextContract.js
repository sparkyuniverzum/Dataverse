import { resolveCivilizationSelectionPatch } from "../../lib/civilizationWorkspaceSelectionGate";

export const WORKSPACE_CONTEXT_ACTION = Object.freeze({
  FOCUS_TABLE: "focus_table",
  FOCUS_CIVILIZATION: "focus_asteroid",
  OPEN_GRID: "open_grid",
  EXTINGUISH_CIVILIZATION: "extinguish_asteroid",
});

export function resolveMoonSelectionPatch({ moonId = "", previousQuickGridOpen = false, openGrid = false } = {}) {
  return {
    selectedAsteroidId: String(moonId || "").trim(),
    quickGridOpen: openGrid ? true : Boolean(previousQuickGridOpen),
  };
}

export function resolveContextMenuPlacement({
  kind = "",
  id = "",
  label = "",
  x = 0,
  y = 0,
  viewportWidth = 1600,
  viewportHeight = 900,
  menuWidth = 220,
  menuHeight = 170,
  padding = 8,
} = {}) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizedPadding = Math.max(0, Number(padding) || 0);
  return {
    open: true,
    kind: String(kind || ""),
    id: String(id || ""),
    label: String(label || ""),
    x: clamp(
      Number(x || 0),
      normalizedPadding,
      Math.max(normalizedPadding, Number(viewportWidth || 0) - Number(menuWidth || 0) - normalizedPadding)
    ),
    y: clamp(
      Number(y || 0),
      normalizedPadding,
      Math.max(normalizedPadding, Number(viewportHeight || 0) - Number(menuHeight || 0) - normalizedPadding)
    ),
  };
}

export function resolveContextActionPlan({
  actionKey = "",
  contextMenu = null,
  interactionLocked = false,
  previousQuickGridOpen = false,
} = {}) {
  const targetId = String(contextMenu?.id || "").trim();
  const targetKind = String(contextMenu?.kind || "").trim();
  if (!targetId) {
    return { type: "noop" };
  }

  if (actionKey === WORKSPACE_CONTEXT_ACTION.FOCUS_TABLE && targetKind === "table") {
    return {
      type: "selection",
      patch: resolveCivilizationSelectionPatch({
        source: "context",
        tableId: targetId,
        interactionLocked,
        previousQuickGridOpen,
      }),
    };
  }

  if (actionKey === WORKSPACE_CONTEXT_ACTION.FOCUS_CIVILIZATION && targetKind === "asteroid") {
    return {
      type: "selection",
      patch: {
        selectedAsteroidId: targetId,
        quickGridOpen: true,
      },
    };
  }

  if (actionKey === WORKSPACE_CONTEXT_ACTION.OPEN_GRID) {
    if (targetKind === "table") {
      const patch = resolveCivilizationSelectionPatch({
        source: "context",
        tableId: targetId,
        interactionLocked,
        previousQuickGridOpen,
      });
      return {
        type: "selection",
        patch: {
          ...patch,
          quickGridOpen: true,
        },
      };
    }
    if (targetKind === "asteroid") {
      return {
        type: "selection",
        patch: resolveMoonSelectionPatch({
          moonId: targetId,
          previousQuickGridOpen,
          openGrid: true,
        }),
      };
    }
  }

  if (
    actionKey === WORKSPACE_CONTEXT_ACTION.EXTINGUISH_CIVILIZATION &&
    targetKind === "asteroid" &&
    !interactionLocked
  ) {
    return {
      type: "delete_asteroid",
      targetId,
    };
  }

  return { type: "noop" };
}
