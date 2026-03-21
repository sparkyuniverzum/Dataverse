import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Environment, Float, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

function HeroCameraRig() {
  const cameraRef = useRef();
  const target = useMemo(() => new THREE.Vector3(0, -0.1, 1.98), []);
  const { set } = useThree((state) => state);

  useFrame((state, dt) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.lerp(new THREE.Vector3(0, -5.95, 3.18), 1 - Math.exp(-dt * 3.2));
    cameraRef.current.lookAt(target);
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

function HeroLights() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <rectAreaLight position={[-5.2, -5.4, 6]} rotation={[1.012, 0, -0.593]} width={5.6} height={5.8} intensity={18} />
      <rectAreaLight
        position={[5.0, -2.4, 4.0]}
        rotation={[1.187, 0, 0.419]}
        width={5.0}
        height={3.4}
        intensity={4.2}
      />
      <rectAreaLight
        position={[0.0, 4.6, 4.8]}
        rotation={[-1.117, 0.0, Math.PI]}
        width={4.4}
        height={2.0}
        intensity={7.0}
      />
      <pointLight position={[0, 0, 2.66]} intensity={26} distance={10} decay={2} color="#ffd7a5" />
    </>
  );
}

function FinalAsset() {
  const groupRef = useRef();
  const { scene } = useGLTF("/assets/final.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * 0.1) * 0.01;
  });

  return (
    <Float speed={0.35} rotationIntensity={0.02} floatIntensity={0.08}>
      <group ref={groupRef}>
        <primitive object={cloned} />
      </group>
    </Float>
  );
}

export default function HeroScene() {
  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <fog attach="fog" args={["#05070c", 14, 28]} />

      <HeroCameraRig />
      <HeroLights />

      <Suspense fallback={null}>
        <Environment preset="night" environmentIntensity={0.22} />
        <FinalAsset />
      </Suspense>

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.32} luminanceThreshold={0.72} luminanceSmoothing={0.18} />
        <Vignette eskil={false} offset={0.15} darkness={0.34} />
      </EffectComposer>
    </>
  );
}

useGLTF.preload("/assets/final.glb");
