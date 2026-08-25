import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import BiometricScanner from "../components/3d/BiometricScanner";
import FaceLandmarks from "../components/3d/FaceLandmarks";

gsap.registerPlugin(ScrollTrigger);

const MODEL_PATH = "/models/human_head_base_mesh.glb";

const stages = [
  {
    number: "01",
    eyebrow: "DETECTION",
    title: "SEE.",
    description:
      "VisionAttend detects the presence of a student through intelligent computer vision before the attendance process begins.",
  },
  {
    number: "02",
    eyebrow: "RECOGNITION",
    title: "RECOGNIZE.",
    description:
      "Facial features are analyzed and compared against registered identities in real time.",
  },
  {
    number: "03",
    eyebrow: "LIVENESS",
    title: "VERIFY.",
    description:
      "Liveness verification confirms that the detected face belongs to a real person rather than a presentation or spoof.",
  },
  {
    number: "04",
    eyebrow: "ATTENDANCE",
    title: "ATTEND.",
    description:
      "Once verified, attendance is recorded automatically against the active lecture session.",
  },
];

function AIHead({ progress }: { progress: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", onMove);

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const vertexCount = child.geometry.attributes.position?.count ?? 0;

      if (vertexCount > 1000) {
        child.material = new THREE.MeshBasicMaterial({
          color: "#1683ff",
          wireframe: true,
          transparent: true,
          opacity: 0.9,
        });
      } else {
        child.visible = false;
      }
    });

    return () => window.removeEventListener("mousemove", onMove);
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);

    const smoothing = 1 - Math.pow(0.001, delta);
    current.current.x = THREE.MathUtils.lerp(current.current.x, mouse.current.x, smoothing);
    current.current.y = THREE.MathUtils.lerp(current.current.y, mouse.current.y, smoothing);

    const mx = current.current.x;
    const my = current.current.y;

    const rotationY = THREE.MathUtils.lerp(-0.08, 2.25, p) + mx * 0.22;
    const rotationX = my * -0.12 + Math.sin(time * 0.7) * 0.018;
    const rotationZ = mx * 0.025 + Math.sin(time * 0.5) * 0.008;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotationX, 0.075);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotationY, 0.075);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotationZ, 0.075);

    const scale = THREE.MathUtils.lerp(0.62, 0.9, p);
    const floatY = Math.sin(time * 0.8) * 0.045;
    const targetX = THREE.MathUtils.lerp(1.1, 0.15, p) + mx * 0.08;
    const targetY = floatY - my * 0.05;
    const targetZ = THREE.MathUtils.lerp(0, 0.8, p);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.055);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.055);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.055);

    const currentScale = THREE.MathUtils.lerp(groupRef.current.scale.x, scale, 0.055);
    groupRef.current.scale.setScalar(currentScale);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={0.65} />
      <BiometricScanner />
      <FaceLandmarks />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);

function Scene({ progress }: { progress: React.MutableRefObject<number> }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 10]} intensity={1.4} />
      <AIHead progress={progress} />
    </>
  );
}

export default function Landing3DExperience() {
  const progress = useRef(0);
  const [activeStage, setActiveStage] = useState(0);
  const [pageProgress, setPageProgress] = useState(0);

  useEffect(() => {
    const cinematic = document.getElementById("cinematic-experience");
    if (!cinematic) return;

    let raf = 0;
    let latest = 0;

    const update = () => {
      const rect = cinematic.getBoundingClientRect();
      const total = Math.max(1, cinematic.offsetHeight - window.innerHeight);
      const value = THREE.MathUtils.clamp(-rect.top / total, 0, 1);
      latest = value;
      progress.current = value;
      setPageProgress(value);
      setActiveStage(Math.min(3, Math.floor(value * 4)));
      raf = 0;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const trigger = ScrollTrigger.create({
      trigger: cinematic,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        latest = self.progress;
        progress.current = self.progress;
      },
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      trigger.kill();
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#03060b] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[48%] top-[42%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.07] blur-[160px]" />
        <div className="absolute right-[-180px] top-[20%] h-[500px] w-[500px] rounded-full bg-cyan-400/[0.035] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-[80] border-b border-white/[0.06] bg-[#03060b]/65 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">
          <div>
            <div className="font-mono text-xs font-semibold tracking-[0.35em]">
              VISION<span className="text-blue-400">ATTEND</span>
            </div>
            <div className="mt-1 font-mono text-[8px] tracking-[0.3em] text-slate-500">
              ARTIFICIAL INTELLIGENCE
            </div>
          </div>
          <nav className="hidden gap-8 md:flex">
            <span className="text-xs text-slate-400">AI RECOGNITION</span>
            <span className="text-xs text-slate-400">LIVENESS</span>
            <span className="text-xs text-slate-400">ANALYTICS</span>
          </nav>
          <div className="rounded-full border border-blue-400/30 px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-blue-300">
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      <section className="relative flex min-h-screen items-center overflow-hidden pt-20">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-6 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-14">
          <div className="relative z-20 max-w-3xl py-20 lg:py-0">
            <p className="mb-5 font-mono text-xs tracking-[0.35em] text-blue-400">AI ATTENDANCE SYSTEM</p>
            <h1 className="font-display text-6xl font-semibold leading-[0.86] tracking-[-0.055em] sm:text-7xl lg:text-[7.4rem]">
              Attendance
              <br />
              <span className="text-slate-500">Reimagined.</span>
            </h1>
            <p className="mt-8 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Facial recognition, liveness verification and intelligent attendance — unified into one intelligent system.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button className="rounded-full bg-blue-500 px-6 py-3 text-xs font-semibold tracking-wide transition hover:bg-blue-400">
                ENTER SYSTEM
              </button>
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">SCROLL TO EXPLORE ↓</span>
            </div>
          </div>

          <div className="relative h-[520px] lg:h-[680px]">
            <div className="absolute inset-0 rounded-full bg-blue-500/[0.055] blur-[120px]" />
            <Canvas camera={{ position: [0, 0, 10], fov: 45, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
              <Scene progress={progress} />
            </Canvas>
            <div className="pointer-events-none absolute bottom-10 right-0 hidden w-52 border border-blue-400/20 bg-[#07111e]/70 p-4 backdrop-blur-xl lg:block">
              <div className="flex justify-between font-mono text-[9px] tracking-[0.25em] text-slate-500">
                <span>BIOMETRIC CORE</span><span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />
              </div>
              <div className="mt-5 space-y-3 font-mono text-[10px]">
                <div className="flex justify-between"><span className="text-slate-500">FACE DETECTED</span><span className="text-blue-300">YES</span></div>
                <div className="flex justify-between"><span className="text-slate-500">LIVENESS</span><span className="text-blue-300">ACTIVE</span></div>
                <div className="flex justify-between"><span className="text-slate-500">MATCH</span><span>98.7%</span></div>
              </div>
              <div className="mt-5 h-1 bg-white/[0.06]"><div className="h-full w-[98.7%] bg-blue-400 shadow-[0_0_12px_#1683ff]" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="cinematic-experience" className="relative h-[420vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(22,131,255,0.11),transparent_34%)]" />
          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:80px_80px]" />

          <div className="absolute inset-0 z-10">
            <div className="absolute left-0 top-0 h-full w-full lg:w-[58%] bg-gradient-to-r from-[#03060b]/95 via-[#03060b]/70 to-transparent" />
          </div>

          <div className="absolute inset-0 z-20">
            <Canvas camera={{ position: [0, 0, 10], fov: 45, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
              <Scene progress={progress} />
            </Canvas>
          </div>

          <div className="relative z-30 mx-auto h-full max-w-7xl px-6 sm:px-10 lg:px-14">
            {stages.map((stage, index) => {
              const distance = Math.abs(pageProgress * 3 - index);
              const opacity = Math.max(0, 1 - distance * 3.2);
              const y = (index - pageProgress * 3) * 70;

              return (
                <div
                  key={stage.number}
                  className="absolute left-6 top-1/2 max-w-xl -translate-y-1/2 transition-none sm:left-10 lg:left-14"
                  style={{ opacity, transform: `translateY(calc(-50% + ${y}px))` }}
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span className="font-mono text-xs tracking-[0.3em] text-blue-400">{stage.number}</span>
                    <span className="h-px w-12 bg-blue-500/50" />
                    <span className="font-mono text-xs tracking-[0.25em] text-blue-300/70">{stage.eyebrow}</span>
                  </div>
                  <h2 className="font-display text-6xl font-semibold leading-[0.86] tracking-[-0.05em] sm:text-7xl lg:text-[7rem]">{stage.title}</h2>
                  <p className="mt-7 max-w-md text-sm leading-7 text-slate-400 sm:text-base">{stage.description}</p>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute bottom-8 left-6 z-40 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-10 lg:left-14">
            VISIONATTEND / CINEMATIC CORE
          </div>

          <div className="pointer-events-none absolute right-8 top-1/2 z-40 hidden -translate-y-1/2 md:block">
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-[8px] tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl]">SCROLL</span>
              <div className="relative h-36 w-px overflow-hidden bg-white/10">
                <div className="absolute left-0 top-0 h-full w-full origin-top bg-blue-400 shadow-[0_0_14px_#1683ff]" style={{ transform: `scaleY(${pageProgress})` }} />
              </div>
              <span className="font-mono text-[8px] tracking-widest text-blue-400">0{activeStage + 1}</span>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-8 right-8 z-40 hidden w-56 border border-blue-400/15 bg-[#07111e]/65 p-4 backdrop-blur-xl lg:block">
            <div className="font-mono text-[9px] tracking-[0.25em] text-slate-500">LIVE PIPELINE</div>
            <div className="mt-4 space-y-2 font-mono text-[9px]">
              {stages.map((stage, index) => (
                <div key={stage.number} className={`flex items-center justify-between ${index <= activeStage ? "text-blue-300" : "text-slate-600"}`}>
                  <span>{stage.number} / {stage.eyebrow}</span>
                  <span>{index < activeStage ? "DONE" : index === activeStage ? "ACTIVE" : "WAIT"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden border-t border-white/[0.06]">
        <div className="absolute h-[550px] w-[550px] rounded-full bg-blue-500/[0.07] blur-[140px]" />
        <div className="relative z-10 px-6 text-center">
          <p className="font-mono text-xs tracking-[0.4em] text-blue-400">VISIONATTEND AI</p>
          <h2 className="mt-6 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-8xl">
            Smarter.
            <br />
            <span className="text-slate-500">Simpler.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-md text-sm leading-7 text-slate-400">
            Intelligent attendance built around recognition, verification and real-time data.
          </p>
          <button className="mt-9 rounded-full bg-blue-500 px-8 py-4 text-xs font-semibold tracking-wide transition hover:bg-blue-400">GET STARTED</button>
        </div>
      </section>
    </main>
  );
}
