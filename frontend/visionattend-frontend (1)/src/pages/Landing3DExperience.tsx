import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import BiometricScanner from "../components/3d/BiometricScanner";
import FaceLandmarks from "../components/3d/FaceLandmarks";

const MODEL_PATH = "/models/human_head_base_mesh.glb";

const stages = [
  { number: "01", eyebrow: "DETECTION", title: "SEE.", description: "VisionAttend detects the presence of a student through intelligent computer vision before attendance begins." },
  { number: "02", eyebrow: "RECOGNITION", title: "RECOGNIZE.", description: "Facial features are analyzed against registered identities in real time, creating a fast biometric match." },
  { number: "03", eyebrow: "LIVENESS", title: "VERIFY.", description: "Liveness verification confirms that the detected face belongs to a real person rather than a presentation or spoof." },
  { number: "04", eyebrow: "ATTENDANCE", title: "ATTEND.", description: "Once verified, attendance is recorded automatically against the active lecture session." },
];

function AIHead({ progress }: { progress: MutableRefObject<number> }) {
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
        child.material = new THREE.MeshBasicMaterial({ color: "#1683ff", wireframe: true, transparent: true, opacity: 0.94 });
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
    const arc = Math.sin(p * Math.PI);

    // Mouse controls the head continuously; scroll adds a deliberate cinematic arc.
    const rotationY = THREE.MathUtils.lerp(0.04, 2.05, p) + mx * 0.24 + arc * 0.18;
    const rotationX = my * -0.14 + Math.sin(time * 0.75) * 0.018;
    const rotationZ = mx * 0.035 + Math.sin(time * 0.5) * 0.01;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotationX, 0.075);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotationY, 0.075);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotationZ, 0.075);

    const targetScale = THREE.MathUtils.lerp(1.02, 1.18, p);
    const floatY = Math.sin(time * 0.9) * 0.055;
    const targetX = THREE.MathUtils.lerp(0.95, 0.25, p) + mx * 0.12;
    const targetY = THREE.MathUtils.lerp(-0.15, -0.02, p) + floatY - my * 0.06;
    const targetZ = THREE.MathUtils.lerp(0, 0.7, p);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.06);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.06);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.05);

    const smoothScale = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.055);
    groupRef.current.scale.setScalar(smoothScale);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={0.68} />
      <BiometricScanner />
      <FaceLandmarks />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);

function Scene({ progress }: { progress: MutableRefObject<number> }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 10]} intensity={1.5} />
      <AIHead progress={progress} />
    </>
  );
}

function StagePanel({ stage, active }: { stage: (typeof stages)[number]; active: boolean }) {
  return (
    <div className={`absolute left-0 top-1/2 w-full max-w-2xl -translate-y-1/2 transition-all duration-700 ease-out ${active ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"}`}>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs tracking-[0.35em] text-blue-400">{stage.number}</span>
        <span className="h-px w-14 bg-blue-400/60" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-blue-300/70">{stage.eyebrow}</span>
      </div>
      <h2 className="mt-5 font-display text-6xl font-semibold leading-[0.84] tracking-[-0.055em] text-white sm:text-7xl lg:text-[7.5rem]">{stage.title}</h2>
      <p className="mt-7 max-w-md text-sm leading-7 text-slate-400 sm:text-base">{stage.description}</p>
    </div>
  );
}

export default function Landing3DExperience() {
  const cinematicRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [activeStage, setActiveStage] = useState(0);
  const [pageProgress, setPageProgress] = useState(0);

  useEffect(() => {
    const section = cinematicRef.current;
    if (!section) return;
    let frame = 0;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const total = Math.max(1, section.offsetHeight - window.innerHeight);
      const value = THREE.MathUtils.clamp(-rect.top / total, 0, 1);
      progress.current = value;
      setPageProgress(value);
      setActiveStage(Math.min(stages.length - 1, Math.floor(value * stages.length)));
      frame = 0;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const current = stages[activeStage];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#03060b] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[55%] top-[42%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.075] blur-[170px]" />
        <div className="absolute right-[-180px] top-[18%] h-[520px] w-[520px] rounded-full bg-cyan-400/[0.035] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 10], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
          <Scene progress={progress} />
        </Canvas>
      </div>

      <header className="fixed left-0 right-0 top-0 z-[80] border-b border-white/[0.06] bg-[#03060b]/65 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">
          <div>
            <div className="font-mono text-xs font-semibold tracking-[0.35em]">VISION<span className="text-blue-400">ATTEND</span></div>
            <div className="mt-1 font-mono text-[8px] tracking-[0.3em] text-slate-500">ARTIFICIAL INTELLIGENCE</div>
          </div>
          <nav className="hidden gap-8 md:flex">
            <span className="text-xs text-slate-400">AI RECOGNITION</span>
            <span className="text-xs text-slate-400">LIVENESS</span>
            <span className="text-xs text-slate-400">ANALYTICS</span>
          </nav>
          <div className="rounded-full border border-blue-400/30 px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-blue-300">SYSTEM ONLINE</div>
        </div>
      </header>

      <section className="relative z-20 flex min-h-screen items-center overflow-hidden px-6 pt-20 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <p className="mb-5 font-mono text-xs tracking-[0.35em] text-blue-400">AI ATTENDANCE SYSTEM</p>
            <h1 className="font-display text-6xl font-semibold leading-[0.86] tracking-[-0.055em] sm:text-7xl lg:text-[7.4rem]">Attendance<br /><span className="text-slate-500">Reimagined.</span></h1>
            <p className="mt-8 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">Facial recognition, liveness verification and intelligent attendance — unified into one intelligent system.</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button className="rounded-full bg-blue-500 px-6 py-3 text-xs font-semibold tracking-wide text-white shadow-[0_0_30px_rgba(22,131,255,0.22)] transition hover:bg-blue-400">ENTER SYSTEM</button>
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">SCROLL TO EXPLORE ↓</span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-8 left-6 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-10 lg:left-14">VISIONATTEND / 001</div>
        <div className="pointer-events-none absolute bottom-8 right-8 flex items-center gap-3 font-mono text-[9px] tracking-[0.2em] text-slate-500 sm:right-14"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />AI CORE ACTIVE</div>
      </section>

      <section ref={cinematicRef} id="cinematic-experience" className="relative z-20 h-[420vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_45%,rgba(22,131,255,0.11),transparent_34%)]" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[#03060b]/95 via-[#03060b]/72 to-transparent" />

          <div className="relative mx-auto h-full max-w-7xl px-6 sm:px-10 lg:px-14">
            <div className="absolute left-0 top-0 h-full w-full max-w-2xl">
              {stages.map((stage, index) => <StagePanel key={stage.number} stage={stage} active={index === activeStage} />)}
            </div>

            <div className="absolute bottom-12 right-6 hidden w-60 border border-blue-400/20 bg-[#07111e]/70 p-5 backdrop-blur-xl sm:right-10 lg:right-14 md:block">
              <div className="flex items-center justify-between"><span className="font-mono text-[9px] tracking-[0.25em] text-slate-500">BIOMETRIC CORE</span><span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" /></div>
              <div className="mt-5 space-y-3 font-mono text-[9px]">
                <div className="flex justify-between"><span className="text-slate-500">PIPELINE</span><span className="text-blue-300">{current.eyebrow}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">FACE</span><span className="text-blue-300">DETECTED</span></div>
                <div className="flex justify-between"><span className="text-slate-500">MATCH</span><span>98.7%</span></div>
              </div>
              <div className="mt-5 h-px bg-white/10"><div className="h-full bg-blue-400 shadow-[0_0_12px_#1683ff]" style={{ width: `${Math.max(12, pageProgress * 100)}%` }} /></div>
              <div className="mt-4 flex justify-between font-mono text-[8px] text-slate-600"><span>{current.number} / 04</span><span>{Math.round(pageProgress * 100)}%</span></div>
            </div>

            <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 md:block lg:right-0">
              <div className="flex flex-col items-center gap-3"><span className="font-mono text-[8px] tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl]">SCROLL</span><div className="relative h-36 w-px bg-white/10"><div className="absolute left-0 top-0 w-full origin-top bg-blue-400 shadow-[0_0_14px_#1683ff]" style={{ height: "100%", transform: `scaleY(${pageProgress})` }} /></div><span className="font-mono text-[8px] tracking-widest text-blue-400">{current.number}</span></div>
            </div>

            <div className="absolute bottom-8 left-0 font-mono text-[9px] tracking-[0.25em] text-slate-600">VISIONATTEND / CINEMATIC CORE</div>
          </div>
        </div>
      </section>

      <section className="relative z-20 flex min-h-screen items-center justify-center overflow-hidden border-t border-white/[0.06] px-6">
        <div className="absolute h-[520px] w-[520px] rounded-full bg-blue-500/[0.07] blur-[140px]" />
        <div className="relative z-10 max-w-3xl text-center">
          <p className="font-mono text-xs tracking-[0.4em] text-blue-400">VISIONATTEND AI</p>
          <h2 className="mt-6 font-display text-6xl font-semibold leading-[0.86] tracking-[-0.055em] sm:text-8xl">Smarter.<br /><span className="text-slate-500">Simpler.</span></h2>
          <p className="mx-auto mt-7 max-w-md text-sm leading-7 text-slate-400">Intelligent attendance built around recognition, verification and real-time data.</p>
          <button className="mt-9 rounded-full bg-blue-500 px-8 py-4 text-xs font-semibold tracking-wide shadow-[0_0_30px_rgba(22,131,255,0.2)] transition hover:bg-blue-400">GET STARTED</button>
        </div>
      </section>
    </main>
  );
}
