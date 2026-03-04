import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function dampVec3(current, target, lambda, delta) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta);
}

function computeBounds(positions) {
  if (!positions?.length) {
    return {
      center: [0, 0, 0],
      radius: 140,
    };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  positions.forEach((p) => {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    minZ = Math.min(minZ, p[2]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
    maxZ = Math.max(maxZ, p[2]);
  });

  const center = [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const radius = Math.max(80, Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.7);
  return { center, radius };
}

export default function CameraPilot({
  controlsRef,
  cameraState,
  tableNodes,
  selectedTableNode,
  selectedAsteroidNode,
  selectedTableId,
  selectedAsteroidId,
  focusKey,
}) {
  const { camera } = useThree();
  const lastFocusKeyRef = useRef("");
  const flightTimeRef = useRef(0);
  const unresolvedSelection =
    (Boolean(selectedAsteroidId) && !selectedAsteroidNode) ||
    (!selectedAsteroidId && Boolean(selectedTableId) && !selectedTableNode);
  const hasExplicitFocusTarget = Boolean(selectedAsteroidNode || selectedTableNode);

  const fallback = useMemo(() => {
    const tablePositions = tableNodes.map((node) => node.position);
    return computeBounds(tablePositions);
  }, [tableNodes]);

  const target = useMemo(() => {
    if (unresolvedSelection) return null;
    if (selectedAsteroidNode) {
      return {
        center: selectedAsteroidNode.position,
        distance: 48 + selectedAsteroidNode.radius * 3.4,
      };
    }
    if (selectedTableNode) {
      return {
        center: selectedTableNode.position,
        distance: 180 + selectedTableNode.radius * 4.8,
      };
    }
    return {
      center: fallback.center,
      distance: fallback.radius * 2.8,
    };
  }, [fallback, selectedAsteroidNode, selectedTableNode, unresolvedSelection]);

  const targetPos = useMemo(() => {
    if (!target) return null;
    const [tx, ty, tz] = target.center;
    return new THREE.Vector3(tx + target.distance * 0.24, ty + target.distance * 0.19, tz + target.distance);
  }, [target]);

  const targetLook = useMemo(() => {
    if (!target) return null;
    const [tx, ty, tz] = target.center;
    return new THREE.Vector3(tx, ty, tz);
  }, [target]);

  useEffect(() => {
    if (unresolvedSelection) return;
    if (!hasExplicitFocusTarget) {
      flightTimeRef.current = 0;
      lastFocusKeyRef.current = String(focusKey || "");
      return;
    }
    const key = String(focusKey || "");
    if (lastFocusKeyRef.current !== key) {
      lastFocusKeyRef.current = key;
      flightTimeRef.current = 0.95;
    }
  }, [focusKey, hasExplicitFocusTarget, unresolvedSelection]);

  useFrame((_, delta) => {
    if (!target || !targetPos || !targetLook) return;
    const inFlight = flightTimeRef.current > 0;

    if (!inFlight) {
      if (controlsRef.current) {
        controlsRef.current.minDistance = Math.max(8, target.distance * 0.22, cameraState.minDistance || 8);
        controlsRef.current.maxDistance = Math.max(320, target.distance * 7, cameraState.maxDistance || 320);
      }
      return;
    }

    dampVec3(camera.position, targetPos, 4.4, delta);

    if (controlsRef.current) {
      dampVec3(controlsRef.current.target, targetLook, 5.0, delta);
      controlsRef.current.minDistance = Math.max(8, target.distance * 0.22, cameraState.minDistance || 8);
      controlsRef.current.maxDistance = Math.max(320, target.distance * 7, cameraState.maxDistance || 320);
      controlsRef.current.update();
    }

    flightTimeRef.current = Math.max(0, flightTimeRef.current - delta);
  });

  return null;
}
