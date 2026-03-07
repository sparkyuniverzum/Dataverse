import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { computeBounds, resolveCameraTarget, resolveControlDistanceLimits } from "./cameraPilotMath";

function dampVec3(current, target, lambda, delta) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta);
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
  reducedMotion = false,
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
    return resolveCameraTarget({
      unresolvedSelection,
      starDiveActive,
      selectedAsteroidNode,
      selectedTableNode,
      focusOffset,
      fallback,
    });
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
    if (reducedMotion) {
      flightTimeRef.current = 0;
      lastFocusKeyRef.current = String(focusKey || "");
      return;
    }
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
  }, [focusKey, hasExplicitFocusTarget, reducedMotion, unresolvedSelection]);

  useEffect(() => {
    if (reducedMotion) {
      microNudgeTimeRef.current = 0;
      lastMicroNudgeKeyRef.current = String(microNudgeKey || "");
      return;
    }
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
  }, [hasExplicitFocusTarget, microNudgeKey, reducedMotion, unresolvedSelection]);

  useEffect(() => {
    if (!reducedMotion || unresolvedSelection || !target || !targetPos || !targetLook) return;
    camera.position.copy(targetPos);
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetLook);
      const limits = resolveControlDistanceLimits({
        starDiveActive,
        targetDistance: target.distance,
        cameraState,
      });
      controlsRef.current.minDistance = limits.minDistance;
      controlsRef.current.maxDistance = limits.maxDistance;
      controlsRef.current.update();
    }
  }, [
    camera,
    cameraState,
    controlsRef,
    reducedMotion,
    starDiveActive,
    target,
    targetLook,
    targetPos,
    unresolvedSelection,
  ]);

  useFrame((_, delta) => {
    if (!target || !targetPos || !targetLook) return;
    const inFlight = flightTimeRef.current > 0;
    const hasMicroNudge = microNudgeTimeRef.current > 0;
    const shouldPilot = inFlight || hasMicroNudge;

    if (reducedMotion || !shouldPilot) {
      if (controlsRef.current) {
        const limits = resolveControlDistanceLimits({
          starDiveActive,
          targetDistance: target.distance,
          cameraState,
        });
        controlsRef.current.minDistance = limits.minDistance;
        controlsRef.current.maxDistance = limits.maxDistance;
      }
      if (reducedMotion && controlsRef.current) {
        controlsRef.current.target.copy(targetLook);
        controlsRef.current.update();
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
      const limits = resolveControlDistanceLimits({
        starDiveActive,
        targetDistance: target.distance,
        cameraState,
      });
      controlsRef.current.minDistance = limits.minDistance;
      controlsRef.current.maxDistance = limits.maxDistance;
      controlsRef.current.update();
    }

    flightTimeRef.current = Math.max(0, flightTimeRef.current - delta);
    if (hasMicroNudge) {
      microNudgeTimeRef.current = Math.max(0, microNudgeTimeRef.current - delta);
    }
  });

  return null;
}
