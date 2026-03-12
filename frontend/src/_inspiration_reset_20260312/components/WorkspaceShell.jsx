import UniverseWorkspace from "../universe/UniverseWorkspace";

export default function WorkspaceShell({
  galaxy,
  branches = [],
  onboarding = null,
  onBackToGalaxies,
  onLogout,
  onRefreshScopes,
}) {
  return (
    <UniverseWorkspace
      galaxy={galaxy}
      branches={branches}
      onboarding={onboarding}
      minimalShell
      onBackToGalaxies={onBackToGalaxies}
      onLogout={onLogout}
      onRefreshScopes={onRefreshScopes}
    />
  );
}
