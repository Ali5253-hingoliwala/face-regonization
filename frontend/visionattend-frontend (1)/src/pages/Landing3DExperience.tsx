import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import BiometricScanner from "../components/3d/BiometricScanner";
import FaceLandmarks from "../components/3d/FaceLandmarks";

const MODEL_PATH = "/models/human_head_base_mesh.glb";

const stages = [
  {
    number: "01",
    eyebrow: "DETECTION",
    title: "SEE.",
    description:
      "VisionAttend detects the presence of a student through intelligent computer vision before attendance begins.",
  },
  {
    number: "02",
    eyebrow: "RECOGNITION",
    title: "RECOGNIZE.",
    description:
      "Facial features are analyzed against registered identities in real time, creating a fast biometric match.",
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

function AIHead({ progress }: { progress: MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const currentMouse = useRef({ x: 0, y: 0 });

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
          opacity: 0.94,
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
    const mx = currentMouse.current.x;
    const my = currentMouse.current.y;
    const smooth = 1 - Math.pow(0.001, delta);

    currentMouse.current.x = THREE.MathUtils.lerp(
      currentMouse.current.x,
      mouse.current.x,
      smooth
    );
    currentMouse.current.y = THREE.MathUtils.lerp(
      currentMouse.current.y,
      mouse.current.y,
      smooth
    );

    // Deliberate multi-stage camera choreography.
    const arc = Math.sin(p * Math.PI);
    const turn = THREE.MathUtils.smoothstep(p, 0, 1);

    const targetRotationY =
      THREE.MathUtils.lerp(-0.08, 1.95, turn) +
      Math.sin(p * Math.PI * 3) * 0.12 +
      currentMouse.current.x * 0.28;

    const targetRotationX =
      currentMouse.current.y * -0.16 +
      Math.sin(time * 0.75) * 0.018;

    const targetRotationZ =
      currentMouse.current.x * 0.035 +
      Math.sin(time * 0.55) * 0.01;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      0.09
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      0.09
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      targetRotationZ,
      0.09
    );

    // Strong horizontal movement so scroll visibly drives the head.
    const targetX =
      THREE.MathUtils.lerp(2.0, -1.15, p) +
      Math.sin(p * Math.PI * 2) * 0.35 +
      currentMouse.current.x * 0.16;

    const targetY =
      -0.05 +
      Math.sin(time * 0.9) * 0.055 -
      currentMouse.current.y * 0.08 +
      arc * 0.12;

    const targetZ = THREE.MathUtils.lerp(0.2, 1.0, p);
    const targetScale = THREE.MathUtils.lerp(0.86, 1.16, arc);

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      0.085
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      0.075
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      targetZ,
      0.07
    );

    const scale = THREE.MathUtils.lerp(
      groupRef.current.scale.x,
      targetScale,
      0.075
    );
    groupRef.current.scale.setScalar(scale);

    void mx;
    void my;
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
      <ambientLight intensity={1.15} />
      <directionalLight position={[5, 5, 10]} intensity={1.5} />
      <AIHead progress={progress} />
    </>
  );
}

function AnimatedStage({
  stage,
  index,
  progress,
}: {
  stage: (typeof stages)[number];
  index: number;
  progress: number;
}) {
  const stagePosition = progress * (stages.length - 1);
  const distance = index - stagePosition;
  const absoluteDistance = Math.abs(distance);

  const opacity = THREE.MathUtils.clamp(
    1 - absoluteDistance * 2.4,
    0,
    1
  );

  const blur = Math.min(9, absoluteDistance * 9);
  const translateY = distance * 72;
  const scale = 1 - Math.min(0.08, absoluteDistance * 0.04);

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 w-full max-w-2xl"
      style={{
        opacity,
        transform: `translate3d(0, calc(-50% + ${translateY}px), 0) scale(${scale})`,
        filter: `blur(${blur}px)`,
        transition: "opacity 180ms linear, filter 180ms linear, transform 180ms cubic-bezier(.22,1,.36,1)",
        willChange: "transform, opacity, filter",
      }}
    >
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs tracking-[0.35em] text-blue-400">
          {stage.number}
        </span>
        <span className="h-px w-14 bg-blue-400/60" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-blue-300/70">
          {stage.eyebrow}
        </span>
      </div>

      <h2 className="mt-5 font-display text-6xl font-semibold leading-[0.84] tracking-[-0.055em] text-white sm:text-7xl lg:text-[7.5rem]">
        {stage.title.split("").map((char, charIndex) => (
          <span
            key={`${stage.number}-${charIndex}`}
            className="inline-block"
            style={{
              opacity: Math.max(
                0.55,
                1 - absoluteDistance * 1.6
              ),
              transform: `translate3d(0, ${
                Math.min(28, absoluteDistance * 28) *
                (charIndex % 2 === 0 ? 1 : -1)
              }px, 0)`,
              transition: `transform ${220 + charIndex * 18}ms cubic-bezier(.22,1,.36,1), opacity 220ms ease`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </h2>

      <p
        className="mt-7 max-w-md text-sm leading-7 text-slate-400 sm:text-base"
        style={{
          opacity: Math.max(0, 1 - absoluteDistance * 2.2),
          transform: `translateY(${Math.min(20, absoluteDistance * 20)}px)`,
          transition: "opacity 350ms ease, transform 500ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        {stage.description}
      </p>
    </div>
  );
}

export default function Landing3DExperience() {
  const cinematicRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [pageProgress, setPageProgress] = useState(0);

  useEffect(() => {
    const section = cinematicRef.current;
    if (!section) return;

    let frame = 0;
    let lastValue = -1;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const total = Math.max(
        1,
        section.offsetHeight - window.innerHeight
      );
      const value = THREE.MathUtils.clamp(
        -rect.top / total,
        0,
        1
      );

      progress.current = value;

      // Avoid React renders when the value has barely changed.
      if (Math.abs(value - lastValue) > 0.002) {
        lastValue = value;
        setPageProgress(value);
      }

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

  const activeStage = Math.min(
    stages.length - 1,
    Math.round(pageProgress * (stages.length - 1))
  );
  const current = stages[activeStage];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#03060b] text-white">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[54%] top-[42%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.075] blur-[170px]" />
        <div className="absolute right-[-180px] top-[18%] h-[520px] w-[520px] rounded-full bg-cyan-400/[0.035] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      {/* ONE continuous 3D scene */}
      <div className="pointer-events-none fixed inset-0 z-10">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 42, near: 0.1, far: 100 }}
          dpr={[1, 1.5]}
        >
          <Scene progress={progress} />
        </Canvas>
      </div>

      {/* Navbar */}
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

      {/* HERO */}
      <section className="relative z-20 flex min-h-screen items-center overflow-hidden px-6 pt-20 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <p className="mb-5 font-mono text-xs tracking-[0.35em] text-blue-400">
              AI ATTENDANCE SYSTEM
            </p>

            <h1 className="font-display text-6xl font-semibold leading-[0.86] tracking-[-0.055em] sm:text-7xl lg:text-[7.4rem]">
              Attendance
              <br />
              <span className="text-slate-500">Reimagined.</span>
            </h1>

            <p className="mt-8 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Facial recognition, liveness verification and intelligent
              attendance — unified into one intelligent system.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button className="rounded-full bg-blue-500 px-6 py-3 text-xs font-semibold tracking-wide text-white shadow-[0_0_30px_rgba(22,131,255,0.22)] transition hover:bg-blue-400">
                ENTER SYSTEM
              </button>
              <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">
                SCROLL TO EXPLORE ↓
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 left-6 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-10 lg:left-14">
          VISIONATTEND / 001
        </div>

        <div className="pointer-events-none absolute bottom-8 right-8 flex items-center gap-3 font-mono text-[9px] tracking-[0.2em] text-slate-500 sm:right-14">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />
          AI CORE ACTIVE
        </div>
      </section>

      {/* CINEMATIC SCROLL */}
      <section
        ref={cinematicRef}
        id="cinematic-experience"
        className="relative z-20 h-[520vh]"
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_45%,rgba(22,131,255,0.11),transparent_34%)]" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute inset-y-0 left-0 w-[68%] bg-gradient-to-r from-[#03060b]/96 via-[#03060b]/75 to-transparent" />

          {/* Cinematic text */}
          <div className="relative mx-auto h-full max-w-7xl px-6 sm:px-10 lg:px-14">
            <div className="absolute left-6 top-0 h-full w-full max-w-2xl sm:left-10 lg:left-14">
              {stages.map((stage, index) => (
                <AnimatedStage
                  key={stage.number}
                  stage={stage}
                  index={index}
                  progress={pageProgress}
                />
              ))}
            </div>

            {/* HUD */}
            <div className="absolute bottom-12 right-6 hidden w-64 border border-blue-400/20 bg-[#07111e]/75 p-5 shadow-[0_0_50px_rgba(22,131,255,0.08)] backdrop-blur-xl sm:right-10 lg:right-14 md:block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] tracking-[0.25em] text-slate-500">
                  BIOMETRIC CORE
                </span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />
              </div>

              <div className="mt-5 space-y-3 font-mono text-[9px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">PIPELINE</span>
                  <span className="text-blue-300">{current.eyebrow}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">FACE</span>
                  <span className="text-blue-300">DETECTED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MATCH</span>
                  <span>98.7%</span>
                </div>
              </div>

              <div className="mt-5 h-px overflow-hidden bg-white/10">
                <div
                  className="h-full bg-blue-400 shadow-[0_0_12px_#1683ff] transition-[width] duration-200"
                  style={{ width: `${Math.max(8, pageProgress * 100)}%` }}
                />
              </div>

              <div className="mt-4 flex justify-between font-mono text-[8px] text-slate-600">
                <span>{current.number} / 04</span>
                <span>{Math.round(pageProgress * 100)}%</span>
              </div>
            </div>

            {/* Scroll rail */}
            <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 md:block lg:right-0">
              <div className="flex flex-col items-center gap-3">
                <span className="font-mono text-[8px] tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl]">
                  SCROLL
                </span>
                <div className="relative h-36 w-px bg-white/10">
                  <div
                    className="absolute left-0 top-0 h-full w-full origin-top bg-blue-400 shadow-[0_0_14px_#1683ff]"
                    style={{ transform: `scaleY(${pageProgress})` }}
                  />
                </div>
                <span className="font-mono text-[8px] tracking-widest text-blue-400">
                  {current.number}
                </span>
              </div>
            </div>

            <div className="absolute bottom-8 left-6 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-10 lg:left-14">
              VISIONATTEND / CINEMATIC CORE
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-20 flex min-h-screen items-center justify-center overflow-hidden border-t border-white/[0.06] px-6">
        <div className="absolute h-[520px] w-[520px] rounded-full bg-blue-500/[0.07] blur-[140px]" />

        <div className="relative z-10 text-center">
          <p className="font-mono text-xs tracking-[0.4em] text-blue-400">
            VISIONATTEND AI
          </p>
          <h2 className="mt-6 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-8xl">
            Smarter.
            <br />
            <span className="text-slate-500">Simpler.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-md text-sm leading-7 text-slate-400">
            Intelligent attendance built around recognition, verification and
            real-time data.
          </p>
          <button className="mt-9 rounded-full bg-blue-500 px-8 py-4 text-xs font-semibold tracking-wide transition hover:bg-blue-400">
            GET STARTED
          </button>
        </div>
      </section>
    </main>
  );
}
