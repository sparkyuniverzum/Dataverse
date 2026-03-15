import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";

function normalizeId(value) {
  const text = String(value || "").trim();
  return text || "";
}

function uniqueSorted(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeId(item)).filter(Boolean))].sort();
}

function diff(expected, actual) {
  const expectedSet = new Set(uniqueSorted(expected));
  const actualSet = new Set(uniqueSorted(actual));
  return {
    missing: [...expectedSet].filter((item) => !actualSet.has(item)).sort(),
    extra: [...actualSet].filter((item) => !expectedSet.has(item)).sort(),
  };
}

export function evaluateProjectionConvergence({ snapshot, tables, selectedTableId }) {
  const asteroids = Array.isArray(snapshot?.asteroids) ? snapshot.asteroids : [];
  const bonds = Array.isArray(snapshot?.bonds) ? snapshot.bonds : [];
  const tableRows = Array.isArray(tables) ? tables : [];

  const asteroidById = new Map(asteroids.map((row) => [normalizeId(row?.id), row]).filter(([id]) => Boolean(id)));
  const tableById = new Map(tableRows.map((row) => [normalizeId(row?.table_id), row]).filter(([id]) => Boolean(id)));

  const selectedId = normalizeId(selectedTableId) || normalizeId(tableRows[0]?.table_id);
  const selectedTable = selectedId ? tableById.get(selectedId) || null : null;
  if (!selectedTable) {
    return {
      ok: false,
      reason: "selected_table_missing",
      selected_table_id: selectedId,
      missing_snapshot_members: [],
      selected_member_vs_grid: { missing: [], extra: [] },
      selected_grid_vs_layout: { missing: [], extra: [] },
      invalid_snapshot_bonds: [],
      orphan_table_members: [],
    };
  }

  const orphanTableMembers = [];
  tableRows.forEach((table) => {
    const members = Array.isArray(table?.members) ? table.members : [];
    members.forEach((member) => {
      const id = normalizeId(member?.id);
      if (!id) return;
      if (!asteroidById.has(id)) {
        orphanTableMembers.push({
          table_id: normalizeId(table?.table_id),
          asteroid_id: id,
        });
      }
    });
  });

  const selectedMemberIds = uniqueSorted((selectedTable.members || []).map((member) => member?.id));
  const selectedGridIds = uniqueSorted(
    asteroids.filter((row) => normalizeId(row?.table_id) === selectedId).map((row) => row?.id)
  );

  const layout = calculateHierarchyLayout({
    tables: tableRows,
    selectedTableId: selectedId,
    asteroidById,
  });
  const selectedLayoutIds = uniqueSorted((layout.asteroidNodes || []).map((node) => node?.id));

  const selectedMemberVsGrid = diff(selectedMemberIds, selectedGridIds);
  const selectedGridVsLayout = diff(selectedGridIds, selectedLayoutIds);

  const invalidSnapshotBonds = bonds
    .filter((bond) => {
      const source = normalizeId(bond?.source_id);
      const target = normalizeId(bond?.target_id);
      return !source || !target || !asteroidById.has(source) || !asteroidById.has(target);
    })
    .map((bond) => normalizeId(bond?.id))
    .filter(Boolean);

  const missingSnapshotMembers = selectedMemberIds.filter((id) => !asteroidById.has(id));

  const ok =
    missingSnapshotMembers.length === 0 &&
    selectedMemberVsGrid.missing.length === 0 &&
    selectedMemberVsGrid.extra.length === 0 &&
    selectedGridVsLayout.missing.length === 0 &&
    selectedGridVsLayout.extra.length === 0 &&
    invalidSnapshotBonds.length === 0 &&
    orphanTableMembers.length === 0;

  return {
    ok,
    reason: ok ? "ok" : "projection_grid_layout_diverged",
    selected_table_id: selectedId,
    missing_snapshot_members: missingSnapshotMembers,
    selected_member_vs_grid: selectedMemberVsGrid,
    selected_grid_vs_layout: selectedGridVsLayout,
    invalid_snapshot_bonds: invalidSnapshotBonds,
    orphan_table_members: orphanTableMembers,
  };
}
