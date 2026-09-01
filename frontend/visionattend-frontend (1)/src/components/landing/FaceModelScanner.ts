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
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.8);

  const root = new THREE.Group();
  root.position.set(0, -0.02, 0);
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambient);

  const loader = new GLTFLoader();
  let disposed = false;
  let animationFrame = 0;
  let model: THREE.Object3D | null = null;
  const pointMaterials: THREE.PointsMaterial[] = [];

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const createPointCloud = (source: THREE.BufferGeometry) => {
    const position = source.getAttribute("position");
    if (!position) return;

    const count = position.count;
    const target = Math.min(1450, count);
    const stride = Math.max(1, Math.floor(count / target));
    const values: number[] = [];

    for (let i = 0; i < count; i += stride) {
      values.push(position.getX(i), position.getY(i), position.getZ(i));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(values, 3),
    );

    const material = new THREE.PointsMaterial({
      color: 0xf4fffb,
      size: 0.018,
      transparent: true,
      opacity: 0.92,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    pointMaterials.push(material);

    return new THREE.Points(geometry, material);
  };

  loader.load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;

      model = gltf.scene;
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const mesh = child;
        const geometry = mesh.geometry;
        const points = createPointCloud(geometry);

        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x65c9c1,
          wireframe: true,
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
        });

        mesh.material = wireMaterial;
        mesh.renderOrder = 1;

        if (points) {
          points.renderOrder = 3;
          mesh.add(points);
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.45 / maxSize;

      model.position.sub(center);
      model.scale.setScalar(scale);
      model.position.y -= 0.03;
      root.add(model);
    },
    undefined,
    () => {
      // Keep the scanner frame usable if the remote model is unavailable.
    },
  );

  const animate = (time: number) => {
    if (disposed) return;
    const elapsed = time / 1000;

    // No mouse tilt and no aggressive 360° movement — only a restrained biometric drift.
    root.rotation.y = Math.sin(elapsed * 0.45) * 0.025;
    root.rotation.x = Math.sin(elapsed * 0.35) * 0.008;

    const pulse = 0.86 + Math.sin(elapsed * 2.1) * 0.12;
    pointMaterials.forEach((material) => {
      material.opacity = pulse;
      material.size = 0.017 + pulse * 0.002;
    });

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
    model = null;
  };
}
