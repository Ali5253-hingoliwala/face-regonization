import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL =
  "https://raw.githubusercontent.com/Ali5253-hingoliwala/face-regonization/3d-landing-experiment/frontend/visionattend-frontend%20(1)/public/models/human_head_base_mesh.glb";

export function mountFaceModelScanner(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4.6);

  const root = new THREE.Group();
  // The source GLB faces away from the landing-page camera.
  root.rotation.y = Math.PI;
  scene.add(root);

  const loader = new GLTFLoader();
  let disposed = false;
  let animationFrame = 0;
  const pointMaterials: THREE.PointsMaterial[] = [];

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  loader.load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;

      const source = gltf.scene;
      source.updateMatrixWorld(true);

      const vertices: THREE.Vector3[] = [];

      source.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const position = child.geometry.getAttribute("position");
        if (!position) return;

        const vertex = new THREE.Vector3();
        const stride = Math.max(1, Math.floor(position.count / 2600));

        for (let i = 0; i < position.count; i += stride) {
          vertex.set(
            position.getX(i),
            position.getY(i),
            position.getZ(i),
          );
          vertex.applyMatrix4(child.matrixWorld);
          vertices.push(vertex.clone());
        }
      });

      if (!vertices.length) return;

      // The source is a head/bust mesh. Drop the lowest part of the neck
      // so the scanner is framed around the actual face/head.
      const sourceBox = new THREE.Box3().setFromPoints(vertices);
      const sourceHeight = sourceBox.max.y - sourceBox.min.y;
      const headMinY = sourceBox.min.y + sourceHeight * 0.16;
      const faceVertices = vertices.filter((vertex) => vertex.y >= headMinY);

      if (!faceVertices.length) return;

      const faceBox = new THREE.Box3().setFromPoints(faceVertices);
      const center = faceBox.getCenter(new THREE.Vector3());
      const size = faceBox.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.25 / maxSize;

      const positions = new Float32Array(faceVertices.length * 3);
      faceVertices.forEach((vertex, index) => {
        positions[index * 3] = (vertex.x - center.x) * scale;
        positions[index * 3 + 1] = (vertex.y - center.y) * scale;
        positions[index * 3 + 2] = (vertex.z - center.z) * scale;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.computeBoundingSphere();

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.016,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });

      pointMaterials.push(material);

      const points = new THREE.Points(geometry, material);
      points.renderOrder = 5;
      points.position.y = -0.01;
      root.add(points);
    },
    undefined,
    () => {
      // Keep the scanner frame usable if the model cannot be loaded.
    },
  );

  const animate = (time: number) => {
    if (disposed) return;

    const elapsed = time / 1000;
    const pulse = 0.82 + (Math.sin(elapsed * 2.3) + 1) * 0.09;

    pointMaterials.forEach((material) => {
      material.opacity = pulse;
      material.size = 0.014 + pulse * 0.002;
    });

    // Very subtle movement; no mouse tilt and no spinning.
    root.rotation.y = Math.PI + Math.sin(elapsed * 0.45) * 0.018;

    resize();
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  animationFrame = window.requestAnimationFrame(animate);

  return () => {
    disposed = true;
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) return;

      object.geometry.dispose();
      const material = object.material;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    });

    renderer.dispose();
  };
}
