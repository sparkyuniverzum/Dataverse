import * as THREE from "three";

import { hashText } from "./sceneMath";

export function resolvePlanetV1Style(metrics) {
  const status = String(metrics?.status || "GREEN").toUpperCase();
  if (status === "RED") {
    return {
      tint: "#ffb5c9",
      emissive: "#ff5f86",
      rim: "#ff8fad",
      auraOpacity: 0.2,
    };
  }
  if (status === "YELLOW") {
    return {
      tint: "#ffe9bb",
      emissive: "#ffbe57",
      rim: "#ffd27f",
      auraOpacity: 0.17,
    };
  }
  return {
    tint: "#d6fbff",
    emissive: "#66dcff",
    rim: "#90e5ff",
    auraOpacity: 0.14,
  };
}

export function resolveMoonV1Style(metrics) {
  const status = String(metrics?.status || "GREEN").toUpperCase();
  if (status === "RED") {
    return {
      color: "#ffd0dc",
      emissive: "#ff5f86",
      aura: "#ff8daa",
    };
  }
  if (status === "YELLOW") {
    return {
      color: "#ffedc8",
      emissive: "#ffbe57",
      aura: "#ffd38a",
    };
  }
  return {
    color: "#d8f3ff",
    emissive: "#3ac4ff",
    aura: "#8fe1ff",
  };
}

export function signatureColorFromSeed(seedText) {
  const hue = (hashText(seedText) % 360) / 360;
  const color = new THREE.Color();
  color.setHSL(hue, 0.66, 0.6);
  return color;
}
