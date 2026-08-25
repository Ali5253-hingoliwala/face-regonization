import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function AIHead() {
  const { scene } = useGLTF("/models/human_head_base_mesh.glb");

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const mesh = child;

    // Main head mesh
    if (mesh.geometry.attributes.position.count > 1000) {
      mesh.material = new THREE.MeshBasicMaterial({
        color: "#1683ff",
        wireframe: true,
        transparent: true,
        opacity: 0.95,
      });
    } 
    // Hide the eye geometry
    else {
      mesh.visible = false;
    }
  });

  return (
    <primitive
      object={scene}
      scale={0.65}
      position={[0, -0.5, 0]}
    />
  );
}
useGLTF.preload("/models/human_head_base_mesh.glb");

function Scene() {
  return (
    <>
      <ambientLight intensity={1.5} />

      <directionalLight
        position={[5, 5, 10]}
        intensity={2}
      />

      <AIHead />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function Landing3DTest() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="pointer-events-none absolute left-8 top-8 z-10">
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

      {/* 3D Scene */}
      <div className="h-screen w-full">
        <Canvas
          camera={{
            position: [0, 0, 10],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}