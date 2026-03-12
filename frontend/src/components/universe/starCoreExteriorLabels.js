export function resolveStarCoreExteriorLabels({ model = null, exteriorState = null, visualModel = null } = {}) {
  const ringLabels = Array.isArray(model?.ringLabels) ? model.ringLabels : [];
  const first = ringLabels[0] || { key: "GOVERNANCE", value: "UNKNOWN" };
  const second = ringLabels[1] || { key: "PROFILE", value: "UNKNOWN" };
  const third = ringLabels[2] || { key: "PULSE", value: "UNKNOWN" };

  const descriptorText = exteriorState?.approached
    ? "GOVERNANCE ORBITA JE NA DOSAH"
    : exteriorState?.selected
      ? "HVĚZDA JE VYBRANÁ"
      : exteriorState?.unlocked
        ? "HVĚZDA ČEKÁ NA USTÁLENÍ ÚSTAVY"
        : exteriorState?.loading
          ? "SRDCE HVĚZDY SE STABILIZUJE"
          : exteriorState?.unavailable
            ? "GOVERNANCE NENÍ POTVRZENÁ"
            : "HVĚZDA JE ORIENTAČNÍ KOTVA";

  const labelColor = visualModel?.labelColor || "#eefcff";
  const descriptorColor = visualModel?.descriptorColor || labelColor;

  return [
    {
      key: "primary",
      text: `${first.key}: ${first.value}`,
      position: [-3.35, 2.52, 0.15],
      size: 0.24,
      color: labelColor,
    },
    {
      key: "secondary",
      text: `${second.key}: ${second.value}`,
      position: [3.2, 1.95, -0.15],
      size: 0.2,
      color: labelColor,
    },
    {
      key: "tertiary",
      text: `${third.key}: ${third.value}`,
      position: [2.95, -1.85, 0.12],
      size: 0.18,
      color: labelColor,
    },
    {
      key: "descriptor",
      text: descriptorText,
      position: [0, 2.58, 2.45],
      size: 0.17,
      color: descriptorColor,
    },
  ];
}
