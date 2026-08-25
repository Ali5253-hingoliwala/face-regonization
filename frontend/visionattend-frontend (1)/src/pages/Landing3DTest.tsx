import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function TestScene() {
  return (
    <>
      <ambientLight intensity={1} />

      <mesh>
        <icosahedronGeometry args={[1.5, 2]} />
        <meshStandardMaterial
          color="#1683ff"
          wireframe
        />
      </mesh>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
      />
    </>
  );
}

export default function Landing3DTest() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute left-8 top-8 z-10">
        <p className="font-mono text-xs tracking-[0.3em] text-blue-400">
          VISIONATTEND AI
        </p>

        <h1 className="mt-3 text-4xl font-semibold">
          3D Experiment
        </h1>

        <p className="mt-2 text-sm text-white/50">
          Interactive biometric interface
        </p>
      </div>

      <div className="h-screen w-full">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <TestScene />
        </Canvas>
      </div>
    </div>
  );
}