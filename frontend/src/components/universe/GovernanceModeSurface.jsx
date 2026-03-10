import StarHeartDashboard from "./StarHeartDashboard";

export function GovernanceModeSurface({
  governanceMode,
  phase,
  starCoreProfile,
  starPolicy,
  starPhysicsProfile,
  starRuntime,
  starDomains,
  parserTelemetry,
  parserExecutionMode,
  selectedProfileKey,
  selectedPhysicalProfileKey,
  applyBusy = false,
  applyError = "",
  onSelectProfile,
  onSelectPhysicalProfile,
  onApplyProfileLock,
  onClose,
}) {
  if (!governanceMode?.open) return null;

  return (
    <div data-testid="governance-mode-surface" data-governance-mode={governanceMode.mode}>
      <StarHeartDashboard
        open={governanceMode.open}
        phase={phase}
        starCoreProfile={starCoreProfile}
        starPolicy={starPolicy}
        starPhysicsProfile={starPhysicsProfile}
        starRuntime={starRuntime}
        starDomains={starDomains}
        parserTelemetry={parserTelemetry}
        parserExecutionMode={parserExecutionMode}
        selectedProfileKey={selectedProfileKey}
        selectedPhysicalProfileKey={selectedPhysicalProfileKey}
        applyBusy={applyBusy}
        applyError={applyError}
        onSelectProfile={onSelectProfile}
        onSelectPhysicalProfile={onSelectPhysicalProfile}
        onApplyProfileLock={onApplyProfileLock}
        onClose={onClose}
      />
    </div>
  );
}
