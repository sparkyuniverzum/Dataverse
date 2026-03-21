import { Canvas } from "@react-three/fiber";
import { Loader } from "@react-three/drei";
import HeroScene from "./scene/HeroScene";

export default function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 28, position: [0, -5.95, 3.18], near: 0.18, far: 40 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <HeroScene />
      </Canvas>
      <Loader />
    </>
  );
}
