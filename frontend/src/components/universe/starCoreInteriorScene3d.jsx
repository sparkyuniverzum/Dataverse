import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

export default function StarCoreInteriorScene3d() {
  return (
    <Canvas
      camera={{ position: [2, 1, 8], fov: 50 }}
      gl={{
        antialias: true,
        toneMapping: THREE.NoToneMapping,
      }}
    >
      {/* černé pozadí */}
      <color attach="background" args={["#000000"]} />

      {/* světla */}
      <ambientLight intensity={0.03} />

      <directionalLight position={[8, 2, 2]} intensity={1.0} />

      <directionalLight position={[-6, -3, -4]} intensity={0.2} />

      {/* TEST BOX – otočený */}
      <mesh position={[0, 0, -6]} rotation={[0.3, 0.5, 0]}>
        <boxGeometry args={[2, 4, 2]} />
        <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.1} />
      </mesh>
    </Canvas>
  );
}
