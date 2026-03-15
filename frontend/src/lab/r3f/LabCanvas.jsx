import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getLabSceneById } from "./labSceneRegistry";

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

export default function LabCanvas({
  sceneConfig = null,
  sceneId = "star_core_interior_core",
  viewMode = "cinematic",
  onDiagnosticsChange = null,
}) {
  // Dynamické získání komponenty scény z registru
  const sceneEntry = getLabSceneById(sceneId);
  const SceneComponent = sceneEntry?.component;

  return (
    <div className="r3f-lab-canvas-frame">
      <Canvas camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0.4, 5.8] }} dpr={[1, 1.75]} shadows>
        <RendererConfig viewMode={viewMode} />
        <DiagnosticsProbe onDiagnosticsChange={onDiagnosticsChange} />

        {SceneComponent ? (
          <SceneComponent sceneConfig={sceneConfig} viewMode={viewMode} />
        ) : (
          <mesh>
            <boxGeometry />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
        )}
      </Canvas>
    </div>
  );
}
