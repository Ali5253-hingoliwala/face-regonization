import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const LANDMARKS: [number, number, number][] = [
  [-0.55, 0.55, 0.28],
  [-0.28, 0.68, 0.38],
  [0.0, 0.72, 0.42],
  [0.28, 0.68, 0.38],
  [0.55, 0.55, 0.28],

  [-0.38, 0.32, 0.45],
  [-0.15, 0.35, 0.48],
  [0.15, 0.35, 0.48],
  [0.38, 0.32, 0.45],

  [0, 0.05, 0.52],

  [-0.35, -0.18, 0.45],
  [-0.12, -0.22, 0.5],
  [0.12, -0.22, 0.5],
  [0.35, -0.18, 0.45],

  [-0.45, -0.52, 0.32],
  [-0.2, -0.62, 0.38],
  [0, -0.66, 0.4],
  [0.2, -0.62, 0.38],
  [0.45, -0.52, 0.32],
];

const CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],

  [0, 5],
  [1, 5],
  [1, 6],
  [2, 6],
  [2, 7],
  [3, 7],
  [3, 8],
  [4, 8],

  [5, 6],
  [6, 7],
  [7, 8],

  [6, 9],
  [7, 9],

  [5, 10],
  [6, 10],
  [6, 11],
  [7, 11],
  [7, 12],
  [8, 12],
  [8, 13],

  [10, 11],
  [11, 12],
  [12, 13],

  [10, 14],
  [10, 15],
  [11, 15],
  [11, 16],
  [12, 16],
  [12, 17],
  [13, 17],
  [13, 18],

  [14, 15],
  [15, 16],
  [16, 17],
  [17, 18],
];

function buildLineGeometry() {
  const positions: number[] = [];

  for (const [from, to] of CONNECTIONS) {
    positions.push(...LANDMARKS[from]);
    positions.push(...LANDMARKS[to]);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  return geometry;
}

export default function FaceLandmarks() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const pointMaterialRef = useRef<THREE.PointsMaterial>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  const pointGeometry = useMemo(() => {
    const positions = new Float32Array(
      LANDMARKS.flat()
    );

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    return geometry;
  }, []);

  const lineGeometry = useMemo(() => {
    return buildLineGeometry();
  }, []);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - start) / 1000;

      const pulse =
        0.5 +
        Math.sin(elapsed * 2.4) * 0.5;

      const secondaryPulse =
        0.5 +
        Math.sin(elapsed * 1.7 + 1.2) * 0.5;

      if (pointMaterialRef.current) {
        pointMaterialRef.current.opacity =
          0.65 + pulse * 0.3;

        pointMaterialRef.current.size =
          0.038 + pulse * 0.018;
      }

      if (lineMaterialRef.current) {
        lineMaterialRef.current.opacity =
          0.16 + secondaryPulse * 0.12;
      }

      if (pointsRef.current) {
        pointsRef.current.rotation.z =
          Math.sin(elapsed * 0.35) * 0.008;
      }

      if (linesRef.current) {
        linesRef.current.rotation.z =
          Math.sin(elapsed * 0.35) * 0.008;
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <group>
      {/* Facial tracking points */}
      <points
        ref={pointsRef}
        geometry={pointGeometry}
      >
        <pointsMaterial
          ref={pointMaterialRef}
          color="#a8d8ff"
          size={0.045}
          transparent
          opacity={0.95}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Subtle biometric connection network */}
      <lineSegments
        ref={linesRef}
        geometry={lineGeometry}
      >
        <lineBasicMaterial
          ref={lineMaterialRef}
          color="#1683ff"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
