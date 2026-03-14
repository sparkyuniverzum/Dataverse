import { Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const VIEW_MODE_BACKGROUND = {
  debug: "#08131b",
  cinematic: "#030814",
  performance_safe: "#071017",
};

function RendererConfig({ viewMode = "cinematic" }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = viewMode === "cinematic" ? 1.08 : viewMode === "debug" ? 0.95 : 0.9;
    gl.setClearColor(VIEW_MODE_BACKGROUND[viewMode] || VIEW_MODE_BACKGROUND.cinematic);
    scene.background = new THREE.Color(VIEW_MODE_BACKGROUND[viewMode] || VIEW_MODE_BACKGROUND.cinematic);
  }, [gl, scene, viewMode]);

  return null;
}

function DiagnosticsProbe({ onDiagnosticsChange = null }) {
  const { gl } = useThree();
  const sampleRef = useRef(0);

  useFrame((_, delta) => {
    sampleRef.current += 1;
    if (!onDiagnosticsChange || sampleRef.current % 12 !== 0) return;
    const programs = Array.isArray(gl.info.programs) ? gl.info.programs.length : 0;
    onDiagnosticsChange({
      frameMs: delta * 1000,
      memory: {
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      },
      programs,
      render: {
        calls: gl.info.render.calls,
      },
    });
  });

  return null;
}

function PlaceholderScene({ sceneConfig = null, sceneId = "star_core_interior_core", viewMode = "cinematic" }) {
  const groupRef = useRef(null);
  const accent = sceneId === "star_core_exterior" ? "#f4d591" : "#76d5ff";
  const atmosphere = sceneId === "star_core_exterior" ? "#ff9b42" : "#2f7cff";
  const phaseOffset = useMemo(() => {
    if (sceneConfig?.phase === "policy_lock_transition") return 1.2;
    if (sceneConfig?.phase === "first_orbit_ready") return 0.8;
    if (sceneConfig?.phase === "star_core_interior_entry") return 0.35;
    return 0.5;
  }, [sceneConfig?.phase]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.rotation.y += delta * (viewMode === "performance_safe" ? 0.08 : 0.14);
    groupRef.current.position.y = Math.sin(time * 0.55 + phaseOffset) * 0.08;
  });

  return (
    <>
      <fog attach="fog" args={[VIEW_MODE_BACKGROUND[viewMode] || VIEW_MODE_BACKGROUND.cinematic, 5, 18]} />
      <ambientLight intensity={viewMode === "debug" ? 0.8 : 0.56} />
      <directionalLight
        castShadow
        position={[3.5, 4.2, 2.4]}
        intensity={viewMode === "performance_safe" ? 1.2 : 1.55}
        color={accent}
      />
      <pointLight position={[-3, -1, -2]} intensity={0.5} color="#89baff" />
      <Stars
        radius={32}
        depth={14}
        count={viewMode === "performance_safe" ? 500 : 900}
        factor={3.2}
        saturation={0}
        fade
        speed={0.25}
      />

      <group ref={groupRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.08, 48, 48]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.9}
            roughness={0.22}
            metalness={0.08}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2.2, 0, 0]} scale={sceneId === "star_core_exterior" ? 1.2 : 1}>
          <torusGeometry args={[1.72, 0.1, 20, 128]} />
          <meshBasicMaterial color={atmosphere} transparent opacity={viewMode === "debug" ? 0.38 : 0.24} />
        </mesh>

        <mesh scale={[1.52, 1.52, 1.52]}>
          <sphereGeometry args={[1.0, 32, 32]} />
          <meshBasicMaterial
            color={atmosphere}
            transparent
            opacity={viewMode === "cinematic" ? 0.12 : 0.08}
            depthWrite={false}
          />
        </mesh>
      </group>

      {sceneConfig?.debugProfile?.grid || viewMode === "debug" ? (
        <gridHelper args={[14, 14, "#4ecfff", "#163646"]} position={[0, -2.15, 0]} />
      ) : null}
      {sceneConfig?.debugProfile?.axes || viewMode === "debug" ? <axesHelper args={[3.6]} /> : null}
    </>
  );
}

export default function LabCanvas({
  sceneConfig = null,
  sceneId = "star_core_interior_core",
  viewMode = "cinematic",
  onDiagnosticsChange = null,
}) {
  return (
    <div className="r3f-lab-canvas-frame">
      <Canvas camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0.4, 5.8] }} dpr={[1, 1.75]} shadows>
        <RendererConfig viewMode={viewMode} />
        <DiagnosticsProbe onDiagnosticsChange={onDiagnosticsChange} />
        <PlaceholderScene sceneConfig={sceneConfig} sceneId={sceneId} viewMode={viewMode} />
      </Canvas>
    </div>
  );
}
