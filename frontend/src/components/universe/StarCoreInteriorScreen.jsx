import StarCoreInteriorScene3d from "./starCoreInteriorScene3d.jsx";
import { resolveStarCoreInteriorVisualModel } from "./starCoreInteriorVisualModel.js";

export default function StarCoreInteriorScreen({
  screenModel,
  interiorModel,
  selectedConstitution = null,
  lockTransitionModel = null,
  onSelectConstitution = () => {},
  onConfirmPolicyLock = () => {},
  onReturnToSpace = () => {},
}) {
  if (!screenModel?.isVisible) return null;

  const constitutionOptions = Array.isArray(interiorModel.availableConstitutions)
    ? interiorModel.availableConstitutions
    : [];
  const focusedConstitution =
    selectedConstitution ||
    constitutionOptions.find((option) => option.id === interiorModel.selectedConstitutionId) ||
    constitutionOptions.find((option) => option.id === interiorModel.recommendedConstitutionId) ||
    constitutionOptions[0] ||
    null;
  const visualModel = resolveStarCoreInteriorVisualModel({
    interiorModel,
    selectedConstitution: focusedConstitution,
    screenModel,
  });

  void lockTransitionModel;
  void onConfirmPolicyLock;
  void onReturnToSpace;

  return (
    <section
      data-testid="star-core-interior-screen"
      aria-label="Srdce hvezdy"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        background:
          "radial-gradient(circle at 50% 42%, rgba(28, 44, 58, 0.18), transparent 24%), linear-gradient(180deg, #05080f 0%, #04070d 44%, #02040a 100%)",
        opacity: visualModel.chamberOpacity,
        overflow: "hidden",
      }}
    >
      <div data-testid="ritual-chamber-core" style={{ position: "absolute", inset: 0 }}>
        <StarCoreInteriorScene3d
          visualModel={visualModel}
          screenModel={screenModel}
          foundationOnly={interiorModel.mode === "observatory"}
          showReactorCore
          onSelectConstitution={onSelectConstitution}
        />
      </div>
    </section>
  );
}
