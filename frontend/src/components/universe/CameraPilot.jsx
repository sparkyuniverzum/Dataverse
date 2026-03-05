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
  focusOffset = [0, 0, 0],
  microNudgeKey = "",
  starDiveActive = false,
  focusKey,
}) {
  const { camera } = useThree();
  const lastFocusKeyRef = useRef("");
  const flightTimeRef = useRef(0);
  const lastMicroNudgeKeyRef = useRef("");
  const microNudgeTimeRef = useRef(0);
  const microNudgePosRef = useRef(new THREE.Vector3());
  const microNudgeLookRef = useRef(new THREE.Vector3());
  const unresolvedSelection =
    !starDiveActive &&
    ((Boolean(selectedAsteroidId) && !selectedAsteroidNode) ||
      (!selectedAsteroidId && Boolean(selectedTableId) && !selectedTableNode));
  const hasExplicitFocusTarget = Boolean(starDiveActive || selectedAsteroidNode || selectedTableNode);

  const fallback = useMemo(() => {
    const tablePositions = tableNodes.map((node) => node.position);
    return computeBounds(tablePositions);
  }, [tableNodes]);

  const target = useMemo(() => {
    if (unresolvedSelection) return null;
    if (starDiveActive) {
      return {
        center: [0, 0, 0],
        distance: 20,
      };
    }
    if (selectedAsteroidNode) {
      return {
        center: selectedAsteroidNode.position,
        distance: 48 + selectedAsteroidNode.radius * 3.4,
      };
    }
    if (selectedTableNode) {
      const offsetX = Number(focusOffset?.[0] || 0);
      const offsetY = Number(focusOffset?.[1] || 0);
      const offsetZ = Number(focusOffset?.[2] || 0);
      return {
        center: [
          Number(selectedTableNode.position?.[0] || 0) + offsetX,
          Number(selectedTableNode.position?.[1] || 0) + offsetY,
          Number(selectedTableNode.position?.[2] || 0) + offsetZ,
        ],
        distance: 180 + selectedTableNode.radius * 4.8,
      };
    }
    return {
      center: fallback.center,
      distance: fallback.radius * 2.8,
    };
  }, [fallback, focusOffset, selectedAsteroidNode, selectedTableNode, starDiveActive, unresolvedSelection]);

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

  useEffect(() => {
    if (unresolvedSelection || !hasExplicitFocusTarget) {
      microNudgeTimeRef.current = 0;
      lastMicroNudgeKeyRef.current = String(microNudgeKey || "");
      return;
    }
    const key = String(microNudgeKey || "");
    if (!key) {
      lastMicroNudgeKeyRef.current = "";
      microNudgeTimeRef.current = 0;
      return;
    }
    if (!lastMicroNudgeKeyRef.current) {
      lastMicroNudgeKeyRef.current = key;
      return;
    }
    if (lastMicroNudgeKeyRef.current !== key) {
      lastMicroNudgeKeyRef.current = key;
      microNudgeTimeRef.current = 0.36;
    }
  }, [hasExplicitFocusTarget, microNudgeKey, unresolvedSelection]);

  useFrame((_, delta) => {
    if (!target || !targetPos || !targetLook) return;
    const inFlight = flightTimeRef.current > 0;
    const hasMicroNudge = microNudgeTimeRef.current > 0;
    const shouldPilot = inFlight || hasMicroNudge;

    if (!shouldPilot) {
      if (controlsRef.current) {
        if (starDiveActive) {
          controlsRef.current.minDistance = 4;
          controlsRef.current.maxDistance = 96;
        } else {
          controlsRef.current.minDistance = Math.max(8, target.distance * 0.22, cameraState.minDistance || 8);
          controlsRef.current.maxDistance = Math.max(320, target.distance * 7, cameraState.maxDistance || 320);
        }
      }
      return;
    }
    const dampLambda = inFlight ? 4.4 : 6.2;
    let nextTargetPos = targetPos;
    let nextTargetLook = targetLook;
    if (hasMicroNudge) {
      const nudgeDuration = 0.36;
      const progress = 1 - Math.max(0, microNudgeTimeRef.current) / nudgeDuration;
      const pulse = Math.sin(progress * Math.PI);
      const distanceScale = starDiveActive ? 0.32 : Math.max(0.72, Math.min(2.4, target.distance * 0.01));
      const nudgeX = pulse * distanceScale;
      const nudgeY = pulse * distanceScale * 0.34;
      nextTargetPos = microNudgePosRef.current.copy(targetPos);
      nextTargetPos.x += nudgeX;
      nextTargetPos.y += nudgeY;
      nextTargetLook = microNudgeLookRef.current.copy(targetLook);
      nextTargetLook.x += nudgeX * 0.24;
      nextTargetLook.y += nudgeY * 0.18;
    }

    dampVec3(camera.position, nextTargetPos, dampLambda, delta);

    if (controlsRef.current) {
      dampVec3(controlsRef.current.target, nextTargetLook, 5.0, delta);
      if (starDiveActive) {
        controlsRef.current.minDistance = 4;
        controlsRef.current.maxDistance = 96;
      } else {
        controlsRef.current.minDistance = Math.max(8, target.distance * 0.22, cameraState.minDistance || 8);
        controlsRef.current.maxDistance = Math.max(320, target.distance * 7, cameraState.maxDistance || 320);
      }
      controlsRef.current.update();
    }

    flightTimeRef.current = Math.max(0, flightTimeRef.current - delta);
    if (hasMicroNudge) {
      microNudgeTimeRef.current = Math.max(0, microNudgeTimeRef.current - delta);
    }
  });

  return null;
}
