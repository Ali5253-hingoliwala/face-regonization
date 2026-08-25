import { useEffect, useRef } from "react";
import * as THREE from "three";

interface BiometricScannerProps {
  active?: boolean;
}

export default function BiometricScanner({
  active = true,
}: BiometricScannerProps) {
  const lineRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!lineRef.current) return;

    const material = lineRef.current
      .material as THREE.MeshBasicMaterial;

    let animationFrame: number;
    let start = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - start) / 1000;

      /*
        Smooth scan movement from
        top → bottom → repeat
      */
      const progress = (Math.sin(elapsed * 1.5) + 1) / 2;

      lineRef.current!.position.y =
        THREE.MathUtils.lerp(
          1.15,
          -1.15,
          progress
        );

      /*
        Subtle intensity pulse
      */
      material.opacity =
        0.45 +
        Math.sin(elapsed * 4) * 0.12;

      animationFrame =
        requestAnimationFrame(animate);
    };

    if (active) {
      animationFrame =
        requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [active]);

  return (
    <group position={[0, -0.25, 0.15]}>

      {/* Main scanning beam */}

      <mesh ref={lineRef}>
        <planeGeometry args={[3.8, 0.012]} />

        <meshBasicMaterial
          color="#1683ff"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Glow around the scan */}

      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[3.8, 0.16]} />

        <meshBasicMaterial
          color="#1683ff"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

    </group>
  );
}