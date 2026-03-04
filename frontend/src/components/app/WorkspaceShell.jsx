import UniverseWorkspace from "../universe/UniverseWorkspace";

export default function WorkspaceShell({ galaxy, onBackToGalaxies, onLogout }) {
  return (
    <UniverseWorkspace
      galaxy={galaxy}
      minimalShell
      onBackToGalaxies={onBackToGalaxies}
      onLogout={onLogout}
    />
  );
}
