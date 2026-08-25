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
    const move = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", move);

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const count = child.geometry.attributes.position?.count ?? 0;
      if (count > 1000) {
        child.material = new THREE.MeshBasicMaterial({ color: "#1297ff", wireframe: true, transparent: true, opacity: 0.96 });
      } else child.visible = false;
    });

    return () => window.removeEventListener("mousemove", move);
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);
    const t = state.clock.elapsedTime;
    const smooth = 1 - Math.pow(0.001, delta);

    current.current.x = THREE.MathUtils.lerp(current.current.x, mouse.current.x, smooth);
    current.current.y = THREE.MathUtils.lerp(current.current.y, mouse.current.y, smooth);
    const mx = current.current.x;
    const my = current.current.y;

    // Before SEE appears, perform one complete 360° scan and settle facing forward.
    const scan = THREE.MathUtils.clamp(p / 0.24, 0, 1);
    const fullTurn = scan * Math.PI * 2;
    const analysisTurn = Math.max(0, p - 0.24) * Math.PI * 0.65;
    const targetRotationY = fullTurn + analysisTurn + mx * 0.22;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, my * -0.14 + Math.sin(t * 0.7) * 0.014, 0.08);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 0.075);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, mx * 0.03 + Math.sin(t * 0.55) * 0.008, 0.08);

    // The head moves into the scanner, then makes restrained analytical movements.
    const settle = THREE.MathUtils.smoothstep(scan, 0, 1);
    const analysis = THREE.MathUtils.clamp((p - 0.24) / 0.76, 0, 1);
    const targetX = THREE.MathUtils.lerp(2.15, 0.95, settle) - analysis * 0.65 + mx * 0.13;
    const targetY = -0.04 + Math.sin(t * 0.8) * 0.045 - my * 0.065;
    const targetZ = THREE.MathUtils.lerp(0.05, 0.72, analysis);
    const targetScale = THREE.MathUtils.lerp(0.96, 1.08, Math.sin(analysis * Math.PI) * 0.3);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.075);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.075);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.065);
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.07));
  });

  return <group ref={groupRef}><primitive object={scene} scale={0.68} /><BiometricScanner /><FaceLandmarks /></group>;
}

useGLTF.preload(MODEL_PATH);

function Scene({ progress }: { progress: MutableRefObject<number> }) {
  return <><ambientLight intensity={1.15} /><directionalLight position={[5, 5, 10]} intensity={1.5} /><AIHead progress={progress} /></>;
}

function ScannerOverlay({ progress }: { progress: number }) {
  const visible = progress > 0.015 && progress < 0.97;
  const scanPhase = THREE.MathUtils.clamp(progress / 0.24, 0, 1);
  const fill = THREE.MathUtils.smoothstep(scanPhase, 0, 1);
  const pulse = 0.5 + Math.sin(progress * Math.PI * 18) * 0.5;
  const opacity = visible ? Math.min(1, 0.25 + fill * 0.7) : 0;

  return <div className="pointer-events-none absolute left-[59%] top-1/2 z-30 hidden h-[370px] w-[300px] -translate-x-1/2 -translate-y-1/2 md:block" style={{ opacity }}>
    <div className="absolute inset-0 rounded-[30px] border border-blue-300/35 bg-blue-400/[0.025] shadow-[0_0_90px_rgba(18,151,255,0.12)]" style={{ transform: `scale(${0.96 + pulse * 0.018})` }} />
    <div className="absolute inset-5 rounded-[24px] border border-blue-400/15" />
    <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-blue-300 to-transparent" />
    <div className="absolute bottom-0 left-1/2 h-12 w-px -translate-x-1/2 bg-gradient-to-t from-transparent via-blue-300 to-transparent" />
    <div className="absolute left-0 top-1/2 h-px w-12 -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
    <div className="absolute right-0 top-1/2 h-px w-12 -translate-y-1/2 bg-gradient-to-l from-transparent via-blue-300 to-transparent" />
    <div className="absolute left-7 right-7 top-7 bottom-7 overflow-hidden rounded-[18px] border border-blue-300/10">
      <div className="absolute inset-0 bg-blue-400/[0.025]" style={{ opacity: 0.25 + fill * 0.35 }} />
      <div className="absolute left-0 right-0 h-px bg-blue-300 shadow-[0_0_18px_#1297ff]" style={{ top: `${8 + pulse * 84}%`, opacity: 0.85 }} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-500/[0.11] to-transparent" style={{ height: `${fill * 100}%`, opacity: 0.55 }} />
    </div>
    <div className="absolute -left-5 top-8 font-mono text-[8px] tracking-[0.25em] text-blue-300/75 [writing-mode:vertical-rl]">BIOMETRIC SCAN</div>
    <div className="absolute -right-5 bottom-8 font-mono text-[8px] tracking-[0.25em] text-blue-300/55 [writing-mode:vertical-rl]">LIVE ANALYSIS</div>
    <div className="absolute left-8 top-8 font-mono text-[8px] tracking-[0.2em] text-slate-500">SCAN / {String(Math.round(fill * 100)).padStart(3, "0")} %</div>
    <div className="absolute bottom-8 right-8 font-mono text-[8px] tracking-[0.2em] text-blue-300">FACE LOCKED</div>
  </div>;
}

function StagePanel({ stage, index, progress }: { stage: (typeof stages)[number]; index: number; progress: number }) {
  const scaled = progress * stages.length;
  const distance = scaled - index;
  const active = Math.floor(scaled) === index && scaled < stages.length;
  const local = THREE.MathUtils.clamp(distance, 0, 1);
  const enter = THREE.MathUtils.smoothstep(local / 0.22, 0, 1);
  const exit = THREE.MathUtils.smoothstep((local - 0.72) / 0.28, 0, 1);
  const opacity = active ? 1 - exit * 0.96 : 0;
  const x = active ? THREE.MathUtils.lerp(-80, 0, enter) - exit * 55 : 90;
  const blur = active ? THREE.MathUtils.lerp(15, 0, enter) + exit * 8 : 14;
  const scale = active ? THREE.MathUtils.lerp(0.94, 1, enter) : 0.94;

  return <div className="absolute left-0 top-1/2 w-full max-w-2xl -translate-y-1/2" style={{ opacity, transform: `translate3d(${x}px,-50%,0) scale(${scale})`, filter: `blur(${blur}px)`, zIndex: active ? 10 : 1 }}>
    <div className="mb-5 flex items-center gap-4"><span className="font-mono text-xs tracking-[0.35em] text-blue-400">{stage.number}</span><span className="h-px w-14 bg-blue-400/60" /><span className="font-mono text-[10px] tracking-[0.3em] text-blue-300/70">{stage.eyebrow}</span></div>
    <h2 className="font-display text-6xl font-semibold leading-[0.84] tracking-[-0.055em] text-white sm:text-7xl lg:text-[7rem]" style={{ perspective: "900px" }}>
      {stage.title.split("").map((char, i) => { const stagger = THREE.MathUtils.clamp((enter - i * 0.055) / 0.75, 0, 1); const y = THREE.MathUtils.lerp(38, 0, stagger) * (i % 2 === 0 ? 1 : 0.55); const rotate = THREE.MathUtils.lerp(12, 0, stagger) * (i % 2 === 0 ? 1 : -1); return <span key={`${stage.number}-${i}`} className="inline-block will-change-transform" style={{ opacity: stagger, transform: `translate3d(0,${y}px,0) rotateX(${rotate}deg)` }}>{char === " " ? "\u00A0" : char}</span>; })}
    </h2>
    <p className="mt-7 max-w-md text-sm leading-7 text-slate-400 sm:text-base" style={{ opacity: THREE.MathUtils.clamp((enter - 0.28) / 0.55, 0, 1), transform: `translateY(${THREE.MathUtils.lerp(22, 0, enter)}px)` }}>{stage.description}</p>
  </div>;
}

export default function Landing3DExperienceV2() {
  const cinematicRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [pageProgress, setPageProgress] = useState(0);

  useEffect(() => {
    const section = cinematicRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const value = THREE.MathUtils.clamp(-rect.top / scrollable, 0, 1);
      progress.current = value;
      setPageProgress(value);
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const scaled = pageProgress * stages.length;
  const activeIndex = Math.min(stages.length - 1, Math.floor(scaled));
  const current = stages[activeIndex];

  return <main className="min-h-screen overflow-x-hidden bg-[#03060b] text-white">
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><div className="absolute left-[55%] top-[42%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.075] blur-[170px]" /><div className="absolute right-[-180px] top-[18%] h-[520px] w-[520px] rounded-full bg-cyan-400/[0.035] blur-[150px]" /><div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" /></div>
    <div className="pointer-events-none fixed inset-0 z-10"><Canvas camera={{ position: [0, 0, 10], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.5]}><Scene progress={progress} /></Canvas></div>

    <header className="fixed left-0 right-0 top-0 z-[80] border-b border-white/[0.06] bg-[#03060b]/65 backdrop-blur-xl"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10"><div><div className="font-mono text-xs font-semibold tracking-[0.35em]">VISION<span className="text-blue-400">ATTEND</span></div><div className="mt-1 font-mono text-[8px] tracking-[0.3em] text-slate-500">ARTIFICIAL INTELLIGENCE</div></div><nav className="hidden gap-8 md:flex"><span className="text-xs text-slate-400">AI RECOGNITION</span><span className="text-xs text-slate-400">LIVENESS</span><span className="text-xs text-slate-400">ANALYTICS</span></nav><div className="rounded-full border border-blue-400/30 px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-blue-300">SYSTEM ONLINE</div></div></header>

    <section className="relative z-20 flex min-h-screen items-center overflow-hidden px-6 pt-20 sm:px-10 lg:px-14"><div className="mx-auto w-full max-w-7xl"><div className="max-w-3xl"><p className="mb-5 font-mono text-xs tracking-[0.35em] text-blue-400">AI ATTENDANCE SYSTEM</p><h1 className="font-display text-6xl font-semibold leading-[0.86] tracking-[-0.055em] sm:text-7xl lg:text-[7.4rem]">Attendance<br /><span className="text-slate-500">Reimagined.</span></h1><p className="mt-8 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">Facial recognition, liveness verification and intelligent attendance — unified into one intelligent system.</p><div className="mt-9 flex flex-wrap items-center gap-5"><button className="rounded-full bg-blue-500 px-6 py-3 text-xs font-semibold tracking-wide text-white shadow-[0_0_30px_rgba(22,131,255,0.22)] transition hover:bg-blue-400">ENTER SYSTEM</button><span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">SCROLL TO EXPLORE ↓</span></div></div></div></section>

    <section ref={cinematicRef} className="relative z-20 h-[640vh]"><div className="sticky top-0 h-screen overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_59%_47%,rgba(18,151,255,0.13),transparent_36%)]" /><div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" /><div className="absolute inset-y-0 left-0 w-[70%] bg-gradient-to-r from-[#03060b]/96 via-[#03060b]/76 to-transparent" />
      <div className="relative mx-auto h-full max-w-7xl px-6 sm:px-10 lg:px-14"><div className="absolute left-6 top-0 h-full w-full max-w-2xl sm:left-10 lg:left-14">{stages.map((stage, index) => <StagePanel key={stage.number} stage={stage} index={index} progress={pageProgress} />)}</div><ScannerOverlay progress={pageProgress} />
        <div className="absolute bottom-12 right-6 hidden w-64 border border-blue-400/20 bg-[#07111e]/78 p-5 shadow-[0_0_55px_rgba(18,151,255,0.10)] backdrop-blur-xl md:block sm:right-10 lg:right-14"><div className="flex items-center justify-between"><span className="font-mono text-[9px] tracking-[0.25em] text-slate-500">BIOMETRIC CORE</span><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_12px_#1297ff]" /></div><div className="mt-5 space-y-3 font-mono text-[9px]"><div className="flex justify-between"><span className="text-slate-500">PIPELINE</span><span className="text-blue-300">{current.eyebrow}</span></div><div className="flex justify-between"><span className="text-slate-500">FACE</span><span className="text-blue-300">DETECTED</span></div><div className="flex justify-between"><span className="text-slate-500">LIVENESS</span><span className="text-blue-300">ACTIVE</span></div><div className="flex justify-between"><span className="text-slate-500">MATCH</span><span>98.7%</span></div></div><div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-400 shadow-[0_0_14px_#1297ff] transition-[width] duration-150" style={{ width: `${Math.max(6, pageProgress * 100)}%` }} /></div><div className="mt-4 flex justify-between font-mono text-[8px] text-slate-600"><span>{current.number} / 04</span><span>{Math.round(pageProgress * 100)}%</span></div></div>
        <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 md:block lg:right-0"><div className="flex flex-col items-center gap-3"><span className="font-mono text-[8px] tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl]">SCROLL</span><div className="relative h-44 w-px bg-white/10"><div className="absolute left-0 top-0 h-full w-full origin-top bg-blue-400 shadow-[0_0_14px_#1297ff]" style={{ transform: `scaleY(${pageProgress})` }} /></div><span className="font-mono text-[8px] tracking-widest text-blue-400">{current.number}</span></div></div><div className="absolute bottom-8 left-6 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-10 lg:left-14">VISIONATTEND / CINEMATIC CORE</div>
      </div>
    </div></section>

    <section className="relative z-20 flex min-h-screen items-center justify-center overflow-hidden border-t border-white/[0.06] px-6"><div className="absolute h-[520px] w-[520px] rounded-full bg-blue-500/[0.07] blur-[140px]" /><div className="relative z-10 text-center"><p className="font-mono text-xs tracking-[0.4em] text-blue-400">VISIONATTEND AI</p><h2 className="mt-6 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-8xl">Smarter.<br /><span className="text-slate-500">Simpler.</span></h2><p className="mx-auto mt-7 max-w-md text-sm leading-7 text-slate-400">Intelligent attendance built around recognition, verification and real-time data.</p><button className="mt-9 rounded-full bg-blue-500 px-8 py-4 text-xs font-semibold tracking-wide transition hover:bg-blue-400">GET STARTED</button></div></section>
  </main>;
}
