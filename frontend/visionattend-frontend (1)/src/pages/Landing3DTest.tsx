import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import BiometricScanner from "../components/3d/BiometricScanner";
import FaceLandmarks from "../components/3d/FaceLandmarks";

gsap.registerPlugin(ScrollTrigger);

const MODEL_PATH = "/models/human_head_base_mesh.glb";

/* ============================================================
   3D HEAD
   ============================================================ */

function AIHead() {
  const { scene } = useGLTF(MODEL_PATH);

  const groupRef = useRef<THREE.Group>(null);

  const mouse = useRef({
    x: 0,
    y: 0,
  });

  const current = useRef({
    x: 0,
    y: 0,
  });

  const scrollProgress = useRef(0);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      /*
        Convert mouse position to -1 → +1
      */
      mouse.current.x =
        (event.clientX / window.innerWidth - 0.5) * 2;

      mouse.current.y =
        (event.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const trigger = ScrollTrigger.create({
      trigger: "#cinematic-scroll",
      start: "top top",
      end: "bottom bottom",
      scrub: true,

      onUpdate: (self) => {
        scrollProgress.current = self.progress;
      },
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      trigger.kill();
    };
  }, []);

  /*
    Convert GLB into biometric wireframe
  */
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mesh = child;

      const vertexCount =
        mesh.geometry.attributes.position?.count ?? 0;

      /*
        Main head
      */
      if (vertexCount > 1000) {
        mesh.material = new THREE.MeshBasicMaterial({
          color: "#1683ff",
          wireframe: true,
          transparent: true,
          opacity: 0.92,
        });
      } else {
        /*
          Hide internal eye geometry
        */
        mesh.visible = false;
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;

    /*
    ============================================================
      1. SMOOTH MOUSE INERTIA
    ============================================================
    */

    const smoothing = 1 - Math.pow(0.001, delta);

    current.current.x = THREE.MathUtils.lerp(
      current.current.x,
      mouse.current.x,
      smoothing
    );

    current.current.y = THREE.MathUtils.lerp(
      current.current.y,
      mouse.current.y,
      smoothing
    );

    const mx = current.current.x;
    const my = current.current.y;

    /*
    ============================================================
      2. MOUSE ROTATION
    ============================================================
    */

    const mouseRotationY = mx * 0.28;

    const mouseRotationX = my * -0.14;

    /*
    ============================================================
      3. SCROLL ROTATION
    ============================================================
    */

    const scroll = scrollProgress.current;

    /*
      Instead of one boring linear rotation,
      we create multiple stages.
    */

    let scrollRotationY = 0;

    if (scroll < 0.25) {
      /*
        Stage 1
        Almost front-facing
      */

      scrollRotationY = THREE.MathUtils.lerp(
        0,
        -0.25,
        scroll / 0.25
      );
    } else if (scroll < 0.5) {
      /*
        Stage 2
        Recognition
      */

      scrollRotationY = THREE.MathUtils.lerp(
        -0.25,
        0.35,
        (scroll - 0.25) / 0.25
      );
    } else if (scroll < 0.75) {
      /*
        Stage 3
        Verification
      */

      scrollRotationY = THREE.MathUtils.lerp(
        0.35,
        0.9,
        (scroll - 0.5) / 0.25
      );
    } else {
      /*
        Stage 4
        Attendance
      */

      scrollRotationY = THREE.MathUtils.lerp(
        0.9,
        1.55,
        (scroll - 0.75) / 0.25
      );
    }

    /*
    ============================================================
      4. NATURAL HEAD TILT
    ============================================================
    */

    const breathingTilt =
      Math.sin(time * 0.7) * 0.025;

    const mouseTilt =
      mx * 0.04;

    const targetRotationX =
      mouseRotationX +
      breathingTilt;

    const targetRotationY =
      mouseRotationY +
      scrollRotationY;

    const targetRotationZ =
      mouseTilt +
      Math.sin(time * 0.5) * 0.012;

    /*
    ============================================================
      5. SMOOTH ROTATION
    ============================================================
    */

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      0.08
    );

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      0.08
    );

    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      targetRotationZ,
      0.08
    );

    /*
    ============================================================
      6. FLOATING MOTION
    ============================================================
    */

    const floatingY =
      Math.sin(time * 0.8) * 0.08;

    const floatingX =
      Math.sin(time * 0.45) * 0.025;

    /*
      Mouse gives the head a subtle parallax position.
    */

    const mouseOffsetX = mx * 0.12;

    const mouseOffsetY = -my * 0.07;

    const targetX =
      floatingX +
      mouseOffsetX;

    const targetY =
      -0.5 +
      floatingY +
      mouseOffsetY;

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      0.06
    );

    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      0.06
    );

    /*
    ============================================================
      7. CINEMATIC DEPTH
    ============================================================
    */

    const depthProgress =
      Math.max(0, (scroll - 0.25) / 0.75);

    const targetZ =
      THREE.MathUtils.lerp(
        0,
        0.75,
        depthProgress
      );

    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      targetZ,
      0.05
    );

    /*
    ============================================================
      8. CINEMATIC SCALE
    ============================================================
    */

    const targetScale =
      THREE.MathUtils.lerp(
        0.65,
        0.82,
        depthProgress
      );

    const smoothScale =
      THREE.MathUtils.lerp(
        groupRef.current.scale.x,
        targetScale,
        0.05
      );

    groupRef.current.scale.setScalar(
      smoothScale
    );
  });

  return (
    <group ref={groupRef}>
    <primitive
  object={scene}
  scale={0.65}
  position={[0, 0, 0]}

/>

<BiometricScanner />
<FaceLandmarks />

    </group>
  );
}
useGLTF.preload(MODEL_PATH);

/* ============================================================
   3D SCENE
   ============================================================ */

function Scene() {
  return (
    <>
      <ambientLight intensity={1.2} />

      <directionalLight
        position={[5, 5, 10]}
        intensity={1.5}
      />

      <AIHead />
    </>
  );
}

/* ============================================================
   STAGE TEXT
   ============================================================ */

function StageText({
  number,
  eyebrow,
  title,
  description,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center px-8 sm:px-14 lg:px-20">
      <div className="max-w-xl">

        <div className="mb-5 flex items-center gap-4">
          <span className="font-mono text-xs tracking-[0.3em] text-blue-400">
            {number}
          </span>

          <span className="h-px w-12 bg-blue-500/50" />

          <span className="font-mono text-xs uppercase tracking-[0.25em] text-blue-300/70">
            {eyebrow}
          </span>
        </div>

        <h2 className="font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl">
          {title}
        </h2>

        <p className="mt-7 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function Landing3DTest() {
    const pageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const cursor = cursorRef.current;

  if (!cursor) return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  let currentX = x;
  let currentY = y;

  const handleMouseMove = (event: MouseEvent) => {
    x = event.clientX;
    y = event.clientY;
  };

  window.addEventListener("mousemove", handleMouseMove);

  let frame: number;

  const animate = () => {
    currentX += (x - currentX) * 0.08;
    currentY += (y - currentY) * 0.08;

    cursor.style.transform =
      `translate3d(${currentX - 150}px, ${currentY - 150}px, 0)`;

    frame = requestAnimationFrame(animate);
  };

  frame = requestAnimationFrame(animate);

  return () => {
    window.removeEventListener(
      "mousemove",
      handleMouseMove
    );

    cancelAnimationFrame(frame);
  };
}, []);
/*
  ============================================================
    PAGE SCROLL PROGRESS
  ============================================================
  */

  useEffect(() => {
    const progress = document.getElementById(
      "scroll-progress"
    );

    if (!progress) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY;

      const documentHeight =
        document.documentElement.scrollHeight -
        window.innerHeight;

      const percentage =
        documentHeight > 0
          ? scrollTop / documentHeight
          : 0;

      progress.style.transform =
        `scaleY(${percentage})`;
    };

    window.addEventListener(
      "scroll",
      updateProgress,
      { passive: true }
    );

    updateProgress();

    return () => {
      window.removeEventListener(
        "scroll",
        updateProgress
      );
    };
  }, []);

  return (
    <div
      ref={pageRef}
      className="min-h-screen overflow-x-hidden bg-[#05070b] text-white"
    >
{/* ============================================================
    REACTIVE BACKGROUND
============================================================ */}

<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">

  {/* Main blue atmospheric glow */}
  <div
    className="
      absolute
      left-1/2
      top-[45%]
      h-[700px]
      w-[700px]
      -translate-x-1/2
      -translate-y-1/2
      rounded-full
      bg-blue-500/[0.07]
      blur-[150px]
    "
  />

  {/* Secondary blue glow */}
  <div
    className="
      absolute
      -right-[200px]
      top-[20%]
      h-[500px]
      w-[500px]
      rounded-full
      bg-blue-400/[0.04]
      blur-[130px]
    "
  />

  {/* Subtle technical grid */}
  <div
    className="
      absolute
      inset-0
      opacity-[0.035]
      [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)]
      [background-size:80px_80px]
    "
  />

</div>
{/* ============================================================
    CURSOR ATMOSPHERE
============================================================ */}

<div
  ref={cursorRef}
  className="
    pointer-events-none
    fixed
    left-0
    top-0
    z-10
    h-[300px]
    w-[300px]
    rounded-full
    bg-blue-500/[0.1]
    blur-[80px]
  "
/>
      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#05070b]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">

          <div>
            <div className="font-mono text-xs font-semibold tracking-[0.35em] text-white">
              VISION
              <span className="text-blue-400">
                ATTEND
              </span>
            </div>

            <div className="mt-1 font-mono text-[8px] tracking-[0.3em] text-slate-500">
              ARTIFICIAL INTELLIGENCE
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <span className="text-xs text-slate-400">
              AI RECOGNITION
            </span>

            <span className="text-xs text-slate-400">
              LIVENESS
            </span>

            <span className="text-xs text-slate-400">
              ANALYTICS
            </span>
          </div>

          <div className="rounded-full border border-blue-400/30 px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-blue-300">
            SYSTEM ONLINE
          </div>

        </div>
      </header>


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative h-screen">

        {/* Ambient blue glow */}

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/[0.08] blur-[140px]" />

        <div className="hero-content absolute left-8 top-1/2 z-20 -translate-y-1/2 sm:left-14 lg:left-20">

          <p className="mb-5 font-mono text-xs tracking-[0.35em] text-blue-400">
            AI ATTENDANCE SYSTEM
          </p>

          <h1 className="max-w-4xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.05em] sm:text-7xl lg:text-[7.5rem]">

            Attendance
            <br />

            <span className="text-slate-500">
              Reimagined.
            </span>

          </h1>

          <p className="mt-8 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
            Facial recognition, liveness verification and
            intelligent attendance — unified into one
            intelligent system.
          </p>

          <div className="mt-9 flex items-center gap-5">

            <button className="rounded-full bg-blue-500 px-6 py-3 text-xs font-semibold tracking-wide text-white transition hover:bg-blue-400">
              ENTER SYSTEM
            </button>

            <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">
              SCROLL TO EXPLORE ↓
            </span>

          </div>

        </div>

        {/* 3D canvas */}

        <div className="absolute inset-0 z-10">

          <Canvas
            camera={{
              position: [0, 0, 10],
              fov: 45,
              near: 0.1,
              far: 100,
            }}
            dpr={[1, 1.5]}
          >
            <Scene />
          </Canvas>

        </div>
<div className="pointer-events-none absolute right-8 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
  <div className="w-52 border border-blue-400/20 bg-[#08111f]/60 p-4 backdrop-blur-xl">

    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] tracking-[0.25em] text-slate-500">
        BIOMETRIC CORE
      </span>

      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />
    </div>

    <div className="mt-5 space-y-3 font-mono text-[10px]">

      <div className="flex justify-between">
        <span className="text-slate-500">
          FACE DETECTED
        </span>
        <span className="text-blue-300">
          YES
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">
          LIVENESS
        </span>
        <span className="text-blue-300">
          ACTIVE
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">
          MATCH
        </span>
        <span className="text-white">
          98.7%
        </span>
      </div>

    </div>

    <div className="mt-5 h-1 overflow-hidden bg-white/[0.06]">
      <div className="h-full w-[98.7%] bg-blue-400 shadow-[0_0_12px_#1683ff]" />
    </div>

  </div>
</div>
        {/* Bottom status */}

        <div className="absolute bottom-8 left-8 z-30 font-mono text-[9px] tracking-[0.25em] text-slate-600 sm:left-14">
          VISIONATTEND / 001
        </div>

        <div className="absolute bottom-8 right-8 z-30 flex items-center gap-3 font-mono text-[9px] tracking-[0.2em] text-slate-500 sm:right-14">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_#1683ff]" />
          AI CORE ACTIVE
        </div>

      </section>


      {/* =====================================================
          SCROLL STORY
      ===================================================== */}

      <section
        id="cinematic-scroll"
        className="relative"
      >

        {/* Sticky 3D atmosphere */}

        <div className="pointer-events-none sticky top-0 z-0 h-screen">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,rgba(22,131,255,0.10),transparent_35%)]" />

          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:80px_80px]" />

        </div>


        {/* Story content */}

        <div className="relative z-10 -mt-[100vh]">

          <div className="story-stage">
            <div className="story-content">
              <StageText
                number="01"
                eyebrow="DETECTION"
                title="SEE."
                description="VisionAttend begins by detecting the presence of a student through intelligent computer vision."
              />
            </div>
          </div>


          <div className="story-stage">
            <div className="story-content">
              <StageText
                number="02"
                eyebrow="RECOGNITION"
                title="RECOGNIZE."
                description="The system analyzes facial features and compares them against registered identities in real time."
              />
            </div>
          </div>


          <div className="story-stage">
            <div className="story-content">
              <StageText
                number="03"
                eyebrow="LIVENESS"
                title="VERIFY."
                description="Liveness detection helps distinguish a real student from a presentation or spoof attempt."
              />

              <div className="hud-card absolute bottom-24 right-8 rounded-2xl border border-blue-400/20 bg-[#08111f]/70 p-5 backdrop-blur-xl sm:right-14 lg:right-20">

                <div className="font-mono text-[9px] tracking-[0.25em] text-slate-500">
                  IDENTITY MATCH
                </div>

                <div className="mt-2 font-mono text-4xl font-semibold text-blue-400">
                  98.7%
                </div>

                <div className="mt-2 text-xs text-slate-400">
                  LIVENESS VERIFIED
                </div>

              </div>
            </div>
          </div>


          <div className="story-stage">
            <div className="story-content">

              <StageText
                number="04"
                eyebrow="ATTENDANCE"
                title="ATTEND."
                description="Once verified, attendance is recorded automatically against the active lecture session."
              />

              <div className="hud-card absolute bottom-24 right-8 grid grid-cols-3 gap-3 sm:right-14 lg:right-20">

                <div className="rounded-xl border border-white/[0.08] bg-[#08111f]/80 p-4 backdrop-blur-xl">
                  <div className="font-mono text-[9px] text-slate-500">
                    PRESENT
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    42
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#08111f]/80 p-4 backdrop-blur-xl">
                  <div className="font-mono text-[9px] text-slate-500">
                    LATE
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-blue-400">
                    03
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#08111f]/80 p-4 backdrop-blur-xl">
                  <div className="font-mono text-[9px] text-slate-500">
                    ABSENT
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    06
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </section>


      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden border-t border-white/[0.06]">

        <div className="absolute h-[500px] w-[500px] rounded-full bg-blue-500/[0.08] blur-[130px]" />

        <div className="relative z-10 px-6 text-center">

          <p className="font-mono text-xs tracking-[0.4em] text-blue-400">
            VISIONATTEND AI
          </p>

          <h2 className="mt-6 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-8xl">
            Smarter.
            <br />
            <span className="text-slate-500">
              Simpler.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-md text-sm leading-7 text-slate-400">
            Intelligent attendance built around
            recognition, verification and real-time data.
          </p>

          <button className="mt-9 rounded-full bg-blue-500 px-8 py-4 text-xs font-semibold tracking-wide text-white transition hover:bg-blue-400">
            GET STARTED
          </button>

        </div>

      </section>
{/* ============================================================
    SCROLL PROGRESS INDICATOR
============================================================ */}

<div className="pointer-events-none fixed right-6 top-1/2 z-[100] hidden -translate-y-1/2 md:block">

  <div className="flex flex-col items-center gap-3">

    {/* SCROLL label */}

    <span className="font-mono text-[8px] tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl]">
      SCROLL
    </span>

    {/* Progress track */}

    <div className="relative h-32 w-[2px] overflow-hidden bg-white/10">

      {/* Progress fill */}

      <div
        id="scroll-progress"
        className="absolute left-0 top-0 h-full w-full origin-top scale-y-0 bg-blue-400 shadow-[0_0_12px_#1683ff]"
      />

    </div>

    {/* Current section */}

    <span className="font-mono text-[8px] tracking-widest text-blue-400">
      01
    </span>

  </div>

</div>
    </div>
  );
}