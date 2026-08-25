import { useMemo } from "react";
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
  [-0.12, -0.22, 0.50],
  [0.12, -0.22, 0.50],
  [0.35, -0.18, 0.45],

  [-0.45, -0.52, 0.32],
  [-0.2, -0.62, 0.38],
  [0, -0.66, 0.40],
  [0.2, -0.62, 0.38],
  [0.45, -0.52, 0.32],
];

export default function FaceLandmarks() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(
      LANDMARKS.flat()
    );

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#a8d8ff"
        size={0.045}
        transparent
        opacity={0.95}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}