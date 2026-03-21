import { Suspense, useEffect, useMemo, useRef } from "react";

import * as THREE from "three";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Environment, Float, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import finalAssetUrl from "../../../assets/r3f_final_package/public/assets/final.glb?url";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorFromHex(value, fallback) {
  try {
    return new THREE.Color(String(value || fallback));
  } catch {
    return new THREE.Color(fallback);
  }
}

function resolvePhaseDrift(phase) {
  if (phase === "policy_lock_transition") {
    return {
      target: new THREE.Vector3(0, -0.02, 2.18),
      position: new THREE.Vector3(0, -5.72, 3.02),
    };
  }
  if (phase === "first_orbit_ready") {
    return {
      target: new THREE.Vector3(0, 0.02, 2.3),
      position: new THREE.Vector3(0, -5.54, 3.12),
    };
  }
  return {
    target: new THREE.Vector3(0, -0.1, 1.98),
    position: new THREE.Vector3(0, -5.95, 3.18),
  };
}

function AssetCameraRig({ screenModel, visualModel }) {
  const cameraRef = useRef(null);
  const startedAtRef = useRef(0);
  const activeStageRef = useRef("");
  const { set } = useThree((state) => state);

  useEffect(() => {
    const stage = String(screenModel?.stage || "active");
    if (activeStageRef.current !== stage) {
      activeStageRef.current = stage;
      startedAtRef.current = performance.now();
    }
  }, [screenModel?.stage]);

  useFrame((state, delta) => {
    if (!cameraRef.current) return;

    const stage = String(screenModel?.stage || "active");
    const durationMs = Math.max(40, Number(screenModel?.transitionDurationMs) || 760);
    const progress = clamp((performance.now() - startedAtRef.current) / durationMs, 0, 1);
    const eased = easeInOutCubic(progress);
    const pulseStrength = clamp(Number(visualModel?.pulseStrength) || 0, 0, 1);
    const chamberDepth = clamp(Number(visualModel?.chamberDepth) || 0.45, 0, 1);
    const phase = String(visualModel?.phase || "constitution_select");
    const drift = resolvePhaseDrift(phase);

    let targetPosition = drift.position.clone();
    let targetLookAt = drift.target.clone();

    if (stage === "entering") {
      targetPosition = new THREE.Vector3(0, lerp(-7.4, drift.position.y, eased), lerp(6.8, drift.position.z, eased));
      targetLookAt = new THREE.Vector3(0, lerp(-0.9, drift.target.y, eased), lerp(-2.4, drift.target.z, eased));
    } else if (stage === "returning") {
      targetPosition = new THREE.Vector3(0, lerp(drift.position.y, -7.2, eased), lerp(drift.position.z, 6.4, eased));
      targetLookAt = new THREE.Vector3(0, lerp(drift.target.y, -0.85, eased), lerp(drift.target.z, -2.2, eased));
    }

    const hover = Math.sin(state.clock.elapsedTime * (0.5 + pulseStrength)) * (0.028 + chamberDepth * 0.04);
    targetPosition.z += Math.sin(state.clock.elapsedTime * 0.28) * 0.04;
    targetPosition.y += hover;
    targetLookAt.y += hover * 0.22;

    cameraRef.current.position.lerp(targetPosition, 1 - Math.exp(-delta * 3.8));
    cameraRef.current.lookAt(targetLookAt);
  });

  return (
    <PerspectiveCamera
      ref={(camera) => {
        if (camera) {
          cameraRef.current = camera;
          set({ camera });
        }
      }}
      makeDefault
      fov={28}
      position={[0, -5.95, 3.18]}
      near={0.18}
      far={40}
    />
  );
}

function AssetLights({ visualModel }) {
  const theme = visualModel?.theme || {};
  const tonePrimary = theme.tonePrimary || "#7ee8ff";
  const toneSecondary = theme.toneSecondary || "#82ffd4";
  const toneAccent = theme.toneAccent || "#ffd7a5";
  const lockStrength = clamp(Number(visualModel?.governanceLockStrength) || 0, 0, 1);

  return (
    <>
      <ambientLight intensity={0.08 + lockStrength * 0.06} />
      <rectAreaLight
        position={[-5.2, -5.4, 6]}
        rotation={[1.012, 0, -0.593]}
        width={5.6}
        height={5.8}
        intensity={18}
        color={tonePrimary}
      />
      <rectAreaLight
        position={[5.0, -2.4, 4.0]}
        rotation={[1.187, 0, 0.419]}
        width={5.0}
        height={3.4}
        intensity={4.2}
        color={toneSecondary}
      />
      <rectAreaLight
        position={[0.0, 4.6, 4.8]}
        rotation={[-1.117, 0.0, Math.PI]}
        width={4.4}
        height={2.0}
        intensity={7.0}
        color={toneAccent}
      />
      <pointLight
        position={[0, 0, 2.66]}
        intensity={26 + lockStrength * 4}
        distance={10}
        decay={2}
        color={toneAccent}
      />
    </>
  );
}

function FinalAsset({ visualModel }) {
  const groupRef = useRef(null);
  const { scene } = useGLTF(finalAssetUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const phase = String(visualModel?.phase || "constitution_select");
  const mode = String(visualModel?.mode || "ritual");

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const pulseStrength = clamp(Number(visualModel?.pulseStrength) || 0, 0, 1);
    const lockStrength = clamp(Number(visualModel?.governanceLockStrength) || 0, 0, 1);
    const baseScale = mode === "observatory" ? 1.02 : 1;
    const phaseScale = phase === "policy_lock_transition" ? 0.986 : phase === "first_orbit_ready" ? 1.01 : 1;
    const pulse = 1 + Math.sin(t * (0.34 + pulseStrength * 0.72)) * (0.01 + lockStrength * 0.008);

    groupRef.current.rotation.z = Math.sin(t * 0.1) * 0.01;
    groupRef.current.rotation.y = Math.sin(t * 0.16) * 0.025;
    groupRef.current.position.z = Math.sin(t * 0.22) * 0.05;
    groupRef.current.scale.setScalar(baseScale * phaseScale * pulse);
  });

  return (
    <Float speed={0.35} rotationIntensity={0.02} floatIntensity={0.08}>
      <group ref={groupRef}>
        <primitive object={cloned} />
      </group>
    </Float>
  );
}

function AssetScene({ visualModel, screenModel }) {
  const theme = visualModel?.theme || {};
  const fogBase = colorFromHex(theme.tonePrimary, "#05070c");
  const fogColor = useMemo(() => fogBase.clone().lerp(new THREE.Color("#05070c"), 0.82), [fogBase]);
  const stage = String(screenModel?.stage || "active");
  const chamberOpacity = clamp(Number(visualModel?.chamberOpacity) || 1, 0.7, 1);

  return (
    <>
      <color attach="background" args={[stage === "returning" ? "#04060a" : "#05070c"]} />
      <fog attach="fog" args={[fogColor, 14, 28 + (1 - chamberOpacity) * 8]} />

      <AssetCameraRig screenModel={screenModel} visualModel={visualModel} />
      <AssetLights visualModel={visualModel} />

      <Suspense fallback={null}>
        <Environment preset="night" environmentIntensity={0.22} />
        <FinalAsset visualModel={visualModel} />
      </Suspense>

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.32} luminanceThreshold={0.72} luminanceSmoothing={0.18} />
        <Vignette eskil={false} offset={0.15} darkness={0.34} />
      </EffectComposer>
    </>
  );
}

export default function StarCoreInteriorScene3d({ visualModel = null, screenModel = null }) {
  const safeVisualModel = visualModel || {
    theme: { tonePrimary: "#7ee8ff", toneSecondary: "#82ffd4", toneAccent: "#ffd7a5" },
    phase: "constitution_select",
    mode: "ritual",
    pulseStrength: 0.2,
    governanceLockStrength: 0.2,
    chamberOpacity: 1,
    chamberDepth: 0.45,
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
    >
      <AssetScene visualModel={safeVisualModel} screenModel={screenModel || { stage: "active" }} />
    </Canvas>
  );
}

useGLTF.preload(finalAssetUrl);
