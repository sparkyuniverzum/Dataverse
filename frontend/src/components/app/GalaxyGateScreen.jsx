import GalaxySelector3D from "../screens/GalaxySelector3D";
import AppConnectivityNotice from "./AppConnectivityNotice";

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
  connectivityNotice = null,
  interactionLocked = false,
}) {
  return (
    <>
      <AppConnectivityNotice notice={connectivityNotice} />
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
        interactionLocked={interactionLocked}
      />
    </>
  );
}
