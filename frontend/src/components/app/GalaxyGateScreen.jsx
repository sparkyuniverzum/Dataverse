import GalaxySelector3D from "../screens/GalaxySelector3D";

export default function GalaxyGateScreen({
  user,
  galaxies,
  selectedGalaxyId,
  branchesByGalaxyId,
  onboardingByGalaxyId,
  newGalaxyName,
  loading,
  busy,
  error,
  onSelect,
  onCreate,
  onNameChange,
  onLoadBranches,
  onLoadOnboarding,
  onRefresh,
  onLogout,
}) {
  return (
    <GalaxySelector3D
      user={user}
      galaxies={galaxies}
      selectedGalaxyId={selectedGalaxyId}
      branchesByGalaxyId={branchesByGalaxyId}
      onboardingByGalaxyId={onboardingByGalaxyId}
      newGalaxyName={newGalaxyName}
      loading={loading}
      busy={busy}
      error={error}
      onSelect={onSelect}
      onCreate={onCreate}
      onNameChange={onNameChange}
      onLoadBranches={onLoadBranches}
      onLoadOnboarding={onLoadOnboarding}
      onRefresh={onRefresh}
      onLogout={onLogout}
    />
  );
}
