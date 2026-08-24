import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, ScanFace, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";

const panels = [
  { id: "features", title: "Features", text: "AI face recognition, liveness detection, session-based attendance and automatic Present, Late or Absent tracking.", icon: ScanFace },
  { id: "how", title: "How it works", text: "Schedule a lecture, start the AI session, verify each real face, and let VisionAttend record attendance automatically.", icon: ShieldCheck },
];

const faceRecognitionImage = "https://blog.truora.com/hubfs/biometria%20facial.jpg";

const networkBackground = "data:image/webp;base64,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";

export default function LandingPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = panels.find(p => p.id === expanded);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar activePanel={expanded} onPanelChange={setExpanded} />
      <main className={`mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center px-6 py-8 transition-all duration-500 ${expanded ? "items-start pt-8" : ""}`}>
        <div className={`w-full overflow-hidden rounded-3xl border border-line bg-panel shadow-sm transition-all duration-500 ${expanded ? "min-h-[calc(100vh-112px)]" : "max-w-3xl mx-auto"}`}>
          <div className="grid min-h-[520px] md:grid-cols-[1.05fr_.95fr]">
            <section className="flex flex-col justify-center p-8 sm:p-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">AI attendance • verified</p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">Smart attendance.<br/>Powered by AI.</h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-ink-muted sm:text-base">VisionAttend recognizes students, confirms liveness and records attendance against every lecture session.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent-dim transition">Get Started <ArrowRight size={16}/></Link>
                <Link to="/login" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium hover:bg-panel-hover transition">Log in</Link>
              </div>
              {expanded && active && (
                <div className="mt-10 rounded-2xl border border-line bg-bg p-5 animate-in fade-in">
                  <div className="flex items-center gap-3"><active.icon size={20} className="text-accent"/><h2 className="font-display text-xl font-semibold">{active.title}</h2></div>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">{active.text}</p>
                  {active.id === "features" && <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini title="Face Recognition"/><Mini title="Liveness"/><Mini title="Session Tracking"/></div>}
                  {active.id === "how" && <div className="mt-5 grid gap-3 sm:grid-cols-4"><Mini title="01 Schedule"/><Mini title="02 Verify"/><Mini title="03 Detect"/><Mini title="04 Record"/></div>}
                </div>
              )}
            </section>
            <section className="relative flex items-center justify-center overflow-hidden border-t border-line bg-panel-hover p-8 md:border-l md:border-t-0">
              <div className="absolute inset-0 bg-cover bg-center opacity-55" style={{ backgroundImage: `url("${networkBackground}")` }} />
              <div className="absolute inset-0 bg-[#f4efe7]/55" />
              <div className="relative h-72 w-72 overflow-hidden rounded-3xl border border-accent/20 bg-panel shadow-lg sm:h-80 sm:w-80">
                <img src={faceRecognitionImage} alt="AI face recognition scan" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute left-6 right-6 top-6 bottom-6 border border-white/80 rounded-sm pointer-events-none" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between font-mono text-[10px] text-white drop-shadow">
                  <span>VISIONATTEND AI</span><span className="text-green-300">LIVE READY</span>
                </div>
              </div>
              
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Mini({ title }: { title: string }) { return <div className="rounded-xl border border-line bg-panel p-3 text-xs font-medium">{title}</div>; }
