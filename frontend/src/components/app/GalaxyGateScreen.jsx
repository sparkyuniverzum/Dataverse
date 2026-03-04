import GalaxySelector3D from "../screens/GalaxySelector3D";

export default function GalaxyGateScreen({
  user,
  galaxies,
  selectedGalaxyId,
  newGalaxyName,
  loading,
  busy,
  error,
  onSelect,
  onCreate,
  onNameChange,
  onRefresh,
  onLogout,
}) {
  return (
    <GalaxySelector3D
      user={user}
      galaxies={galaxies}
      selectedGalaxyId={selectedGalaxyId}
      newGalaxyName={newGalaxyName}
      loading={loading}
      busy={busy}
      error={error}
      onSelect={onSelect}
      onCreate={onCreate}
      onNameChange={onNameChange}
      onRefresh={onRefresh}
      onLogout={onLogout}
    />
  );
}
