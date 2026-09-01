import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL =
  "https://raw.githubusercontent.com/Ali5253-hingoliwala/face-regonization/3d-landing-experiment/frontend/visionattend-frontend%20(1)/public/models/human_head_base_mesh.glb";

export function mountFaceModelScanner(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.8);

  const root = new THREE.Group();
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

  loader.load(MODEL_URL, (gltf) => {
    if (disposed) return;

    const source = gltf.scene;
    source.updateMatrixWorld(true);
    const vertices: THREE.Vector3[] = [];

    source.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const position = child.geometry.getAttribute("position");
      if (!position) return;

      const vertex = new THREE.Vector3();
      // Enough points for facial detail without turning the face into noise.
      const stride = Math.max(1, Math.floor(position.count / 4200));
      for (let i = 0; i < position.count; i += stride) {
        vertex.set(position.getX(i), position.getY(i), position.getZ(i));
        vertex.applyMatrix4(child.matrixWorld);
        vertices.push(vertex.clone());
      }
    });

    if (!vertices.length) return;

    const sourceBox = new THREE.Box3().setFromPoints(vertices);
    const sourceHeight = sourceBox.max.y - sourceBox.min.y;

    // Remove the lower neck/shoulder area.
    const headMinY = sourceBox.min.y + sourceHeight * 0.18;
    const faceVertices = vertices.filter((v) => v.y >= headMinY);
    if (!faceVertices.length) return;

    const faceBox = new THREE.Box3().setFromPoints(faceVertices);
    const center = faceBox.getCenter(new THREE.Vector3());
    const size = faceBox.getSize(new THREE.Vector3());

    // IMPORTANT: preserve natural head proportions.
    // The previous maxSize normalization made the face look too wide/thick.
    // Normalize X and Y from the same vertical reference, then compress Z.
    const heightScale = 2.25 / Math.max(size.y, 0.001);
    const widthScale = heightScale;
    const depthScale = heightScale * 0.58;

    const positions = new Float32Array(faceVertices.length * 3);
    faceVertices.forEach((vertex, index) => {
      positions[index * 3] = (vertex.x - center.x) * widthScale;
      positions[index * 3 + 1] = (vertex.y - center.y) * heightScale;
      positions[index * 3 + 2] = (vertex.z - center.z) * depthScale;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.013,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    pointMaterials.push(material);

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 5;
    root.add(points);
  });

  const animate = (time: number) => {
    if (disposed) return;
    const elapsed = time / 1000;
    const pulse = 0.80 + (Math.sin(elapsed * 2.3) + 1) * 0.09;

    pointMaterials.forEach((material) => {
      material.opacity = pulse;
      material.size = 0.0115 + pulse * 0.0018;
    });

    root.rotation.y = Math.PI + Math.sin(elapsed * 0.45) * 0.012;
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
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    });
    renderer.dispose();
  };
}
