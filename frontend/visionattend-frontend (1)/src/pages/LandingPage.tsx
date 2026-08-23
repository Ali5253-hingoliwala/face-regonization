import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanFace,
  ShieldCheck,
  Radar,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import ViewfinderFrame from "../components/ViewfinderFrame";
import Navbar from "../components/Navbar";
import Reveal from "../components/Reveal";
import AnimatedCounter from "../components/AnimatedCounter";

const features = [
  {
    icon: ScanFace,
    title: "Face Recognition",
    description:
      "Every student is matched against their registered face embedding in real time -- no ID cards, no manual roll call.",
  },
  {
    icon: ShieldCheck,
    title: "Liveness Detection",
    description:
      "Blink, head-turn, and gaze signals confirm a real person is in front of the camera, not a photo held up to fool it.",
  },
  {
    icon: Radar,
    title: "Session-Based Tracking",
    description:
      "Every lecture is a named session with its own start time -- attendance is measured against when class actually began.",
  },
  {
    icon: BarChart3,
    title: "Present, Late & Absent",
    description:
      "Arrivals are automatically sorted by how many minutes into the lecture they showed up, right down to the second.",
  },
];

const steps = [
  { label: "Schedule", text: "An admin names the lecture and sets its start time." },
  { label: "Verify", text: "The camera recognizes each student as they arrive." },
  { label: "Confirm", text: "Liveness checks rule out a held-up photo." },
  { label: "Record", text: "Present, Late, or Absent is logged automatically." },
];

const stats = [
  { value: 3, suffix: "s", decimals: 0, label: "Avg. check-in time" },
  { value: 99.2, suffix: "%", decimals: 1, label: "Recognition accuracy" },
  { value: 45, suffix: "min", decimals: 0, label: "Tracked per session" },
  { value: 100, suffix: "%", decimals: 0, label: "Automatic recording" },
];

const HERO_STAGES = [
  { label: "SCANNING", color: "text-ink-muted" },
  { label: "MATCHING", color: "text-accent" },
  { label: "LIVE", color: "text-present" },
  { label: "RECORDED", color: "text-present" },
];

export default function LandingPage() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % HERO_STAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const currentStage = HERO_STAGES[stage];

  return (
    <div className="min-h-screen bg-bg text-ink font-body">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="font-mono text-xs text-accent tracking-wider uppercase mb-4">
            Attendance, verified
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
            Smart attendance.
            <br />
            Powered by AI.
          </h1>
          <p className="mt-6 text-ink-muted text-lg leading-relaxed max-w-md">
            VisionAttend AI recognizes each student, confirms they're really
            there, and records Present, Late, or Absent automatically --
            timed against the exact minute the lecture began.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-accent text-white font-medium px-6 py-3 rounded-md shadow-sm shadow-accent/20 hover:bg-accent-dim hover:shadow-md hover:scale-[1.02] transition-all"
            >
              Get Started
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="text-ink-muted hover:text-ink transition-colors px-6 py-3"
            >
              Log in
            </Link>
          </div>
        </div>

        {/* Interactive hero visual -- cycles through the actual
            detection stages the camera pipeline goes through */}
        <div className="relative flex items-center justify-center">
          <ViewfinderFrame
            active
            cornerSize={28}
            className="w-72 h-72 md:w-80 md:h-80 bg-panel rounded-2xl border border-line shadow-xl shadow-slate-200/60 overflow-hidden flex items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute left-0 right-0 h-24 bg-gradient-to-b from-accent/0 via-accent/10 to-accent/0 animate-scan" />
            </div>

            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-ink-faint">
              <circle cx="60" cy="45" r="26" stroke="currentColor" strokeWidth="2" />
              <path
                d="M15 110c6-28 24-42 45-42s39 14 45 42"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between font-mono text-xs">
              <span className={`transition-colors duration-300 ${currentStage.color}`}>
                {currentStage.label}
              </span>
              <span className="text-ink-muted">conf: 94.2%</span>
            </div>
          </ViewfinderFrame>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-line bg-panel/50">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <div className="text-center lg:text-left">
                <div className="font-display text-3xl md:text-4xl font-semibold text-accent">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </div>
                <p className="text-sm text-ink-muted mt-1">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold mb-10">
            What it checks, every time
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 100}>
              <ViewfinderFrame
                cornerSize={14}
                className="group bg-panel border border-line rounded-xl p-6 shadow-sm shadow-slate-200/40 hover:shadow-lg hover:shadow-slate-200/70 hover:-translate-y-1 transition-all duration-300 h-full"
              >
                <feature.icon
                  className="text-accent mb-4 group-hover:scale-110 transition-transform duration-300"
                  size={22}
                />
                <h3 className="font-display font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {feature.description}
                </p>
              </ViewfinderFrame>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20 border-t border-line">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold mb-10">
            How a lecture gets recorded
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, i) => (
            <Reveal key={step.label} delay={i * 100}>
              <div className="relative pl-6">
                <div className="absolute left-0 top-1 font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display font-medium mb-1">{step.label}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{step.text}</p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1.5 -right-3 w-6 h-px bg-line" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="relative overflow-hidden rounded-2xl bg-panel-dark px-10 py-14 text-center">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 0%, rgba(217,154,76,0.35), transparent 60%)",
              }}
            />
            <div className="relative z-10">
              <h2 className="font-display text-3xl font-semibold text-white mb-3">
                Ready to see it in action?
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Register a face, start a lecture, and watch attendance record
                itself in real time.
              </p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-accent text-white font-medium px-6 py-3 rounded-md hover:bg-accent-dim hover:scale-[1.02] transition-all"
              >
                Get Started
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-10 border-t border-line flex items-center justify-between text-sm text-ink-muted">
        <span>VisionAttend AI</span>
        <div className="flex gap-6">
          <Link to="/login" className="hover:text-ink transition-colors">Log in</Link>
          <Link to="/signup" className="hover:text-ink transition-colors">Sign up</Link>
        </div>
      </footer>
    </div>
  );
}